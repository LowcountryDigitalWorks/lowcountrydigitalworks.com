import { test, expect } from '@playwright/test';

// Search Console evidence supports a bounded presentation experiment, not a ranking or CTR claim.
test('homepage carries a descriptive truthful search entry without altering its canonical or first-party identity', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle('Websites & Business Systems in Beaufort, SC | Lowcountry Digital Works');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Owner-operated websites, website care, business automation, and digital ownership for Beaufort and Lowcountry businesses. Work directly with Eddie on your next step.',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('[itemscope][itemtype="https://schema.org/WebSite"]')).toHaveCount(1);
  await expect(page.locator('[itemscope][itemtype="https://schema.org/WebSite"] meta[itemprop="name"]')).toHaveAttribute('content', 'Lowcountry Digital Works');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Talk through your project' }).first()).toHaveAttribute('href', '/discovery/');
});

test('other buyer-entry route titles and canonicals remain separate', async ({ page }) => {
  const response = await page.goto('/connect/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle('Connect | Lowcountry Digital Works');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/connect/');
});

test('home search-entry copy remains usable on narrow mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  const dimension = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
  }));
  expect(dimension.width).toBeLessThanOrEqual(dimension.viewport);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Talk through your project' }).first()).toBeVisible();
});
