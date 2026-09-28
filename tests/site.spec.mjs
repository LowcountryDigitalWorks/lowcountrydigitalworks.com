import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const marketingRoutes = [
  '/',
  '/services/',
  '/services/websites/',
  '/services/website-care/',
  '/services/business-systems-automation/',
  '/services/digital-ownership-platform-administration/',
  '/services/technology-consulting/',
  '/work/',
  '/work/lowcountry-digital-works-website/',
  '/work/document-control/',
  '/work/secure-exchange/',
  '/work/gas-engine/',
  '/approach/',
  '/about/',
  '/connect/',
  '/contact/',
  '/privacy/',
];
const routes = [...marketingRoutes, '/share/'];

for (const route of routes) {
  test(`${route} renders with landmarks and no serious accessibility violations`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => ['critical','serious'].includes(v.impact ?? ''))).toEqual([]);
  });
}

test('production brand, accepted navigation, and Connect CTA render', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header img[src*="logo-horizontal.svg"]')).toBeVisible();
  await expect(page.locator('footer img[src*="logo-horizontal-white.svg"]')).toBeVisible();
  const header = page.locator('header');
  for (const href of ['/services/','/work/','/approach/','/about/']) {
    await expect(header.locator(`a[href="${href}"]`)).toHaveCount(2);
  }
  await expect(header.locator('a[href="/connect/"]')).toHaveCount(4);
  await expect(header.locator('.nav-cta')).toHaveAttribute('href', '/connect/');
  await expect(header.locator('.mobile-nav__cta')).toHaveAttribute('href', '/connect/');
  await expect(header.locator('a[href="/share/"]')).toHaveCount(0);
});

test('homepage uses four problem-led pathways and evidence-oriented work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Practical. Maintainable. Yours.')).toBeVisible();
  await expect(page.locator('.service-pathway')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Websites & Website Care' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Business Systems & Automation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Digital Ownership & Platform Administration' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Technology Consulting' })).toBeVisible();
  await expect(page.locator('.project-teaser')).toHaveCount(2);
  await expect(page.getByText('Evidence over adjectives.')).toBeVisible();
  await expect(page.getByText('Owner-selected photo required before production.')).toBeVisible();
});

test('service directory exposes five substantive detail routes', async ({ page }) => {
  await page.goto('/services/');
  await expect(page.locator('.service-row')).toHaveCount(5);
  for (const name of [
    'Websites',
    'Website Care',
    'Business Systems & Automation',
    'Digital Ownership & Platform Administration',
    'Technology Consulting',
  ]) {
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }

  await page.goto('/services/business-systems-automation/');
  await expect(page.locator('[itemtype="https://schema.org/Service"]')).toHaveCount(1);
  await expect(page.locator('[itemtype="https://schema.org/BreadcrumbList"]')).toHaveCount(1);
  await expect(page.getByText('configuration and integration cannot solve well', { exact: false })).toBeVisible();
});

test('work page distinguishes live, development, and internal infrastructure', async ({ page }) => {
  await page.goto('/work/');
  await expect(page.locator('.project-row')).toHaveCount(4);
  await expect(page.locator('.status-pill--live')).toHaveCount(1);
  await expect(page.locator('.project-row .status-pill').filter({ hasText: 'Active Development' })).toHaveCount(2);
  await expect(page.locator('.project-row .status-pill').filter({ hasText: 'Internal Infrastructure' })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Document Control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure Exchange' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'G.A.S. Engine' })).toBeVisible();

  await page.goto('/work/gas-engine/');
  await expect(page.getByText('Not customer SaaS', { exact: false })).toBeVisible();
  await expect(page.getByText('not a self-service SEO platform', { exact: false })).toBeVisible();
});

test('public-safe LDW project screenshot is served same-origin', async ({ page }) => {
  await page.goto('/work/lowcountry-digital-works-website/');
  const image = page.locator('.project-detail-visual img');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', '/work/ldw-site-home.png');
  expect(await image.evaluate(node => new URL(node.src).origin)).toBe(new URL(page.url()).origin);
  await expect(image).toHaveAttribute('alt', /Lowcountry Digital Works public website homepage/);
});

test('technology marks are served locally without third-party image requests', async ({ page }) => {
  await page.goto('/work/');
  const marks = page.locator('.technology-card img');
  await expect(marks).toHaveCount(5);
  const origins = await marks.evaluateAll(images => images.map(image => new URL(image.src).origin));
  const pageOrigin = new URL(page.url()).origin;
  expect(origins.every(origin => origin === pageOrigin)).toBeTruthy();
});

test('About exposes founder semantics but preserves owner-review gate', async ({ page }) => {
  await page.goto('/about/');
  const founder = page.locator('#eddie-gugino[itemtype="https://schema.org/Person"]');
  await expect(founder).toHaveCount(1);
  await expect(founder.getByText('Eddie Gugino', { exact: true })).toBeVisible();
  await expect(founder.locator('[itemprop="jobTitle"]')).toHaveText('Founder');
  await expect(page.getByText('Owner-selected photo required before production.')).toBeVisible();
  await expect(page.getByText('final biography wording require owner approval', { exact: false })).toBeVisible();
});

test('Connect is a stable mobile-friendly contact destination with verified socials', async ({ page }) => {
  await page.goto('/connect/');
  await expect(page.getByRole('heading', { level: 1, name: 'Eddie Gugino' })).toBeVisible();
  await expect(page.locator('#main-content a[href="sms:+18436333123"]')).toBeVisible();
  await expect(page.locator('#main-content a[href="tel:+18436333123"]')).toBeVisible();
  await expect(page.locator('#main-content a[href="mailto:eddie@lowcountrydigitalworks.com"]')).toBeVisible();
  await expect(page.locator('a[href="/lowcountry-digital-works.vcf"]')).toHaveAttribute('download', '');
  await expect(page.locator('#main-content a[href="https://www.facebook.com/LowcountryDigitalWorks/"]')).toBeVisible();
  await expect(page.locator('#main-content a[href="https://x.com/LocoDW"]')).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('a[href="/share/"]')).toHaveCount(0);
});

test('contact exposes email, text, call, Connect, and safety notes without a form', async ({ page }) => {
  await page.goto('/contact/');
  await expect(page.locator('#main-content a[href="mailto:eddie@lowcountrydigitalworks.com"]').first()).toBeVisible();
  await expect(page.locator('#main-content a[href="sms:+18436333123"]')).toHaveText('Text 843-633-3123');
  await expect(page.locator('#main-content a[href="tel:+18436333123"]')).toHaveText('Call 843-633-3123');
  await expect(page.getByRole('link', { name: 'Open Connect' })).toHaveAttribute('href', '/connect/');
  await expect(page.locator('#main-content .meta-note')).toHaveCount(2);
  await expect(page.locator('form')).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('footer a[href="tel:+18436333123"]')).toHaveText('843-633-3123');
});

test('business entity and social metadata use verified public identity', async ({ page }) => {
  await page.goto('/');
  const entity = page.locator('footer[itemtype="https://schema.org/ProfessionalService"]');
  await expect(entity).toHaveCount(1);
  await expect(entity.locator('[itemprop="sameAs"][href="https://www.facebook.com/LowcountryDigitalWorks/"]')).toHaveCount(1);
  await expect(entity.locator('[itemprop="sameAs"][href="https://x.com/LocoDW"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Lowcountry Digital Works');
  await expect(page.locator('meta[name="twitter:site"]')).toHaveAttribute('content', '@LocoDW');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});

test('Secure Share preserves approved operational warnings and fixed same-origin CTA', async ({ page }) => {
  await page.goto('/share/');
  await expect(page.getByRole('heading', { level: 1, name: 'Share requested sensitive information.' })).toBeVisible();
  await expect(page.getByText('Medical records or protected health information (PHI).')).toBeVisible();
  await expect(page.getByText('Controlled Unclassified Information (CUI).')).toBeVisible();
  await expect(page.getByText('Payment-card information.')).toBeVisible();
  await expect(page.getByText('Any other regulated data.')).toBeVisible();
  const cta = page.getByRole('link', { name: 'Continue to Secure Share' });
  await expect(cta).toHaveAttribute('href', '/share/continue');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,noarchive');
  await expect(page.locator('header a[href="/share/"]')).toHaveCount(0);
  await expect(page.locator('main a[href^="http://"], main a[href^="https://"]')).toHaveCount(0);
});

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} should not overflow horizontally`).toBeFalsy();
  }
});

test('all marketing routes are linked or resolve directly and public links are healthy', async ({ page }) => {
  await page.goto('/');
  for (const route of marketingRoutes) {
    const response = await page.request.get(route);
    expect(response.ok(), `${route} should resolve`).toBeTruthy();
  }
  const hrefs = await page.locator('a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')).filter(Boolean))]);
  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.ok(), `${href} should resolve`).toBeTruthy();
  }
});

test('Manrope is delivered locally and used as the lead interface font', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const fontState = await page.evaluate(() => ({
    bodyFamily: getComputedStyle(document.body).fontFamily,
    manropeAvailable: document.fonts.check('16px "Manrope Variable"', 'Lowcountry Digital Works'),
    fontOrigins: performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => /\.(woff2?|ttf|otf)(\?|$)/i.test(name))
      .map(name => new URL(name).origin),
    pageOrigin: location.origin,
  }));
  expect(fontState.bodyFamily).toContain('Manrope Variable');
  expect(fontState.manropeAvailable).toBeTruthy();
  expect(fontState.fontOrigins.length).toBeGreaterThan(0);
  expect(fontState.fontOrigins.every(origin => origin === fontState.pageOrigin)).toBeTruthy();
});

test('service directory headings remain scannable at desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services/');
  const heading = page.locator('.service-row h2').first();
  await expect(heading).toBeVisible();
  const fontSize = await heading.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(26);
  expect(fontSize).toBeLessThanOrEqual(38);
});
