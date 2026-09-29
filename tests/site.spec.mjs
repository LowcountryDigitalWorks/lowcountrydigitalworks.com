import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
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
  '/contact/',
  '/connect/',
  '/privacy/',
  '/share/',
];

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

test('production brand assets remain authoritative in header and footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header img[src*="logo-horizontal.svg"]')).toBeVisible();
  await expect(page.locator('footer img[src*="logo-horizontal-white.svg"]')).toBeVisible();
});

test('primary navigation reflects the accepted consultancy IA and keeps Secure Share separate', async ({ page }) => {
  await page.goto('/');
  const desktopLinks = page.locator('.desktop-nav > a');
  await expect(desktopLinks).toHaveCount(6);
  await expect(page.locator('.desktop-nav a[href="/services/"]')).toHaveText('Services');
  await expect(page.locator('.desktop-nav a[href="/work/"]')).toHaveText('Work');
  await expect(page.locator('.desktop-nav a[href="/approach/"]')).toHaveText('Approach');
  await expect(page.locator('.desktop-nav a[href="/about/"]')).toHaveText('About');
  await expect(page.locator('.desktop-nav a[href="/connect/"]').first()).toHaveText('Connect');
  await expect(page.locator('header a[href="/share/"]')).toHaveCount(0);
  await expect(page.locator('header a[href="/contact/"]')).toHaveCount(0);
});

test('services page presents four problem-led service families and detail routes', async ({ page }) => {
  await page.goto('/services/');
  await expect(page.locator('.service-family')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Websites & Website Care' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Systems & Automation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Digital Ownership & Platform Administration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Technology Consulting' })).toBeVisible();

  await page.goto('/services/business-systems-automation/');
  await expect(page.locator('article[itemtype="https://schema.org/Service"]')).toHaveCount(1);
  await expect(page.locator('[itemtype="https://schema.org/BreadcrumbList"]')).toHaveCount(1);
  await expect(page.getByText('configure', { exact: false })).toBeVisible();
  await expect(page.locator('.faq-item')).toHaveCount(3);
  await expect(page.getByText('Do you start by building custom software?')).toBeVisible();
  await expect(page.getByText('Will the automation become another system we have to maintain as the source of truth?')).toBeVisible();
});

test('homepage presents three customer-first entry paths without exposing gated discovery', async ({ page }) => {
  await page.goto('/');
  const pathways = page.locator('.pathway');
  await expect(pathways).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'I need a better website.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "We waste time doing this manually — or our tools don't work together." })).toBeVisible();
  await expect(page.getByRole('heading', { name: "I'm not sure what we own, what we need, or what should change." })).toBeVisible();
  await expect(page.locator('.pathway a[href="/services/websites/"]')).toHaveCount(1);
  await expect(page.locator('.pathway a[href="/services/business-systems-automation/"]')).toHaveCount(1);
  await expect(page.locator('.pathway a[href="/services/digital-ownership-platform-administration/"]')).toHaveCount(1);
  await expect(page.locator('.pathway a[href="/connect/"]')).toHaveCount(3);
  await expect(page.locator('#main-content form')).toHaveCount(0);
  await expect(page.locator('a[href*="suitedash"]')).toHaveCount(0);
});

test('work page shows four truthful evidence-oriented project entries', async ({ page }) => {
  await page.goto('/work/');
  await expect(page.locator('.work-row--large')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'G.A.S. Engine' })).toBeVisible();
  await expect(page.getByText('Internal service-enabling evidence infrastructure', { exact: true })).toBeVisible();
  await expect(page.getByText('customer SaaS', { exact: false })).toBeVisible();

  await page.goto('/work/gas-engine/');
  await expect(page.getByText('not customer SaaS', { exact: false })).toBeVisible();
  await expect(page.locator('.project-process__step')).toHaveCount(4);
  await expect(page.locator('.faq-item')).toHaveCount(2);
  await expect(page.getByText('Can a customer buy G.A.S. Engine as standalone software?')).toBeVisible();
  await expect(page.locator('.project-visual')).toHaveCount(1);
  await expect(page.locator('img[src="/work-assets/gas-engine-operator-view.jpg"]')).toBeVisible();
  await expect(page.getByText('Release 0.9 read-only synthetic operator case/report preview', { exact: false })).toBeVisible();

  await page.goto('/work/document-control/');
  await expect(page.getByText('It is not a production customer deployment', { exact: false })).toBeVisible();
  await expect(page.getByText('Is Document Control a finished DMS or eQMS that LDW is selling today?')).toBeVisible();
  await expect(page.locator('.project-visual')).toHaveCount(2);
  await expect(page.locator('img[src="/work-assets/document-control-overview.jpg"]')).toBeVisible();
  await expect(page.locator('img[src="/work-assets/document-control-workflow.jpg"]')).toBeVisible();

  await page.goto('/work/secure-exchange/');
  await expect(page.locator('.project-visual')).toHaveCount(2);
  await expect(page.locator('img[src="/work-assets/secure-exchange-intake.jpg"]')).toBeVisible();
  await expect(page.getByText('Synthetic staff work item demonstrating resolution', { exact: false })).toBeVisible();

  await page.goto('/work/lowcountry-digital-works-website/');
  await expect(page.locator('.project-visual')).toHaveCount(1);
  await expect(page.locator('img[src="/work-assets/ldw-website-home.jpg"]')).toBeVisible();
});

test('founder structure uses the owner-approved portrait and approved trust facts', async ({ page }) => {
  for (const route of ['/', '/about/']) {
    await page.goto(route);
    const portrait = page.locator('[data-founder-portrait]');
    await expect(portrait).toHaveCount(1);
    await expect(portrait).toHaveAttribute('src', '/founder/eddie-gugino-founder.webp');
    await expect(portrait).toHaveAttribute('alt', 'Eddie Gugino, founder of Lowcountry Digital Works');
    await expect(portrait).toHaveAttribute('width', '480');
    await expect(portrait).toHaveAttribute('height', '600');
    await portrait.scrollIntoViewIfNeeded();
    await expect.poll(async () => portrait.evaluate((img) => ({
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }))).toEqual({ complete: true, naturalWidth: 480, naturalHeight: 600 });
    await expect(page.locator('[data-owner-asset-pending="founder-photo"]')).toHaveCount(0);
  }

  await page.goto('/');
  await expect(page.locator('#main-content').getByText('Eddie Gugino', { exact: false })).toBeVisible();
  await expect(page.locator('#main-content').getByText('service in the U.S. Navy', { exact: false })).toBeVisible();

  await page.goto('/about/');
  await expect(page.locator('[itemtype="https://schema.org/Person"]')).toHaveCount(2);
  await expect(page.getByText('CISSP certification', { exact: false })).toBeVisible();
  await expect(page.getByText('Utica College', { exact: false })).toBeVisible();
  await expect(page.getByText('Midlands Technical College', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Coalfire');
  await expect(page.locator('body')).not.toContainText('security clearance');
});

test('Connect is a mobile-first stable contact destination with accessible contact-card and social iconography', async ({ page }) => {
  await page.goto('/connect/');
  const main = page.locator('#main-content');
  await expect(main.getByRole('heading', { level: 1, name: 'Eddie Gugino' })).toBeVisible();
  await expect(main.locator('a[href="sms:+18436333123"]')).toBeVisible();
  await expect(main.locator('a[href="tel:+18436333123"]')).toBeVisible();
  await expect(main.locator('a[href="mailto:eddie@lowcountrydigitalworks.com"]')).toBeVisible();
  await expect(main.locator('a[href="https://www.facebook.com/LowcountryDigitalWorks/"]')).toBeVisible();
  await expect(main.locator('a[href="https://x.com/LocoDW"]')).toBeVisible();
  const contactCard = main.locator('a[href="/eddie-gugino-lowcountry-digital-works.vcf"]');
  await expect(contactCard).toBeVisible();
  await expect(contactCard).toContainText('Contact card');
  await expect(main).not.toContainText('Save vCard');
  await expect(main.locator('.connect-actions .ui-icon')).toHaveCount(4);
  await expect(main.locator('.connect-links .ui-icon')).toHaveCount(2);
  await expect(main.locator('.ui-icon[aria-hidden="true"]')).toHaveCount(6);
  await expect(main.locator('form')).toHaveCount(0);

  const vcard = await page.request.get('/eddie-gugino-lowcountry-digital-works.vcf');
  expect(vcard.ok()).toBeTruthy();
  expect(await vcard.text()).toContain('FN:Eddie Gugino');
});

test('Contact and footer iconography supplements visible labels rather than replacing them', async ({ page }) => {
  await page.goto('/contact/');
  const main = page.locator('#main-content');
  await expect(main.getByRole('link', { name: /Text 843-633-3123/ })).toBeVisible();
  await expect(main.getByRole('link', { name: /Call 843-633-3123/ })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Facebook' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'X' })).toBeVisible();
  await expect(main.locator('.ui-icon[aria-hidden="true"]')).toHaveCount(5);

  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Facebook' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'X' })).toBeVisible();
  await expect(footer.locator('.ui-icon[aria-hidden="true"]')).toHaveCount(4);
});

test('verified public entity links are exposed with schema microdata and no unverified company LinkedIn', async ({ page }) => {
  await page.goto('/');
  const entity = page.locator('footer [itemtype="https://schema.org/ProfessionalService"]').first();
  await expect(entity).toHaveCount(1);
  await expect(entity.locator('a[itemprop="sameAs"]')).toHaveCount(2);
  await expect(entity.locator('a[href="https://www.facebook.com/LowcountryDigitalWorks/"]')).toHaveCount(1);
  await expect(entity.locator('a[href="https://x.com/LocoDW"]')).toHaveCount(1);
  await expect(page.locator('a[href*="linkedin.com/company"]')).toHaveCount(0);
});

test('page metadata includes canonical Open Graph and Twitter fields', async ({ page }) => {
  await page.goto('/services/websites/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/services/websites/');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Lowcountry Digital Works');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /Websites/);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /accessible/i);
});

test('technology marks are served locally without third-party image requests', async ({ page }) => {
  await page.goto('/work/');
  const marks = page.locator('.technology-card img');
  await expect(marks).toHaveCount(5);
  const origins = await marks.evaluateAll(images => images.map(image => new URL(image.src).origin));
  const pageOrigin = new URL(page.url()).origin;
  expect(origins.every(origin => origin === pageOrigin)).toBeTruthy();
});

test('contact keeps direct email text and phone actions without a public form', async ({ page }) => {
  await page.goto('/contact/');
  const main = page.locator('#main-content');
  await expect(main.locator('a[href="mailto:eddie@lowcountrydigitalworks.com"]')).toBeVisible();
  await expect(main.locator('a[href="sms:+18436333123"]')).toBeVisible();
  await expect(main.locator('a[href="tel:+18436333123"]')).toBeVisible();
  await expect(main.locator('form')).toHaveCount(0);
});

test('Secure Share preserves approved warnings and fixed same-origin CTA', async ({ page }) => {
  await page.goto('/share/');
  await expect(page.getByRole('heading', { level: 1, name: 'Share requested sensitive information.' })).toBeVisible();
  await expect(page.getByText('Non-regulated files specifically requested by Lowcountry Digital Works.')).toBeVisible();
  await expect(page.getByText('Medical records or protected health information (PHI).')).toBeVisible();
  await expect(page.getByText('Controlled Unclassified Information (CUI).')).toBeVisible();
  await expect(page.getByText('Payment-card information.')).toBeVisible();
  await expect(page.getByText(/government identifiers/)).toBeVisible();
  await expect(page.getByText('Any other regulated data.')).toBeVisible();
  await expect(page.getByText(/unrelated to a Lowcountry Digital Works request/)).toBeVisible();
  await expect(page.getByText('Maximum 10 files per submission.')).toBeVisible();
  await expect(page.getByText('Maximum 500 MB per file.')).toBeVisible();
  await expect(page.getByText("You'll continue to the Secure Share portal.")).toBeVisible();

  const cta = page.getByRole('link', { name: 'Continue to Secure Share' });
  await expect(cta).toHaveAttribute('href', '/share/continue');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,noarchive');
  await expect(page.locator('header a[href="/share/"]')).toHaveCount(0);
  await expect(page.locator('main a[href^="http://"], main a[href^="https://"]')).toHaveCount(0);
});

test('mobile layout has no horizontal overflow across all public and utility routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} should not overflow horizontally`).toBeFalsy();
  }
});

test('homepage internal navigation targets resolve', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')).filter(Boolean))]);
  for (const href of hrefs) {
    if (href === '/share/continue') continue;
    const response = await page.request.get(href);
    expect(response.ok(), `${href} should resolve`).toBeTruthy();
  }
});

test('sitemap includes expanded public routes and excludes Secure Share', async ({ page }) => {
  const response = await page.request.get('/sitemap.xml');
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  expect(xml).toContain('https://lowcountrydigitalworks.com/connect/');
  expect(xml).toContain('https://lowcountrydigitalworks.com/services/website-care/');
  expect(xml).toContain('https://lowcountrydigitalworks.com/work/gas-engine/');
  expect(xml).not.toContain('https://lowcountrydigitalworks.com/share');
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
