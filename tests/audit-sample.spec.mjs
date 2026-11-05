import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { projectPublicationSafeWebsiteCheck } from '../src/lib/website-check-publication.mjs';

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
  await expect(page.getByText(fixture.checkIntent, { exact: false })).toBeVisible();
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

test('website publication projection preserves accepted source facts, immutability, and explicit limits', () => {
  const input = structuredClone(fixture);
  const original = JSON.stringify(input);
  const view = projectPublicationSafeWebsiteCheck(input);
  expect(view.publicationMode).toBe('ldw-owned-precomputed');
  expect(view.checkIntent).toBe(input.checkIntent);
  expect(view.finding.beforeCount).toBe(11);
  expect(view.finding.afterCount).toBe(1);
  expect(view.finding.comparisonBasis).toBe('accepted_same_source_remeasurement');
  expect(view.residual.status).toBe('MONITOR / NO ACTION');
  expect(view.notMeasured).toEqual(input.notMeasured);
  expect(Object.isFrozen(view)).toBe(true);
  expect(Object.isFrozen(view.finding)).toBe(true);
  expect(Object.isFrozen(view.residual)).toBe(true);
  expect(Object.isFrozen(view.notMeasured)).toBe(true);
  expect(JSON.stringify(input)).toBe(original);
  expect(projectPublicationSafeWebsiteCheck(input)).toEqual(view);
});

test('website publication projection rejects unknown internal data and unsupported publication modes', () => {
  const withExtra = structuredClone(fixture);
  withExtra.internalRunId = 'internal-only-fixture-value';
  expect(() => projectPublicationSafeWebsiteCheck(withExtra)).toThrow();

  const withRawProviderField = structuredClone(fixture);
  withRawProviderField.finding.rawProviderPayload = 'not-for-browser';
  expect(() => projectPublicationSafeWebsiteCheck(withRawProviderField)).toThrow();

  const withUnexpectedNestedField = structuredClone(fixture);
  withUnexpectedNestedField.residual.internalDetail = 'not-for-browser';
  expect(() => projectPublicationSafeWebsiteCheck(withUnexpectedNestedField)).toThrow();

  for (const publicationMode of [undefined, 'live', 'customer', 'prospect']) {
    const changed = structuredClone(fixture);
    if (publicationMode === undefined) delete changed.publicationMode;
    else changed.publicationMode = publicationMode;
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }

  const withSourceUrl = structuredClone(fixture);
  withSourceUrl.source = 'https://private.example.invalid/raw';
  expect(() => projectPublicationSafeWebsiteCheck(withSourceUrl)).toThrow();
});

test('website publication projection rejects missing source, comparison authority, and observed-value ambiguity', () => {
  for (const key of ['source', 'coverage', 'freshness', 'claimBoundary', 'checkIntent']) {
    const changed = structuredClone(fixture);
    delete changed[key];
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }
  for (const invalidCount of [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.2, '0']) {
    const changed = structuredClone(fixture);
    changed.finding.afterCount = invalidCount;
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }
  const observedZero = structuredClone(fixture);
  observedZero.finding.afterCount = 0;
  expect(projectPublicationSafeWebsiteCheck(observedZero).finding.afterCount).toBe(0);

  const unsupportedComparison = structuredClone(fixture);
  delete unsupportedComparison.finding.comparisonBasis;
  expect(() => projectPublicationSafeWebsiteCheck(unsupportedComparison)).toThrow();

  const wrongComparison = structuredClone(fixture);
  wrongComparison.finding.comparisonBasis = 'inferred_from_numeric_difference';
  expect(() => projectPublicationSafeWebsiteCheck(wrongComparison)).toThrow();
});

test('website publication projection requires the residual and unmeasured categories', () => {
  const noResidual = structuredClone(fixture);
  delete noResidual.residual;
  expect(() => projectPublicationSafeWebsiteCheck(noResidual)).toThrow();

  const badResidualState = structuredClone(fixture);
  badResidualState.residual.status = 'RESOLVED';
  expect(() => projectPublicationSafeWebsiteCheck(badResidualState)).toThrow();

  const noUnmeasured = structuredClone(fixture);
  noUnmeasured.notMeasured = [];
  expect(() => projectPublicationSafeWebsiteCheck(noUnmeasured)).toThrow();

  const duplicated = structuredClone(fixture);
  duplicated.notMeasured[1] = duplicated.notMeasured[0];
  expect(() => projectPublicationSafeWebsiteCheck(duplicated)).toThrow();

  const duplicateIds = structuredClone(fixture);
  duplicateIds.residual.id = duplicateIds.finding.id;
  expect(() => projectPublicationSafeWebsiteCheck(duplicateIds)).toThrow();
});
