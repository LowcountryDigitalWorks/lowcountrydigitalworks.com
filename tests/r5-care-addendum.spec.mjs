import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// R5 Care/guide addendum.
// The #care-options section is gated by the BUILD-TIME flag CARE_OPTIONS_PREVIEW (default OFF).
// Run these tests against a build made with the same value of the flag:
//   default (OFF):  npm run build && npx playwright test tests/r5-care-addendum.spec.mjs
//   preview (ON):   CARE_OPTIONS_PREVIEW=1 npm run build && CARE_OPTIONS_PREVIEW=1 npx playwright test tests/r5-care-addendum.spec.mjs
const ON = process.env.WORKERS_CI === '1' && process.env.WORKERS_CI_BRANCH === 'feature/web-160-coastal-v2c-preview-phaseb-20261109' && process.env.CARE_OPTIONS_PREVIEW !== '0';
const GUIDE = '/guides/website-maintenance-after-launch/';
const TOC = ['short-version', 'business-path', 'content', 'accessibility', 'performance', 'search', 'security', 'recovery', 'stack', 'cadence', 'report', 'sources'];

test.describe('maintenance guide in the R5 system', () => {
  test('uses R5 chrome and keeps the 12 TOC ids, headings, dates and microdata', async ({ page }) => {
    await page.goto(GUIDE);
    await expect(page.locator('html')).toHaveAttribute('data-dir', 'l');
    await expect(page.locator('.page-hero--warm')).toHaveCount(0);
    await expect(page.locator('.page-hero-plate h1')).toHaveCount(1);
    const hrefs = await page.locator('aside.guide-toc nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(TOC.map((id) => `#${id}`));
    for (const id of TOC) await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(page.locator('time[itemprop="dateModified"]')).toHaveAttribute('datetime', '2026-10-01');
    await expect(page.locator('meta[itemprop="datePublished"]')).toHaveAttribute('content', '2026-09-29');
    await expect(page.locator('[itemtype="https://schema.org/BreadcrumbList"] [itemprop="itemListElement"]')).toHaveCount(2);
    await expect(page.locator('article[itemtype="https://schema.org/Article"] h1[itemprop="headline"]')).toHaveCount(1);
    await expect(page.locator('.guide-source-list a')).toHaveCount(6);
    const guideCitations = await page.locator('.guide-source-list a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(guideCitations).toEqual(["https://www.w3.org/WAI/standards-guidelines/wcag/", "https://www.w3.org/WAI/test-evaluate/", "https://developers.google.com/search/docs/appearance/page-experience", "https://developers.google.com/search/docs/appearance/core-web-vitals", "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap", "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"]);
    await expect(page.locator('[data-education-diagram="care-loop"] .care-loop > li')).toHaveCount(7);
  });

  test('has one conversation button, text-link related links, and no client proof or care-options link', async ({ page }) => {
    await page.goto(GUIDE);
    await expect(page.locator('main a.button, main button')).toHaveCount(1);
    await expect(page.locator('.svc-cta a.button')).toHaveAttribute('href', '/connect/');
    await expect(page.getByRole('link', { name: 'Website Care service' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Ownership & handoff guide' })).toHaveCount(1);
    await expect(page.locator('a[href*="care-options"]')).toHaveCount(0);
    await expect(page.locator('#main-content')).not.toContainText('East Coast Foam');
    await expect(page.locator('#main-content')).not.toContainText('Donovan');
    await expect(page.locator('[data-education-diagram="care-loop"]').locator('img, svg, canvas, script')).toHaveCount(0);
    await expect(page.locator('.guide-hero img, .guide-hero figure, .guide-hero svg')).toHaveCount(0);
  });

  test('has no horizontal overflow and the TOC chips are 44px targets on phones', async ({ page }) => {
    for (const width of [390, 375, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(GUIDE);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chips: [...document.querySelectorAll('aside.guide-toc nav a')].map((a) => a.getBoundingClientRect().height),
      }));
      expect(state.overflow, `${width}px overflow`).toBeLessThanOrEqual(1);
      expect(Math.min(...state.chips), `${width}px TOC chip height`).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('keeps at least 24px between the last footer content and the MobileContactBar at end of page', async ({ page }) => {
    for (const [width, height] of [[390, 844], [375, 812], [360, 780], [375, 667]]) {
      await page.setViewportSize({ width, height });
      await page.goto(GUIDE, { waitUntil: 'networkidle' });
      const gap = await page.evaluate(async () => {
        await document.fonts.ready;
        document.documentElement.style.scrollBehavior = 'auto';
        for (let i = 0; i < 3; i++) {
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((r) => setTimeout(r, 250));
        }
        const bar = document.querySelector('.mobile-contact-bar').getBoundingClientRect().top;
        let last = 0;
        for (const el of document.querySelectorAll('footer p, footer a, footer li, footer small')) {
          const b = el.getBoundingClientRect();
          if (b.width > 0 && b.height > 0) last = Math.max(last, b.bottom);
        }
        return bar - last;
      });
      expect(gap, `${width}x${height}`).toBeGreaterThanOrEqual(24);
    }
  });

  test('R2: the first article H2 clears the MobileContactBar by 24px at 390x844, 375x812 and 360x780', async ({ page }) => {
    for (const [width, height] of [[390, 844], [375, 812], [360, 780]]) {
      await page.setViewportSize({ width, height });
      await page.goto(GUIDE);
      const gap = await page.evaluate(() => document.querySelector('.mobile-contact-bar').getBoundingClientRect().top + scrollY - (document.querySelector('#short-version h2').getBoundingClientRect().bottom + scrollY));
      expect(gap, `${width}x${height} first H2 to bar`).toBeGreaterThanOrEqual(24);
      const h1Lines = await page.evaluate(() => { const h = document.querySelector('.guide-hero h1'); return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)); });
      expect(h1Lines, `${width}px H1 lines`).toBeLessThanOrEqual(3);
    }
  });

  test('axe finds no violations', async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(GUIDE);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => v.id), `${width}px`).toEqual([]);
    }
  });
});

test.describe(`Website Care options concept (build flag CARE_OPTIONS_PREVIEW ${ON ? 'ON' : 'OFF'})`, () => {
  test('flag default OFF means nothing from the concept is rendered or linked anywhere', async ({ page }) => {
    test.skip(ON, 'flag ON build');
    for (const route of ['/services/website-care/', '/services/']) {
      await page.goto(route);
      await expect(page.locator('#care-options, [data-care-options-preview], .care-banner, .care-card')).toHaveCount(0);
      await expect(page.locator('a[href*="care-options"]')).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText('not purchasable');
      await expect(page.locator('main')).not.toContainText('Recommended candidate');
    }
  });

  test('flag ON renders one proposed-only section with T2/T3/T4 cards and T1/T5 rows', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/services/website-care/#care-options');
    const section = page.locator('#care-options');
    await expect(section).toHaveCount(1);
    await expect(section.locator('.care-banner')).toContainText('Proposed · not purchasable');
    await expect(section.locator('.care-banner')).toContainText('not currently available to purchase');
    await expect(section.locator('.care-banner')).toContainText('Portfolio approval');
    await expect(section).toContainText('Portfolio');
    await expect(section.locator('.care-main > li')).toHaveCount(3);
    await expect(section.locator('.care-main > li').nth(1)).toContainText('Recommended candidate');
    await expect(section.getByText('Recommended candidate')).toHaveCount(1);
    await expect(section.locator('.care-rows > li')).toHaveCount(2);
    await expect(section.locator('.care-rows > li').nth(0)).toContainText('Option 1');
    await expect(section.locator('.care-rows > li').nth(1)).toContainText('Option 5');
    // every card and row carries its own proposed label
    await expect(section.locator('.care-card, .care-row').filter({ hasText: 'Proposed' })).toHaveCount(5);
    // T3 is centered on desktop
    const centers = await section.locator('.care-main > li').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return b.left + b.width / 2; }));
    expect(Math.abs(centers[1] - 720)).toBeLessThanOrEqual(2);
    // no buttons, no links except the jump link; no plan-* classes; the only page CTA is the band
    await expect(section.locator('button')).toHaveCount(0);
    await expect(section.locator('a')).toHaveCount(1);
    await expect(section.locator('a')).toHaveAttribute('href', '#care-option-3');
    await expect(section.locator('[class*="plan-"]')).toHaveCount(0);
    await expect(page.locator('main a.button[href="/connect/"]')).toHaveCount(1);
    // copy lint: no prices, caps, SLAs, monitor or bundle language
    const text = (await section.innerText());
    for (const bad of [/\$\s?\d/, /\d\s*(min|hours?)\b/i, /starting at/i, /\bSLA\b/, /uptime/i, /Monitor/, /G\.A\.S/, /most popular/i, /\bMGR\b/, /\bGBP\b/, /also serving/i, /per month|monthly|billed/i, /\[placeholder\]|to confirm/i]) {
      expect(text, String(bad)).not.toMatch(bad);
    }
    await page.goto('/services/');
    await expect(page.locator('a[href="/services/website-care/#care-options"]')).toHaveCount(1);
  });

  test('flag ON keeps the label visible and the page contained at phone widths', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    for (const width of [390, 375, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/services/website-care/');
      await expect(page.locator('.care-banner__tag')).toBeVisible();
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        order: [...document.querySelectorAll('.care-main > li')].map((e) => e.dataset.careOption),
        smallText: [...document.querySelectorAll('#care-options *')].filter((e) => !e.matches('.eyebrow, .pill') && e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 13.5).length,
        jump: document.querySelector('.care-jump a').getBoundingClientRect().height,
      }));
      expect(state.overflow, `${width}px overflow`).toBeLessThanOrEqual(1);
      expect(state.order).toEqual(['t2', 't3', 't4']);
      expect(state.smallText, `${width}px text under 13.5px (excluding the site's shared .eyebrow/.pill components)`).toBe(0);
      expect(state.jump).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('R2: T4 "Does not include" has no hyphenated compounds that break mid-term', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    await page.goto('/services/website-care/');
    const lines = await page.locator('#care-options [data-care-option="t4"] .care-not li').allInnerTexts();
    expect(lines).toContain('A full ongoing search visibility or monitoring program; that needs a separate approved scope.');
    expect(lines).toContain('Reputation, review management, or Google Business Profile administration; those need a separate scope.');
    for (const line of lines) expect(line, line).not.toMatch(/[a-z]-[a-z]/);
  });

  test('flag ON axe finds no violations on the care page', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/services/website-care/');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => v.id), `${width}px`).toEqual([]);
    }
  });
});


test('Care concept source never contains fixed dollar prices or contract promises', async () => {
const { readFileSync } = await import('node:fs');
const source = JSON.parse(readFileSync(new URL('../src/data/care-options.json', import.meta.url), 'utf8'));
const copy = JSON.stringify(source);
for (const bad of [/\$\s?\d/, /\bUSD\b/i, /\bSLA\b/i, /\bguaranteed (?:response|rankings|uptime)\b/i, /\b4-hour response\b/i, /\bstart (?:your )?subscription\b/i, /\bunlimited (?:support|changes)\b/i]) {
  expect(copy, String(bad)).not.toMatch(bad);
}
});
