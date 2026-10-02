import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/',
  '/accessibility/',
  '/services/',
  '/services/websites/',
  '/services/website-care/',
  '/services/business-systems-automation/',
  '/services/digital-ownership-platform-administration/',
  '/services/technology-consulting/',
  '/work/',
  '/work/document-control/',
  '/work/secure-exchange/',
  '/work/gas-engine/',
  '/approach/',
  '/about/',
  '/guides/',
  '/guides/website-maintenance-after-launch/',
  '/guides/website-ownership-handoff/',
  '/contact/',
  '/connect/',
  '/privacy/',
  '/terms/',
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
  await expect(page.locator('.desktop-nav a[href="/guides/"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/guides/"]')).toHaveText('Guides');
});

test('services page presents four problem-led service families and detail routes', async ({ page }) => {
  await page.goto('/services/');
  await expect(page.locator('.service-family')).toHaveCount(4);
  await expect(page.locator('.service-choice__prompt')).toHaveCount(4);
  await expect(page.locator('.service-family__icon .ui-icon')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1, name: 'Start with what your business needs to work better.' })).toBeVisible();
  await expect(page.getByText('Our website feels dated, confusing, hard to maintain', { exact: false })).toBeVisible();
  await expect(page.getByText('We keep repeating the same work', { exact: false })).toBeVisible();
  await expect(page.locator('.service-family a[href="/connect/"]')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Websites & Website Care' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Systems & Automation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Digital Ownership & Platform Administration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Technology Consulting' })).toBeVisible();

  await page.goto('/services/business-systems-automation/');
  await expect(page.locator('article[itemtype="https://schema.org/Service"]')).toHaveCount(1);
  await expect(page.locator('[itemtype="https://schema.org/BreadcrumbList"]')).toHaveCount(1);
  await expect(page.getByText('configure', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Talk through your situation' })).toHaveAttribute('href', '/connect/');
  await expect(page.locator('.outcome-card')).toHaveCount(3);
  await expect(page.locator('.outcome-grid--3')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Less repetitive manual work' })).toBeVisible();
  await expect(page.locator('.faq-item')).toHaveCount(3);
  await expect(page.getByText('Do you start by building custom software?')).toBeVisible();
  await expect(page.getByText('Will the automation become another system we have to maintain as the source of truth?')).toBeVisible();
  await expect(page.locator('.related-work-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Document Control' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Secure Exchange' })).toBeVisible();
  await expect(page.getByText('Document Control and Secure Exchange show how LDW explores real workflow gaps', { exact: false })).toBeVisible();

  await page.goto('/services/website-care/');
  await expect(page.locator('.outcome-card')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'A healthier site over time' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read what website maintenance should actually check →' }))
    .toHaveAttribute('href', '/guides/website-maintenance-after-launch/');
  await expect(page.getByRole('link', { name: 'View Website Quality Toolkit source' })).toHaveAttribute('href', 'https://github.com/LowcountryDigitalWorks/website-quality-toolkit');

  await page.goto('/services/websites/');
  await expect(page.locator('.outcome-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'A clearer first impression' })).toBeVisible();
  await expect(page.getByText('That operating discipline is evidence of the method, not a client case study.', { exact: false })).toBeVisible();
});
test('Digital Ownership service provides a contextual path to the first-hand ownership guide', async ({ page }) => {
  await page.goto('/services/digital-ownership-platform-administration/');
  await expect(page.getByRole('link', { name: 'Read the website ownership & handoff guide →' }))
    .toHaveAttribute('href', '/guides/website-ownership-handoff/');
  await expect(page.getByText('LDW does not need to become the permanent recovery owner', { exact: false })).toBeVisible();
});


test('desktop three-outcome layout and sticky-header anchors preserve their UX invariants', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/services/business-systems-automation/');

  const grid = page.locator('.outcome-grid--3');
  await expect(grid).toHaveCount(1);
  const gridState = await grid.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  expect(gridState.columns).toBe(3);
  expect(gridState.overflow).toBeFalsy();

  await page.goto('/services/business-systems-automation/#fit');
  await expect(page.locator('#fit')).toBeVisible();
  const anchorState = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const target = document.querySelector('#fit');
    if (!header || !target) throw new Error('Expected sticky header and #fit target');
    return {
      headerBottom: header.getBoundingClientRect().bottom,
      targetTop: target.getBoundingClientRect().top,
    };
  });
  expect(anchorState.targetTop).toBeGreaterThan(anchorState.headerBottom);
});

test('homepage presents three customer-first entry paths without exposing gated discovery', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Websites and business systems that make work easier.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Talk through your project' })).toHaveAttribute('href', '/connect/');
  await expect(page.getByRole('link', { name: 'Find your starting point' })).toHaveAttribute('href', '#start');
  await expect(page.locator('.hero-owner-card')).toHaveCount(1);
  await expect(page.locator('.solution-card')).toHaveCount(3);
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
  await expect(page.locator('.portfolio-grid--home .portfolio-card')).toHaveCount(3);
  await expect(page.getByText('A structured way to keep reviews, approvals, versions, and evidence', { exact: false })).toBeVisible();
  await expect(page.getByText('Internal evidence infrastructure that helps LDW compare website and search-quality findings', { exact: false })).toBeVisible();
  const homeWorkThumbs = page.locator('.portfolio-grid--home .portfolio-card__visual img');
  await expect(homeWorkThumbs).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect(homeWorkThumbs.nth(i)).toHaveAttribute('loading', 'lazy');
    await homeWorkThumbs.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(async () => homeWorkThumbs.nth(i).evaluate((img) => [img.complete, img.naturalWidth, img.naturalHeight]))
      .toEqual([true, 720, 450]);
  }
  await expect(page.locator('.faq-item')).toHaveCount(4);
  await expect(page.getByText('Do I need to know which LDW service I need?')).toBeVisible();
});

test('Approach matches the accepted assess, improve-or-build, handoff-or-care method', async ({ page }) => {
  await page.goto('/approach/');
  await expect(page.getByRole('heading', { level: 1, name: 'From “this is not working” to a clear next step.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assess' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Improve or build' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Handoff or care' })).toBeVisible();
  await expect(page.locator('.approach-expectations .card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Be willing not to build' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tell Eddie what is not working' })).toHaveAttribute('href', '/connect/');
  await expect(page.getByRole('link', { name: 'Talk it through with Eddie' })).toHaveAttribute('href', '/connect/');
  await expect(page.getByRole('link', { name: 'See the evidence →' })).toHaveAttribute('href', '/work/');
  await expect(page.getByRole('link', { name: 'Find a service →' })).toHaveAttribute('href', '/services/');
  await expect(page.locator('a[href="/contact/"]')).toHaveCount(0);
});
test('Guides remain small, first-hand, source-linked, and publicity-safe', async ({ page }) => {
  await page.goto('/guides/');
  await expect(page.getByRole('heading', { level: 1, name: 'Practical guidance for owning and operating your digital systems.' })).toBeVisible();
  await expect(page.locator('.guide-card')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Read the ownership guide →' })).toHaveAttribute('href', '/guides/website-ownership-handoff/');
  await expect(page.getByRole('link', { name: 'Read the maintenance guide →' })).toHaveAttribute('href', '/guides/website-maintenance-after-launch/');
  await expect(page.getByText('No publishing treadmill.')).toBeVisible();
  await expect(page.locator('#main-content')).not.toContainText('Donovan Family Dentistry');
  await expect(page.locator('#main-content')).not.toContainText('East Coast Foam');

  await page.goto('/guides/website-ownership-handoff/');
  await expect(page.getByRole('heading', { level: 1, name: /Website ownership & handoff: what your business should control/i })).toBeVisible();
  await expect(page.locator('article[itemtype="https://schema.org/Article"]')).toHaveCount(1);
  await expect(page.locator('article [itemprop="author"][itemtype="https://schema.org/Person"] [itemprop="name"]')).toHaveText('Eddie Gugino');
  await expect(page.locator('time[itemprop="dateModified"]')).toHaveAttribute('datetime', '2026-10-01');
  await expect(page.locator('[itemprop="publisher"][itemid="https://lowcountrydigitalworks.com/#organization"]')).toHaveCount(1);
  await expect(page.locator('.guide-control-item')).toHaveCount(7);
  await expect(page.getByText('This is an operational guide, not legal advice.', { exact: false })).toBeVisible();
  await expect(page.getByText('Named access is easier to audit, reduce, and remove than a shared password.')).toBeVisible();
  await expect(page.getByText('A handoff should transfer operating context, not just send a ZIP file.')).toBeVisible();
  await expect(page.locator('.guide-source-list a')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Digital Ownership service' })).toHaveAttribute('href', '/services/digital-ownership-platform-administration/');
  await expect(page.locator('#main-content')).not.toContainText('Donovan Family Dentistry');
  await expect(page.locator('#main-content')).not.toContainText('East Coast Foam');
  await expect(page.locator('#main-content form')).toHaveCount(0);

  await page.goto('/guides/website-maintenance-after-launch/');
  await expect(page.getByRole('heading', { level: 1, name: /Website maintenance after launch: what should actually be checked/i })).toBeVisible();
  await expect(page.locator('article[itemtype="https://schema.org/Article"]')).toHaveCount(1);
  await expect(page.locator('article [itemprop="author"][itemtype="https://schema.org/Person"] [itemprop="name"]')).toHaveText('Eddie Gugino');
  await expect(page.locator('time[itemprop="dateModified"]')).toHaveAttribute('datetime', '2026-10-01');
  await expect(page.locator('[itemprop="publisher"][itemid="https://lowcountrydigitalworks.com/#organization"]')).toHaveCount(1);
  await expect(page.getByText('Maintain the business path and the actual stack—not a generic checklist.')).toBeVisible();
  await expect(page.getByText('no tool alone can determine whether a site meets accessibility standards', { exact: false })).toBeVisible();
  await expect(page.getByText('There is no single honest rule that every business website needs the same daily, weekly, monthly, and quarterly checklist.', { exact: false })).toBeVisible();
  await expect(page.getByText('Static / low-runtime')).toBeVisible();
  await expect(page.getByText('CMS / plugin-heavy')).toBeVisible();
  await expect(page.locator('.guide-source-list a')).toHaveCount(6);
  await expect(page.locator('a[href="https://www.w3.org/WAI/standards-guidelines/wcag/"]')).toBeVisible();
  await expect(page.locator('a[href="https://www.w3.org/WAI/test-evaluate/"]')).toBeVisible();
  await expect(page.locator('a[href="https://developers.google.com/search/docs/appearance/page-experience"]')).toBeVisible();
  await expect(page.locator('a[href="https://developers.google.com/search/docs/appearance/core-web-vitals"]')).toBeVisible();
  await expect(page.locator('a[href="https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap"]')).toBeVisible();
  await expect(page.locator('a[href="https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Website Care service' })).toHaveAttribute('href', '/services/website-care/');
  await expect(page.getByRole('link', { name: 'Ownership & handoff guide' })).toHaveAttribute('href', '/guides/website-ownership-handoff/');
  await expect(page.getByRole('link', { name: 'Talk through your site' })).toHaveAttribute('href', '/connect/');
  await expect(page.locator('#main-content')).not.toContainText('Donovan Family Dentistry');
  await expect(page.locator('#main-content')).not.toContainText('East Coast Foam');
  await expect(page.locator('#main-content form')).toHaveCount(0);
});


test('guide educational diagrams stay semantic, bounded, and mobile-readable', async ({ page }) => {
  await page.goto('/guides/website-ownership-handoff/');
  const ownership = page.locator('[data-education-diagram="ownership"]');
  await expect(ownership).toHaveCount(1);
  await expect(ownership.locator('figcaption')).toContainText('Website ownership map');
  await expect(ownership.locator('.ownership-node')).toHaveCount(6);
  await expect(ownership.getByText('Your business', { exact: true })).toBeVisible();
  await expect(ownership.getByText('Domain & DNS', { exact: true })).toBeVisible();
  await expect(ownership.getByText('Recovery, MFA & billing', { exact: true })).toBeVisible();
  await expect(ownership.locator('img, svg, canvas, script')).toHaveCount(0);

  await page.goto('/guides/website-maintenance-after-launch/');
  const care = page.locator('[data-education-diagram="care-loop"]');
  await expect(care).toHaveCount(1);
  await expect(care.locator('figcaption')).toContainText('Website care loop');
  await expect(care.locator('.care-loop > li')).toHaveCount(7);
  await expect(care.getByText('Observe', { exact: true })).toBeVisible();
  await expect(care.getByText('Validate', { exact: true })).toBeVisible();
  await expect(care.getByText('Repeat', { exact: true })).toBeVisible();
  await expect(care.locator('img, svg, canvas, script')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/guides/website-ownership-handoff/', '/guides/website-maintenance-after-launch/']) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `${route} educational diagram should not overflow horizontally`).toBeFalsy();
  }
});

test('work page shows three truthful evidence-oriented project entries', async ({ page }) => {
  await page.goto('/work/');
  await expect(page.getByRole('heading', { level: 1, name: 'See the problem, the proof, and the boundary.' })).toBeVisible();
  await expect(page.locator('.portfolio-grid--work .portfolio-card')).toHaveCount(3);
  await expect(page.locator('.portfolio-card__context')).toHaveCount(3);
  await expect(page.getByText('They are not customer case studies.', { exact: false })).toBeVisible();
  const workThumbs = page.locator('.portfolio-grid--work .portfolio-card__visual img');
  await expect(workThumbs).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect.poll(async () => workThumbs.nth(i).evaluate((img) => [img.complete, img.naturalWidth, img.naturalHeight]))
      .toEqual([true, 720, 450]);
  }
  await expect(page.getByRole('heading', { name: 'G.A.S. Engine' })).toBeVisible();
  await expect(page.getByText('Internal service-enabling evidence infrastructure', { exact: true })).toBeVisible();
  await expect(page.getByText('Internal evidence infrastructure that helps LDW compare website and search-quality findings over time', { exact: false })).toBeVisible();
  const documentControlCard = page.locator('.portfolio-card').filter({ hasText: 'Document Control' });
  const secureExchangeCard = page.locator('.portfolio-card').filter({ hasText: 'Secure Exchange' });
  const gasCard = page.locator('.portfolio-card').filter({ hasText: 'G.A.S. Engine' });
  await expect(documentControlCard.locator('.portfolio-card__boundary')).toContainText('Active development · not a production customer deployment.');
  await expect(secureExchangeCard.locator('.portfolio-card__boundary')).toContainText('Synthetic/local validation · no regulated-production claim.');
  await expect(gasCard.locator('.portfolio-card__boundary')).toContainText('Internal infrastructure · not customer SaaS.');
  await expect(page.locator('#main-content')).not.toContainText('Donovan Family Dentistry');
  await expect(page.locator('#main-content')).not.toContainText('East Coast Foam');

  await page.goto('/work/gas-engine/');
  await expect(page.getByText('Internal evidence infrastructure that helps LDW compare website and search-quality findings over time', { exact: false })).toBeVisible();
  await expect(page.getByText('Current boundary:', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See the evidence' })).toHaveAttribute('href', '#proof');
  await expect(page.locator('#proof')).toHaveCount(1);
  await expect(page.locator('.project-detail-grid .lede').filter({ hasText: 'not customer SaaS' })).toBeVisible();
  await expect(page.locator('.project-process__step')).toHaveCount(4);
  await expect(page.locator('.faq-item')).toHaveCount(2);
  await expect(page.getByText('Can a customer buy G.A.S. Engine as standalone software?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View source' })).toHaveAttribute('href', 'https://github.com/LowcountryDigitalWorks/gas-engine');
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
  await expect(page.getByRole('heading', { level: 1, name: 'Local, practical, and accountable by design.' })).toBeVisible();
  await expect(page.getByText('Beaufort, South Carolina · Owner-operated', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One accountable point of contact from the first conversation through handoff.' })).toBeVisible();
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
  await expect(main.getByRole('heading', { level: 1, name: 'Tell me what is getting in the way.' })).toBeVisible();
  await expect(main.getByText('You do not need a polished scope or the right technical terminology.', { exact: false })).toBeVisible();
  await expect(main.getByText('Eddie Gugino', { exact: false })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'A useful first message can be simple.' })).toBeVisible();
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
  await expect(main.getByRole('link', { name: 'X', exact: true })).toBeVisible();
  await expect(main.locator('.ui-icon[aria-hidden="true"]')).toHaveCount(5);

  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Facebook' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'X', exact: true })).toBeVisible();
  await expect(footer.locator('.social-mark--facebook')).toHaveCSS('background-color', 'rgb(24, 119, 242)');
  await expect(footer.locator('.social-mark--x')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(footer.locator('.ui-icon[aria-hidden="true"]')).toHaveCount(4);
});

test('privacy page reflects the current no-nonessential-cookie posture without a cosmetic consent banner', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { name: 'Cookies, browser storage, and tracking' })).toBeVisible();
  await expect(page.getByText('does not intentionally use advertising trackers', { exact: false })).toBeVisible();
  await expect(page.getByText('does not display a cookie banner merely for appearance', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Do Not Track and cross-site collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review, correction, and deletion requests' })).toBeVisible();
  await expect(page.locator('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]')).toHaveCount(0);
});

test('legal and accessibility surfaces preserve narrow public-site boundaries', async ({ page }) => {
  await page.goto('/accessibility/');
  await expect(page.getByRole('heading', { level: 1, name: 'Accessibility Statement' })).toBeVisible();
  await expect(page.getByText('targets WCAG 2.2 Level AA where applicable', { exact: false })).toBeVisible();
  await expect(page.getByText('not a guarantee', { exact: false })).toBeVisible();
  await expect(page.locator('#main-content').getByRole('link', { name: 'eddie@lowcountrydigitalworks.com' })).toHaveAttribute('href', 'mailto:eddie@lowcountrydigitalworks.com');

  await page.goto('/terms/');
  await expect(page.getByRole('heading', { level: 1, name: 'Website Terms' })).toBeVisible();
  await expect(page.getByText('does not by itself create a client relationship', { exact: false })).toBeVisible();
  await expect(page.getByText('does not by itself certify', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', '/privacy/');
  await expect(page.getByRole('link', { name: 'Accessibility Statement' })).toHaveAttribute('href', '/accessibility/');

  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
  await expect(footer.getByRole('link', { name: 'Accessibility' })).toHaveAttribute('href', '/accessibility/');
  await expect(footer.getByRole('link', { name: 'Website Terms' })).toHaveAttribute('href', '/terms/');
});

test('verified public entity links expose one Organization identity without private-location claims', async ({ page }) => {
  await page.goto('/');
  const entity = page.locator('footer [itemtype="https://schema.org/Organization"]').first();
  await expect(entity).toHaveCount(1);
  await expect(entity).toHaveAttribute('itemid', 'https://lowcountrydigitalworks.com/#organization');
  await expect(entity.locator('strong[itemprop="name"]')).toHaveText('Lowcountry Digital Works');
  const founder = entity.locator('[itemprop="founder"][itemtype="https://schema.org/Person"]');
  await expect(founder).toHaveCount(1);
  await expect(founder.locator('[itemprop="name"]')).toHaveText('Eddie Gugino');
  await expect(founder.locator('[itemprop="jobTitle"]')).toHaveText('Founder');
  await expect(entity.locator('a[itemprop="url"]')).toHaveAttribute('href', '/');
  await expect(entity.locator('[itemprop="areaServed"]')).toHaveText('South Carolina Lowcountry');
  await expect(entity.locator('a[itemprop="email"]')).toHaveAttribute('href', 'mailto:eddie@lowcountrydigitalworks.com');
  await expect(entity.locator('a[itemprop="telephone"]')).toHaveAttribute('href', 'tel:+18436333123');
  await expect(entity.locator('a[itemprop="sameAs"]')).toHaveCount(2);
  await expect(entity.locator('a[href="https://www.facebook.com/LowcountryDigitalWorks/"]')).toHaveCount(1);
  await expect(entity.locator('a[href="https://x.com/LocoDW"]')).toHaveCount(1);
  await expect(page.locator('[itemtype="https://schema.org/ProfessionalService"]')).toHaveCount(0);
  await expect(entity.locator('[itemprop="address"]')).toHaveCount(0);
  await expect(page.locator('a[href*="linkedin.com/company"]')).toHaveCount(0);

  await page.goto('/services/business-systems-automation/');
  const provider = page.locator('[itemprop="provider"][itemtype="https://schema.org/Organization"]');
  await expect(provider).toHaveCount(1);
  await expect(provider).toHaveAttribute('itemid', 'https://lowcountrydigitalworks.com/#organization');
});

test('page metadata includes canonical Open Graph and Twitter fields', async ({ page }) => {
  await page.goto('/services/websites/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/services/websites/');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Lowcountry Digital Works');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /Websites/);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', /accessible/i);

  await page.goto('/contact/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/connect/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://lowcountrydigitalworks.com/connect/');

  await page.goto('/connect/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lowcountrydigitalworks.com/connect/');
});

test('robots preserves search and AI-answer visibility while opting out of training', async ({ page }) => {
  const response = await page.request.get('/robots.txt');
  expect(response.ok()).toBeTruthy();
  const robots = await response.text();
  expect(robots).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference');
  expect(robots).toContain('User-agent: GPTBot\nDisallow: /');
  expect(robots).toContain('Sitemap: https://lowcountrydigitalworks.com/sitemap.xml');
  expect(robots).not.toContain('User-agent: OAI-SearchBot\nDisallow:');
  expect(robots).not.toContain('User-agent: Google-Extended\nDisallow:');
});

test('technology marks are served locally without third-party image requests', async ({ page }) => {
  await page.goto('/work/');
  const marks = page.locator('.technology-compact__item img');
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
  expect(xml).not.toContain('https://lowcountrydigitalworks.com/contact/');
  expect(xml).toContain('https://lowcountrydigitalworks.com/guides/');
  expect(xml).toContain('https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/');
  expect(xml).toContain('https://lowcountrydigitalworks.com/guides/website-ownership-handoff/');
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
