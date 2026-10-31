import { test, expect } from '@playwright/test';

const QUICK_REQUEST_URL = 'https://getaiform.com/r/LiY9XI9qKE';
const DETAILED_DISCOVERY_URL = 'https://getaiform.com/r/XAqAsatn7H';

test('project discovery makes the quick request primary while preserving optional detailed discovery', async ({ page }) => {
  const response = await page.goto('/discovery/');
  expect(response?.ok()).toBeTruthy();

  await expect(page.getByRole('heading', { level: 1, name: /Starting from scratch is fine too/i })).toBeVisible();
  await expect(page.getByText('About 2 minutes. The request opens in a new tab.')).toBeVisible();
  await expect(page.getByText(/The longer questionnaire is still available, but it is optional/i)).toBeVisible();
  await expect(page.getByText(/We only ask for a phone number if you choose call or text/i)).toBeVisible();
  await expect(page.getByText(/If you're starting fresh, a domain or business-name idea is enough/i)).toBeVisible();
  await expect(page.getByText(/what already exists or what you're starting from scratch/i)).toBeVisible();

  const quickLinks = page.getByRole('link', { name: /quick (project )?request/i });
  await expect(quickLinks).toHaveCount(2);
  for (const link of await quickLinks.all()) {
    await expect(link).toHaveAttribute('href', QUICK_REQUEST_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  }

  const detailedLinks = page.getByRole('link', { name: /detailed project questions/i });
  await expect(detailedLinks).toHaveCount(2);
  for (const link of await detailedLinks.all()) {
    await expect(link).toHaveAttribute('href', DETAILED_DISCOVERY_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  }

  await expect(page.locator('iframe, main form')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
});
