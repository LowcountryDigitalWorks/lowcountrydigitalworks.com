import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const routes = [
  '/',
  '/services/',
  '/about/',
  '/work/',
  '/work/document-control/',
  '/connect/',
  '/discovery/',
];

const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'mobile-375x667', width: 375, height: 667 },
];

const outRoot = path.join('test-results', 'coastal-v2c-visual-qa-slice3');
const manifest = [];

test.describe('WEB-162 coastal v2c slice 3 visual QA captures', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(outRoot, { recursive: true });
  });

  for (const route of routes) {
    for (const vp of viewports) {
      test(`${route} @ ${vp.name} has no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const response = await page.goto(route);
        expect(response?.ok()).toBeTruthy();
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect(overflows, `${route} overflow at ${vp.name}`).toBeFalsy();
        const slug = route === '/' ? 'home' : route.replace(/\//g, '_').replace(/^_|_$/g, '');
        const file = `${slug}--${vp.name}.png`;
        const filePath = path.join(outRoot, file);
        await page.screenshot({ path: filePath, fullPage: true });
        manifest.push({ route, viewport: vp.name, file });
      });
    }
  }

  test.afterAll(() => {
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), items: manifest }, null, 2));
  });
});
