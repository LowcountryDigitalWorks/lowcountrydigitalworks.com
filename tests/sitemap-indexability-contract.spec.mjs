import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// This is a source/preview indexability contract, NOT Googlebot access or GSC indexing evidence.
// Derive the checked pages from the same canonical sitemap delivered to search engines.
const sitemapXml = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
const paths = sitemapUrls.map((url) => url.pathname);

test('the public sitemap is a unique set of intentional apex HTTPS routes', () => {
  expect(sitemapXml).toContain('<urlset');
  expect(sitemapUrls).toHaveLength(20);
  expect(new Set(paths).size).toBe(sitemapUrls.length);

  for (const url of sitemapUrls) {
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('lowcountrydigitalworks.com');
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
    expect(url.pathname).toMatch(/^\/(?:[a-z0-9-]+\/)*$/);
  }

  expect(paths).toContain('/services/');
  expect(paths).toContain('/services/websites/');
  expect(paths).toContain('/services/website-care/');
  expect(paths).not.toContain('/contact/');
  expect(paths).not.toContain('/discovery/');
  expect(paths).not.toContain('/share/');
});

for (const route of paths) {
  test(`public sitemap route ${route} responds with index-eligible HTML and its self-canonical`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);

    const headers = response.headers();
    expect(headers['content-type'] ?? '', route).toMatch(/text\/html/i);
    expect(headers['x-robots-tag'] ?? '', route).not.toMatch(/\bnoindex\b/i);

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://lowcountrydigitalworks.com${route}`,
    );

    for (const directive of await page.locator('meta[name="robots"], meta[name="googlebot"]').all()) {
      expect((await directive.getAttribute('content')) ?? '', route).not.toMatch(/\bnoindex\b/i);
    }
  });
}
