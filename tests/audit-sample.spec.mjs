import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('website check clearly identifies the static synthetic demo', async ({ page }) => {
  const externalRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4321') externalRequests.push(request.url());
  });

  await page.goto('/website-check/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See how a website review could work.');
  await expect(page.getByText('SAMPLE / DEMO', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo ready — no scan was run.' })).toBeVisible();
  await expect(page.getByText('Website pages checked')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('link', { name: /Start a project conversation/ })).toHaveAttribute('href', '/discovery/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('form')).toHaveCount(0);
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toContain('/website-check/');
  expect(externalRequests).toEqual([]);
});

test('example details disclose source, date, coverage, verification and ownership', async ({ page }) => {
  await page.goto('/website-check/');
  await page.getByText('View sample evidence and next steps').first().click();

  await expect(page.getByText('Synthetic example data created for this LDW prototype').first()).toBeVisible();
  await expect(page.getByText('October 20, 2026').first()).toBeVisible();
  await expect(page.getByText('No domain or website page was checked').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Possible verification path' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Possible action owner' }).first()).toBeVisible();
  await expect(page.getByText(/No recheck is available/).first()).toBeVisible();
});

test('sample page has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/website-check/');
  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations.filter(({ impact }) => ['critical', 'serious'].includes(impact))).toEqual([]);
});

test('sample page reflows at a narrow mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/website-check/');

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth
  }));

  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
