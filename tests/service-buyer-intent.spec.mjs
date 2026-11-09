import { test, expect } from '@playwright/test';

// Evidence-bound buyer-language guard; this is not an assertion of rankings or lead generation.
test('indexed Services hub explains operating web design and redesign scope without changing customer paths', async ({ page }) => {
  const response = await page.goto('/services/');
  expect(response?.ok()).toBeTruthy();

  const family = page.locator('.service-family').first();
  await expect(family.getByRole('heading', { name: 'Websites & Website Care' })).toBeVisible();
  await expect(family.locator('.service-family__body > p').last()).toHaveText(
    'Web design and website redesign for small businesses: clear, accessible pages, customer-owned assets, and bounded Website Care when needed.',
  );
  await expect(page.locator('.service-family')).toHaveCount(4);
  await expect(page.locator('.service-family a[href="/services/websites/"]')).toHaveCount(1);
  await expect(page.locator('.service-family a[href="/services/website-care/"]')).toHaveCount(1);
  await expect(page.locator('.service-family a[href="/connect/"]')).toHaveCount(4);
  await expect(page).toHaveTitle('Website & Automation Services in Beaufort, SC | Lowcountry Digital Works');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/services/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('new Services buyer description stays readable on a 360px mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/services/');
  const family = page.locator('.service-family').first();
  await expect(family.getByRole('heading', { name: 'Websites & Website Care' })).toBeVisible();
  await expect(family.locator('.service-family__body > p').last()).toContainText('website redesign');
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});
