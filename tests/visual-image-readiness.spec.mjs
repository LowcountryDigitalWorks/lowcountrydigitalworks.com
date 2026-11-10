import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Guard the rollout of original artwork and permissioned project screenshots.
// This checks delivery/accessibility *mechanics*, not whether an image's alt
// text is factually appropriate or whether a photograph has publication rights.
const xml = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const listedRoutes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
const routes = [...new Set([...listedRoutes, '/contact/', '/discovery/', '/share/'])];

test('visual asset audit enrolls each canonical sitemap route once', () => {
  expect(listedRoutes.length).toBeGreaterThanOrEqual(20);
  expect(new Set(listedRoutes).size).toBe(listedRoutes.length);
  expect(routes).toContain('/services/');
  expect(routes).toContain('/about/');
  expect(routes).toContain('/work/');
  expect(routes).toContain('/discovery/');
});

for (const route of routes) {
  test(`image readiness on ${route}: local delivery, alt attribute, explicit dimensions`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    const images = await page.locator('img').evaluateAll((nodes) => nodes.map((image) => {
      const candidates = (image.getAttribute('srcset') ?? '')
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean);
      return {
        source: image.getAttribute('src'),
        alt: image.getAttribute('alt'),
        width: image.getAttribute('width'),
        height: image.getAttribute('height'),
        candidates,
      };
    }));

    // Every route shares local brand assets; no empty or third-party image hosts.
    expect(images.length, `${route} should render its local brand imagery`).toBeGreaterThan(0);

    for (const image of images) {
      const context = `${route} — ${image.source ?? '(missing src)'}`;
      expect(image.alt, `${context}: img requires alt (empty is valid if decorative)`).not.toBeNull();
      expect(image.source, `${context}: img requires src`).toBeTruthy();
      for (const [attribute, value] of [['width', image.width], ['height', image.height]]) {
        expect(value, `${context}: reserve intrinsic ${attribute} to limit layout shift`).toMatch(/^[1-9]\d*$/);
      }

      // A locally controlled image is required for privacy, CSP consistency,
      // offline previews and predictable cache policy; no external hotlinks.
      for (const source of [image.source, ...image.candidates]) {
        expect(source, `${context}: image source must be local`).toMatch(/^\/(?!\/)/);
      }
    }
  });
}
