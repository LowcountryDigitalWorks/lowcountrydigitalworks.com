import { test, expect } from '@playwright/test';

test('homepage offers the existing Website Care route without altering the four problem choices', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();

  await expect(page.locator('.problem-choice')).toHaveCount(4);
  await expect(page.locator('.problem-choice[href="/services/websites/"]')).toHaveCount(1);
  await expect(page.locator('.problem-choice[href="/services/business-systems-automation/"]')).toHaveCount(1);
  await expect(page.locator('.problem-choice[href="/services/digital-ownership-platform-administration/"]')).toHaveCount(1);
  await expect(page.locator('.problem-choice[href="/discovery/"]')).toHaveCount(1);

  const careLink = page.locator('[data-home-website-care] a[href="/services/website-care/"]');
  await expect(careLink).toHaveCount(1);
  await expect(careLink).toHaveText('Explore Website Care →');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/');
  await expect(page.locator('#main-content form, #main-content iframe')).toHaveCount(0);

  await careLink.click();
  await expect(page).toHaveURL(/\/services\/website-care\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Website Care' })).toBeVisible();
});
