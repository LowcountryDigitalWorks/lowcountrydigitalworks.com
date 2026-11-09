import { test, expect } from '@playwright/test';

// The accepted public brand is not the legal entity name. Keep one Organization
// identity and add the LLC name to that same microdata node, not another graph.
for (const route of ['/', '/services/', '/about/', '/contact/']) {
  test(`accepted Organization legal identity stays consistent on ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);

    const organizations = page.locator('[itemscope][itemtype="https://schema.org/Organization"]');
    await expect(organizations).toHaveCount(1);
    const organization = organizations.first();
    await expect(organization).toHaveAttribute(
      'itemid',
      'https://lowcountrydigitalworks.com/#organization',
    );
    await expect(organization.locator('strong[itemprop="name"]')).toHaveText('Lowcountry Digital Works');
    await expect(organization.locator('meta[itemprop="legalName"]')).toHaveAttribute(
      'content',
      'Lowcountry Digital Works LLC',
    );
    await expect(organization.locator('[itemprop="url"]')).toHaveAttribute('href', '/');
    await expect(organization.locator('[itemprop="founder"] [itemprop="name"]')).toHaveCount(1);

    // Legal-name microdata does not create a second public brand, organization,
    // testimonial, price, tracking pixel, script or hidden sales claim.
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });
}
