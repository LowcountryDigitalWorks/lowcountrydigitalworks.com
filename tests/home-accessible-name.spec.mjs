import { test, expect } from '@playwright/test';

test('homepage internal project text links preserve their visible label in the accessible name', async ({ page }) => {
  await page.goto('/');

  const links = page.locator('[data-home-internal-proof] .portfolio-card__body > a.text-link');
  await expect(links).toHaveCount(3);

  for (const link of await links.all()) {
    await expect(link).toContainText('Explore the work');
    await expect(link).toHaveAccessibleName(/^Explore the work — .+/);
  }
});
