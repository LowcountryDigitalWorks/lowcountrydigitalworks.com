import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sample = JSON.parse(await readFile(new URL('../src/data/local-visibility-sample.json', import.meta.url), 'utf8'));

// These are the EXECUTED source coordinates in gas-engine#97 comment 6323404852.
// The earlier candidate geometry has slightly different west/east longitudes.
const executedPoints = [
  ['BPR-NW', '32.440300', '-80.728462'],
  ['BPR-NC', '32.440300', '-80.689062'],
  ['BPR-NE', '32.440300', '-80.649662'],
  ['BPR-CW', '32.407406', '-80.728462'],
  ['BPR-CC', '32.407406', '-80.689062'],
  ['BPR-CE', '32.407406', '-80.649662'],
  ['BPR-SW', '32.374511', '-80.728462'],
  ['BPR-SC', '32.374511', '-80.689062'],
  ['BPR-SE', '32.374511', '-80.649662'],
];

test('local map fixture preserves exact executed source points and non-rank absence semantics', () => {
  expect(sample.schema).toBe('ldw.evidence-local-sample-presentation.v1');
  expect(sample.observationDate).toBe('2026-10-21');
  expect(sample.source).toBe('DataForSEO');
  expect(sample.surface).toBe('Google Maps');
  expect(sample.method).toEqual({
    query: 'website designer',
    priority: 'Standard / normal',
    language: 'en',
    device: 'desktop',
    os: 'Windows',
    depth: 100,
    zoom: '14z',
    searchPlaces: false,
    searchThisArea: true,
  });
  expect(sample.points.map((p) => [p.id, p.latitude, p.longitude])).toEqual(executedPoints);
  expect(new Set(sample.points.map((p) => p.id)).size).toBe(9);
  for (const point of sample.points) {
    expect(point.observationState).toBe('complete');
    expect(point.targetState).toBe('not_found_in_returned_set');
    expect(point.nativeRank).toBeNull();
  }
  expect(sample.costStatement).toContain('$0.0054');
  expect(sample.limitations.length).toBeGreaterThanOrEqual(4);
});

test('rendered local map is historical, exact-point, no scan, no index, and nine-point complete', async ({ page }) => {
  const externalRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4321') externalRequests.push(request.url());
  });

  await page.goto('/local-visibility-sample/');
  await expect(page.getByRole('heading', { name: 'Local Visibility Map', level: 1 })).toBeVisible();
  await expect(page.getByText(sample.label, { exact: true })).toBeVisible();
  await expect(page.getByText(sample.intent, { exact: false })).toBeVisible();
  await expect(page.getByText('This is not a live check.', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Not found is not rank zero.', { exact: false })).toBeVisible();

  const cells = page.locator('[data-point]');
  await expect(cells).toHaveCount(9);
  for (const [id, lat, lon] of executedPoints) {
    const cell = page.locator(`[data-point="${id}"]`);
    await expect(cell).toHaveAttribute('data-state', 'not_found_in_returned_set');
    await expect(cell.getByText(`${lat}, ${lon}`)).toBeVisible();
    await expect(cell.getByText('Not found in returned set')).toBeVisible();
  }

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Start a project conversation/ })).toHaveAttribute('href', '/discovery/');
  const sitemap = await page.request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toContain('/local-visibility-sample/');
  expect(externalRequests).toEqual([]);
});

test('non-map equivalent exposes every exact coordinate and unavailable rank without color-only evidence', async ({ page }) => {
  await page.goto('/local-visibility-sample/');
  await page.getByText('View every exact point and its evidence state in a table').click();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(9);
  for (const [id, lat, lon] of executedPoints) {
    const row = page.locator(`[data-table-point="${id}"]`);
    await expect(row.getByText(lat, { exact: true })).toBeVisible();
    await expect(row.getByText(lon, { exact: true })).toBeVisible();
    await expect(row.getByText('Not found in returned set')).toBeVisible();
    await expect(row.getByText('Not observed')).toBeVisible();
  }
});

test('local map has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/local-visibility-sample/');
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('local map remains page-overflow-free at 320px mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/local-visibility-sample/');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator('[data-point]')).toHaveCount(9);
  await page.getByText('View every exact point and its evidence state in a table').click();
  await expect(page.getByRole('table')).toBeVisible();
  const afterTable = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(afterTable.content).toBeLessThanOrEqual(afterTable.viewport);
});
