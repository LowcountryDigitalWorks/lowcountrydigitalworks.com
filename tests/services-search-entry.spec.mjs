import { test, expect } from '@playwright/test';

// These are truthful, source-level search presentation guards, not Google ranking/CTR assertions.
test('Services hub presents factual local service metadata without changing canonical or existing offerings', async ({ page }) => {
  const response = await page.goto('/services/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle('Website & Automation Services in Beaufort, SC | Lowcountry Digital Works');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Website projects and care, business systems and automation, digital ownership and platform administration, and technology consulting from Lowcountry Digital Works.',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/services/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Start with what your business needs to work better.' })).toBeVisible();
  await expect(page.locator('.service-family')).toHaveCount(4);
  await expect(page.locator('.service-family a[href="/services/websites/"]')).toHaveCount(1);
  await expect(page.locator('.service-family a[href="/services/website-care/"]')).toHaveCount(1);
  await expect(page.locator('.service-family a[href="/connect/"]')).toHaveCount(4);
});

test('Services metadata change does not overwrite accepted homepage search title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Websites & Business Systems in Beaufort, SC | Lowcountry Digital Works');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/');
});

test('Services retains four navigable choices at narrow mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/services/');
  await expect(page.locator('.service-family')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
