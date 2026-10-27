import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = JSON.parse(
  await readFile(new URL('../src/data/audit-sample.json', import.meta.url), 'utf8')
);
const pageSource = await readFile(new URL('../src/pages/website-check.astro', import.meta.url), 'utf8');
const evidenceCardCount = [fixture.finding, fixture.residual].filter(Boolean).length;

test('website check clearly identifies the precomputed LDW-owned proof', async ({ page }) => {
  const externalRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4321') externalRequests.push(request.url());
  });

  await page.goto('/website-check/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See how LDW turns evidence into a bounded decision.');
  await expect(page.getByText(fixture.label, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accepted LDW evidence — no scan is running.' })).toBeVisible();
  await expect(page.getByText('Live checks from this page')).toBeVisible();
  await expect(page.getByText('Provider requests from this page')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(evidenceCardCount);
  await expect(page.getByRole('link', { name: /Start a project conversation/ })).toHaveAttribute('href', '/discovery/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('form')).toHaveCount(0);
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toContain('/website-check/');
  expect(externalRequests).toEqual([]);
});

test('accepted counts, provenance and residual state render from the single fixture', async ({ page }) => {
  expect(pageSource).toContain('{sample.finding.beforeCount}');
  expect(pageSource).toContain('{sample.finding.afterCount}');

  await page.goto('/website-check/');

  const measured = page.locator(`[data-evidence-id="${fixture.finding.id}"]`);
  await expect(measured).toBeVisible();
  await expect(measured.locator('.audit-demo__metric').first()).toHaveText(String(fixture.finding.beforeCount));
  await expect(measured.locator('.audit-demo__metric').nth(1)).toHaveText(String(fixture.finding.afterCount));
  await measured.getByText('View measured evidence and context').click();
  await expect(measured.getByText(fixture.source).first()).toBeVisible();
  await expect(measured.getByText(fixture.evidenceCycle).first()).toBeVisible();
  await expect(measured.getByText(fixture.finding.owner).first()).toBeVisible();
  await expect(measured.getByText(fixture.finding.recheck).first()).toBeVisible();

  const residual = page.locator(`[data-evidence-id="${fixture.residual.id}"]`);
  await expect(residual).toBeVisible();
  await expect(residual.getByText(fixture.residual.status, { exact: true }).first()).toBeVisible();
  await expect(residual.getByText(fixture.residual.owner, { exact: true }).first()).toBeVisible();
  await expect(residual.getByText(fixture.residual.limitation).first()).toBeVisible();

  await expect(page.getByText(fixture.claimBoundary, { exact: true })).toBeVisible();
  for (const item of fixture.notMeasured) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
});

test('stage-one evidence page has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/website-check/');
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations.filter(({ impact }) => ['critical', 'serious'].includes(impact))).toEqual([]);
});

test('stage-one evidence page reflows at a narrow mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/website-check/');

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth
  }));

  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
