import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = ['/', '/services/', '/work/', '/approach/', '/about/', '/contact/', '/privacy/', '/share/'];
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

test('production brand assets are used in header and footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header img[src*="logo-horizontal.svg"]')).toBeVisible();
  await expect(page.locator('footer img[src*="logo-horizontal-white.svg"]')).toBeVisible();
});

test('editable content layer renders richer home and service content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('You do not need to arrive with a technical specification.')).toBeVisible();
  await expect(page.locator('.trust-strip li')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'See selected work' })).toBeVisible();
  await expect(page.getByText('Nobody knows who owns this—or who still has access.', { exact: false })).toBeVisible();
  await expect(page.getByText('Least privilege, MFA, and recovery readiness')).toBeVisible();

  await page.goto('/services/');
  await expect(page.locator('.service-card')).toHaveCount(6);
  await expect(page.locator('.service-card').first().locator('.card__list li')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Digital Asset Ownership & Vendor Transitions' })).toBeVisible();
  await expect(page.getByText('Vendor offboarding, handoff, and recovery documentation')).toBeVisible();
  await expect(page.getByText('Secure credential-sharing setup when delegated access is not available')).toBeVisible();
  await expect(page.getByText('Untangle ownership, access, or a vendor transition')).toBeVisible();
});

test('work page distinguishes live work from active development', async ({ page }) => {
  await page.goto('/work/');
  await expect(page.locator('.work-card')).toHaveCount(3);
  await expect(page.locator('.status-pill--live')).toHaveCount(1);
  await expect(page.getByText('Active Development', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Document Control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure Exchange' })).toBeVisible();
  await expect(page.getByText('production infrastructure is not yet provisioned', { exact: false })).toBeVisible();
});

test('technology marks are served locally without third-party image requests', async ({ page }) => {
  await page.goto('/work/');
  const marks = page.locator('.technology-card img');
  await expect(marks).toHaveCount(5);
  const origins = await marks.evaluateAll(images => images.map(image => new URL(image.src).origin));
  const pageOrigin = new URL(page.url()).origin;
  expect(origins.every(origin => origin === pageOrigin)).toBeTruthy();
});

test('contact exposes aligned email and text-first business phone actions without a public form', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/contact/');
  const primaryEmailLink = page.locator('#main-content a[href="mailto:eddie@lowcountrydigitalworks.com"]').first();
  await expect(primaryEmailLink).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Text or Call Eddie' })).toBeVisible();

  const phoneCard = page.locator('#main-content article').filter({ has: page.getByRole('heading', { name: 'Text or Call Eddie' }) });
  const phoneActions = phoneCard.locator('.actions a');
  await expect(phoneActions).toHaveCount(2);
  await expect(phoneActions.nth(0)).toHaveAttribute('href', 'sms:+18436333123');
  await expect(phoneActions.nth(0)).toHaveText('Text 843-633-3123');
  await expect(phoneActions.nth(1)).toHaveAttribute('href', 'tel:+18436333123');
  await expect(phoneActions.nth(1)).toHaveText('Call 843-633-3123');
  await expect(phoneCard.locator('p.lede')).toHaveCount(0);

  const emailBox = await primaryEmailLink.boundingBox();
  const textBox = await phoneActions.nth(0).boundingBox();
  expect(emailBox).not.toBeNull();
  expect(textBox).not.toBeNull();
  expect(Math.abs((emailBox?.y ?? 0) - (textBox?.y ?? 0))).toBeLessThanOrEqual(2);

  const contactNotes = page.locator('#main-content .contact-card .meta-note');
  await expect(contactNotes).toHaveCount(2);
  const noteStyles = await contactNotes.evaluateAll(notes => notes.map(note => ({
    marginTop: parseFloat(getComputedStyle(note).marginTop),
    backgroundColor: getComputedStyle(note).backgroundColor,
  })));
  expect(noteStyles.every(style => style.marginTop >= 16)).toBeTruthy();
  expect(noteStyles.every(style => style.backgroundColor !== 'rgb(243, 239, 230)')).toBeTruthy();

  await expect(page.locator('form')).toHaveCount(0);

  await page.goto('/');
  await expect(page.locator('footer a[href="tel:+18436333123"]')).toHaveText('843-633-3123');
});

test('Secure Share presents the approved operational warnings and fixed same-origin CTA', async ({ page }) => {
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

test('mobile layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} should not overflow horizontally`).toBeFalsy();
  }
});

test('internal navigation targets resolve', async ({ page }) => {
  await page.goto('/');
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

test('service card headings remain compact at desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services/');
  const heading = page.locator('.card h2').first();
  await expect(heading).toBeVisible();
  const fontSize = await heading.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(23);
  expect(fontSize).toBeLessThanOrEqual(28.1);
});
