import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const serviceDetails = JSON.parse(readFileSync(new URL('../src/data/service-details.json', import.meta.url), 'utf8'));

const cases = [
  {
    slug: 'websites',
    heading: 'Websites',
    title: 'Website Design & Modernization in Beaufort, SC | Lowcountry Digital Works',
    description: 'Website design and modernization for Beaufort and Lowcountry businesses, with accessible pages, maintainable technology, and clear ownership and handoff.',
  },
  {
    slug: 'website-care',
    heading: 'Website Care',
    title: 'Website Maintenance & Care in Beaufort, SC | Lowcountry Digital Works',
    description: 'Website maintenance for Beaufort and Lowcountry businesses: planned fixes, accessibility and performance checks, and security upkeep within an agreed scope.',
  },
  {
    slug: 'business-systems-automation',
    heading: 'Business Systems & Automation',
    title: 'Business Workflow Automation in Beaufort, SC | Lowcountry Digital Works',
    description: 'Improve repetitive business workflows using existing tools, supported integrations, APIs, and focused automation when a real operational gap remains.',
  },
  {
    slug: 'digital-ownership-platform-administration',
    heading: 'Digital Ownership & Platform Administration',
    title: 'Domain & Platform Administration in Beaufort, SC | Lowcountry Digital Works',
    description: 'Clarify domain and website ownership, provider access, recovery, vendor handoff, and platform administration without unnecessary vendor dependence.',
  },
  {
    slug: 'technology-consulting',
    heading: 'Technology Consulting',
    title: 'IT Consulting & Technology Planning in Beaufort, SC | Lowcountry Digital Works',
    description: 'Practical IT consulting for Beaufort and Lowcountry businesses: troubleshoot systems, compare platforms, and plan around security, cost, and maintainability.',
  },
];

// These are factual service descriptions, not volume-validated keywords or a ranking claim.
test('every offered service has exactly one distinct, bounded search intent', () => {
  expect(cases.map((service) => service.slug).sort()).toEqual(serviceDetails.map((service) => service.slug).sort());
  expect(new Set(cases.map((service) => service.title)).size).toBe(cases.length);
  expect(new Set(cases.map((service) => service.description)).size).toBe(cases.length);
  for (const service of cases) {
    expect(service.description).not.toMatch(/24\/7|guaranteed results|guaranteed ranking|free consultation|#1 agency/i);
  }
});

for (const service of cases) {
  test(`service ${service.slug} has accurate search metadata without altering its visitor-facing identity`, async ({ page }) => {
    const path = `/services/${service.slug}/`;
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();

    await expect(page).toHaveTitle(service.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', service.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://lowcountrydigitalworks.com${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: service.heading })).toBeVisible();
    await expect(page.locator('article[itemtype="https://schema.org/Service"]')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Talk through your situation' })).toHaveAttribute('href', '/connect/');
    await expect(page.locator('.outcome-card').first()).toBeVisible();
  });
}

test('the existing Services hub still links to every distinct service and retains its approved title', async ({ page }) => {
  await page.goto('/services/');
  await expect(page).toHaveTitle('Website & Automation Services in Beaufort, SC | Lowcountry Digital Works');
  for (const service of cases) {
    await expect(page.locator(`a[href="/services/${service.slug}/"]`).first()).toBeVisible();
  }
  await expect(page.locator('.service-family')).toHaveCount(4);
});

test('Website Care remains readable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/services/website-care/');
  await expect(page.getByRole('heading', { level: 1, name: 'Website Care' })).toBeVisible();
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});
