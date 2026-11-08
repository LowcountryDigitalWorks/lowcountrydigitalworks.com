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
  observedZero.finding.recheck = 'Same-source remeasurement observed 0 remaining static-assets-short-cache findings.';
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


test('publication rejects accessor-backed records and coverage lists before executing getters', () => {
  for (const path of ['source', 'finding.summary', 'residual.summary', 'notMeasured.0']) {
    const changed = structuredClone(fixture);
    const [record, key] = path === 'notMeasured.0'
      ? [changed.notMeasured, '0']
      : path.startsWith('finding.') ? [changed.finding, 'summary']
      : path.startsWith('residual.') ? [changed.residual, 'summary']
      : [changed, 'source'];
    let getterCalls = 0;
    Object.defineProperty(record, key, {
      enumerable: true,
      configurable: true,
      get() { getterCalls += 1; return 'Spoofed source data'; },
    });
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
    expect(getterCalls).toBe(0);
  }

  const nonPlain = structuredClone(fixture);
  Object.setPrototypeOf(nonPlain.finding, { inherited: 'not public' });
  expect(() => projectPublicationSafeWebsiteCheck(nonPlain)).toThrow();

  const extraArrayField = structuredClone(fixture);
  extraArrayField.notMeasured.internalField = 'private';
  expect(() => projectPublicationSafeWebsiteCheck(extraArrayField)).toThrow();

  const sparse = structuredClone(fixture);
  delete sparse.notMeasured[1];
  expect(() => projectPublicationSafeWebsiteCheck(sparse)).toThrow();
});

test('publication rejects contact, URL, markup, invisible Unicode, controls and unsupported narratives', () => {
  const unsafeTexts = [
    'https://example.invalid/private',
    'http://example.invalid/',
    '//host.example',
    'www.example.invalid',
    'mailto:example',
    'vbscript:message',
    'user:pass@host',
    'contact@example.invalid',
    '192.168.1.1',
    '<script>alert(1)</script>',
    '<a href=example>click</a>',
    'text\u202eetadpu',
    'text\u200bhidden',
    'text\u0085hidden',
    'text\u2028hidden',
    'text\ud800',
    'line\nline',
    'x'.repeat(601),
    '   ',
    ' Leading space',
  ];
  for (const value of unsafeTexts) {
    const changed = structuredClone(fixture);
    changed.coverage = value;
    expect(() => projectPublicationSafeWebsiteCheck(changed), JSON.stringify(value)).toThrow();
  }
  const tooLongOwner = structuredClone(fixture);
  tooLongOwner.finding.owner = 'x'.repeat(121);
  expect(() => projectPublicationSafeWebsiteCheck(tooLongOwner)).toThrow();
  const empty = structuredClone(fixture);
  empty.residual.title = '';
  expect(() => projectPublicationSafeWebsiteCheck(empty)).toThrow();
});

test('publication enforces bounded IDs, counts, coverage and both explicit owners', () => {
  for (const id of ['bad_id', 'A', 'a'.repeat(81), 'missing source', '']) {
    const changed = structuredClone(fixture);
    changed.finding.id = id;
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }
  for (const count of [100_001, Number.MAX_SAFE_INTEGER, -1, 0.25, '11']) {
    const changed = structuredClone(fixture);
    changed.finding.beforeCount = count;
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }
  const tooMany = structuredClone(fixture);
  tooMany.notMeasured = Array.from({ length: 13 }, (_, i) => `Unmeasured area ${i}`);
  expect(() => projectPublicationSafeWebsiteCheck(tooMany)).toThrow();

  for (const ownerPath of ['finding', 'residual']) {
    const changed = structuredClone(fixture);
    delete changed[ownerPath].owner;
    expect(() => projectPublicationSafeWebsiteCheck(changed)).toThrow();
  }
});

test('publication proves structured counts and recheck text cannot contradict the reduction narrative', () => {
  const changedCount = structuredClone(fixture);
  changedCount.finding.afterCount = 5;
  expect(() => projectPublicationSafeWebsiteCheck(changedCount)).toThrow();

  const inverted = structuredClone(fixture);
  inverted.finding.beforeCount = 1;
  inverted.finding.afterCount = 11;
  inverted.finding.recheck = 'Same-source remeasurement observed 11 remaining static-assets-short-cache findings.';
  expect(() => projectPublicationSafeWebsiteCheck(inverted)).toThrow();

  const unchanged = structuredClone(fixture);
  unchanged.finding.afterCount = unchanged.finding.beforeCount;
  unchanged.finding.recheck = 'Same-source remeasurement observed 11 remaining static-assets-short-cache findings.';
  expect(() => projectPublicationSafeWebsiteCheck(unchanged)).toThrow();

  const mismatchedWording = structuredClone(fixture);
  mismatchedWording.finding.recheck = 'Same-source remeasurement observed 5 remaining static-assets-short-cache findings.';
  expect(() => projectPublicationSafeWebsiteCheck(mismatchedWording)).toThrow();
});

test('publication does not alias mutable input records or arrays', () => {
  const input = structuredClone(fixture);
  const view = projectPublicationSafeWebsiteCheck(input);
  expect(view).not.toBe(input);
  expect(view.finding).not.toBe(input.finding);
  expect(view.residual).not.toBe(input.residual);
  expect(view.notMeasured).not.toBe(input.notMeasured);
  input.notMeasured[0] = 'Changed after validation';
  input.finding.title = 'Changed after validation';
  expect(view.notMeasured[0]).toBe(fixture.notMeasured[0]);
  expect(view.finding.title).toBe(fixture.finding.title);
  expect(() => view.notMeasured.push('Mutated')).toThrow();
});
