import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/services/', '/approach/', '/about/', '/contact/', '/privacy/'];
for (const route of routes) {
  test(`${route} renders with landmarks and no serious accessibility violations`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => ['critical','serious'].includes(v.impact ?? ''))).toEqual([]);
  });
}

test('production brand assets are used in header and footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header img[src*="logo-horizontal.svg"]')).toBeVisible();
  await expect(page.locator('footer img[src*="logo-horizontal-white.svg"]')).toBeVisible();
});

test('contact is email-only and exposes no public form', async ({ page }) => {
  await page.goto('/contact/');
  const primaryEmailLink = page.locator('#main-content a[href="mailto:eddie@lowcountrydigitalworks.com"]').first();
  await expect(primaryEmailLink).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} should not overflow horizontally`).toBeFalsy();
  }
});

test('internal navigation targets resolve', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')).filter(Boolean))]);
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.ok(), `${href} should resolve`).toBeTruthy();
  }
});

test('Manrope is delivered locally and used as the lead interface font', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const fontState = await page.evaluate(() => ({
    bodyFamily: getComputedStyle(document.body).fontFamily,
    manropeAvailable: document.fonts.check('16px "Manrope Variable"', 'Lowcountry Digital Works'),
    fontOrigins: performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => /\.(woff2?|ttf|otf)(\?|$)/i.test(name))
      .map(name => new URL(name).origin),
    pageOrigin: location.origin,
  }));
  expect(fontState.bodyFamily).toContain('Manrope Variable');
  expect(fontState.manropeAvailable).toBeTruthy();
  expect(fontState.fontOrigins.length).toBeGreaterThan(0);
  expect(fontState.fontOrigins.every(origin => origin === fontState.pageOrigin)).toBeTruthy();
});

test('service card headings remain compact at desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services/');
  const heading = page.locator('.card h2').first();
  await expect(heading).toBeVisible();
  const fontSize = await heading.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(23);
  expect(fontSize).toBeLessThanOrEqual(28.1);
});
