import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Existing lead path only: do not dial/text, record visitor data, or infer conversions.
const contact = JSON.parse(readFileSync(new URL('../src/data/contact.json', import.meta.url), 'utf8'));
const services = JSON.parse(readFileSync(new URL('../src/data/service-details.json', import.meta.url), 'utf8'));
const paths = ['/services/', ...services.map(({ slug }) => `/services/${slug}/`)];

test('the mobile conversion sample covers the indexed hub and every operating service route', () => {
  expect(services).toHaveLength(5);
  expect(new Set(paths).size).toBe(6);
  expect(contact.phone.number).toMatch(/^\+1\d{10}$/);
});

for (const route of paths) {
  test(`${route} preserves one-tap call and text paths on a narrow phone`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();

    const quickContact = page.getByRole('navigation', { name: 'Quick contact' });
    await expect(quickContact).toHaveCount(1);
    await expect(quickContact).toBeVisible();
    await expect(quickContact).toHaveCSS('position', 'fixed');

    const call = quickContact.getByRole('link', { name: `Call Eddie at ${contact.phone.display}` });
    const text = quickContact.getByRole('link', { name: `Text Eddie at ${contact.phone.display}` });
    await expect(call).toHaveAttribute('href', `tel:${contact.phone.number}`);
    await expect(text).toHaveAttribute('href', `sms:${contact.phone.number}`);
    await expect(call).toBeVisible();
    await expect(text).toBeVisible();

    // Lighthouse surfaced a hidden-weight axe 4.14 Label in Name failure even
    // when the overall accessibility score was 100. The visible words must be
    // separated in DOM text (not only by CSS flex gap) so each complete label
    // remains a substring of its longer spoken aria-label.
    expect((await text.textContent())?.replace(/\s+/g, ' ').trim()).toBe('Text Eddie');
    expect((await call.textContent())?.replace(/\s+/g, ' ').trim()).toBe('Call Eddie');
    const labelAudit = await new AxeBuilder({ page })
      .withRules(['label-content-name-mismatch'])
      .analyze();
    expect(labelAudit.violations, route + ': mobile Label in Name failures').toEqual([]);

    const callBox = await call.boundingBox();
    const textBox = await text.boundingBox();
    expect(callBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(textBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // This tests the offered interaction, not a completed phone call or lead.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://lowcountrydigitalworks.com${route}`,
    );
  });
}

test('Connect keeps its own call action without a duplicate mobile quick-contact bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/connect/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('navigation', { name: 'Quick contact' })).toHaveCount(0);
  await expect(page.locator('#main-content a.connect-action[href^="tel:"]')).toHaveAttribute(
    'href',
    `tel:${contact.phone.number}`,
  );
});

test('the mobile contact bar stays hidden at desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/services/');
  await expect(page.getByRole('navigation', { name: 'Quick contact' })).toBeHidden();
});
