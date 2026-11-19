import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { careOptionsPreviewEnabled } from '../src/lib/care-gate.mjs';

// R5 Care/guide addendum (R3c: #care-options is the five-tier Website Care plans carousel).
// The #care-options section is gated at BUILD TIME by ONE shared fail-closed AND-gate (src/lib/care-gate.mjs):
//   CARE_OPTIONS_PREVIEW=1 AND WORKERS_CI=1 AND WORKERS_CI_BRANCH=<the exact preview branch>.
//   astro.config.mjs automatically supplies the first flag ONLY on that exact Workers preview branch (unless explicitly opted out).
//   Main, local/default and unrelated branch builds remain OFF.
// Run these tests against a build made with the same environment:
//   default (OFF):  npm run build && npx playwright test tests/r5-care-addendum.spec.mjs
//   preview (ON):   export CARE_OPTIONS_PREVIEW=1 WORKERS_CI=1 WORKERS_CI_BRANCH=feature/web-160-coastal-v2c-preview-phaseb-20261109; npm run build && npx playwright test tests/r5-care-addendum.spec.mjs
const ON = careOptionsPreviewEnabled();
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
      await page.goto(GUIDE);
      const gap = await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => setTimeout(r, 250));
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

test.describe(`Website Care plans (build flag CARE_OPTIONS_PREVIEW ${ON ? 'ON' : 'OFF'})`, () => {
  const NAMES = ['Site Watch', 'Site Care', 'Site Care Plus', 'Local Visibility', 'Full Local Presence'];
  const PRICES = ['$35/mo', '$59/mo', '$99/mo', '$229/mo', 'Starting at $499/mo'];

  test('flag default OFF means nothing from the plans is rendered, linked or loaded anywhere', async ({ page }) => {
    test.skip(ON, 'flag ON build');
    for (const route of ['/services/website-care/', '/services/']) {
      await page.goto(route);
      await expect(page.locator('#care-options, [data-care-options-preview], .care-plans, .care-tier')).toHaveCount(0);
      await expect(page.locator('a[href*="care-options"]')).toHaveCount(0);
      await expect(page.locator('script[src*="care-carousel"]')).toHaveCount(0);
      // R3b: a flag-OFF build carries neither the plans stylesheet nor the carousel script
      const sheets = await page.locator('link[rel="stylesheet"]').evaluateAll((ls) => ls.map((l) => l.href));
      for (const href of sheets) expect(await (await page.request.get(href)).text(), href).not.toMatch(/care-tier|care-plans|care-track/);
      expect((await page.request.get('/r5/care-carousel.js')).status()).toBe(404);
      await expect(page.locator('main')).not.toContainText('Recommended choice');
      await expect(page.locator('main')).not.toContainText('Site Care Plus');
    }
    // production assertion: the preview marker, price markup and loader are absent from the served HTML of every Care/Services route
    for (const route of ['/services/website-care/', '/services/', '/']) {
      const html = await (await page.request.get(route)).text();
      expect(html, route).not.toContain('data-care-options-preview');
      expect(html, route).not.toMatch(/care-options|care-carousel|care-tier/);
    }
  });

  test('flag ON renders five tiers in one T1 to T5 sequence with names, prices and one recommended choice', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/services/website-care/#care-options');
    const section = page.locator('#care-options');
    await expect(section).toHaveCount(1);
    const tiers = section.locator('.care-tier');
    await expect(tiers).toHaveCount(5);
    expect(await tiers.evaluateAll((els) => els.map((e) => e.dataset.careOption))).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(await section.locator('.care-tier__name').allInnerTexts()).toEqual(NAMES);
    const prices = await section.locator('.care-tier__price').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('span')].map((x) => x.textContent.trim()).filter(Boolean).slice(0, 3).join(' ').replace(/\s+\//, '/')));
    expect(prices).toEqual(PRICES);
    await expect(section.locator('.care-tier--rec')).toHaveCount(1);
    await expect(section.getByText('Recommended choice')).toHaveCount(1);
    await expect(section.locator('[data-care-option="t3"]').getByText('Recommended choice')).toHaveCount(1);
    await expect(section.locator('[data-care-option="t5"] .care-tier__note')).toHaveText('Custom plan');
    // five across and T3 centred on desktop
    const boxes = await tiers.evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), cx: b.left + b.width / 2, w: b.width }; }));
    expect(Math.abs(boxes[2].cx - 720)).toBeLessThanOrEqual(2);
    expect(boxes[0].cx).toBeLessThan(boxes[1].cx);
    expect(boxes[3].cx).toBeLessThan(boxes[4].cx);
    expect(Math.min(...boxes.map((b) => b.w))).toBeGreaterThanOrEqual(240);
    // controls: five dots (buttons) and exactly one link, the existing conversation path as a text link; the page keeps one .button CTA
    await expect(section.locator('button')).toHaveCount(5);
    await expect(section.locator('a')).toHaveCount(1);
    await expect(section.locator('a')).toHaveAttribute('href', '/connect/');
    await expect(section.locator('a.button')).toHaveCount(0);
    await expect(page.locator('main a.button[href="/connect/"]')).toHaveCount(1);
    await expect(section.locator('[class*="plan-"]')).toHaveCount(0);
    await expect(section.locator('.care-banner, .care-chip, .care-badge, .care-sheets')).toHaveCount(0);
    await expect(section.locator('[style]')).toHaveCount(0);
  });

  test('flag ON R3b: no example-diagram panel in the plans lead, no orphaned gap, and the card colours blend toward the centre', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/services/website-care/');
      await expect(page.locator('#care-options img, #care-options picture, #care-options figure, #care-options .care-loopband')).toHaveCount(0);
      await expect(page.locator('#care-options').getByText('Diagram: example setup')).toHaveCount(0);
      const m = await page.evaluate(() => {
        const lead = document.querySelector('.care-options__lead').getBoundingClientRect(); const track = document.querySelector('.care-track').getBoundingClientRect(); const h2 = document.querySelector('#care-options h2').getBoundingClientRect(); const sec = document.querySelector('#care-options').getBoundingClientRect();
        const L = (id) => { const c = getComputedStyle(document.querySelector(`[data-care-option="${id}"]`)).backgroundColor.match(/[\d.]+/g).map(Number); const a = c.length > 3 ? c[3] : 1; return [c[0], c[1], c[2], a]; };
        return { gap: track.top - lead.bottom, h2Left: h2.left, secTopToH2: h2.top - sec.top, t1: L('t1'), t2: L('t2'), t3: L('t3'), t4: L('t4'), t5: L('t5') };
      });
      expect(m.gap, `${width}px gap between lead and cards`).toBeLessThanOrEqual(40);
      expect(m.secTopToH2, `${width}px top spacing`).toBeLessThanOrEqual(130);
      // R3c warm taupe: T2/T4 are a warm charcoal base (red >= green >= blue, never green-dominant: no sage/olive) with an oyster sheen; T1/T5 stay navy
      const hue = (c) => ({ warm: c[0] >= c[2] && c[0] + 2 >= c[1], greenDominant: c[1] > c[0] + 2 });
      expect(hue(m.t2).warm, `${width}px T2 base is warm`).toBe(true); expect(hue(m.t2).greenDominant).toBe(false);
      expect(hue(m.t4).warm).toBe(true); expect(hue(m.t4).greenDominant).toBe(false);
      expect(m.t1[2], 'T1 stays navy (blue > red)').toBeGreaterThan(m.t1[0] + 15); expect(m.t5[2]).toBeGreaterThan(m.t5[0] + 15);
      expect(m.t2.join()).toBe(m.t4.join());
      expect(m.t1.join()).toBe(m.t5.join());
      const acc = await page.evaluate(() => { const rgb = (id) => getComputedStyle(document.querySelector(`[data-care-option="${id}"]`), '::before').backgroundColor.match(/\d+/g).map(Number); return { t2: rgb('t2'), t4: rgb('t4'), sheen: getComputedStyle(document.querySelector('[data-care-option="t2"]')).backgroundImage }; });
      for (const c of [acc.t2, acc.t4]) { expect(c[0], `${width}px gold accent: red above blue`).toBeGreaterThan(c[2] + 40); expect(c[0]).toBeGreaterThanOrEqual(c[1]); }
      expect(acc.sheen).toContain('radial-gradient'); expect(acc.sheen).not.toContain('linear-gradient'); expect(acc.sheen).toContain('rgba(239, 233, 221, 0.28)');
    }
  });

  test('flag ON copy lint: tier data is the owner data and nothing reads as a proposal, test or internal name', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    await page.goto('/services/website-care/');
    const text = await page.locator('#care-options').innerText();
    for (const bad of [/G\.A\.S/, /\bMGR\b/, /\bWQT\b/, /\d+\s*(min|minutes)\b/i, /most popular/i, /Option \d/, /Proposed/i, /for feedback/i, /\btesting\b/i, /working concept/i, /candidate/i, /Portfolio/, /\[placeholder/i, /by proposal/i, /not purchasable/i, /Monitor\b/]) {
      expect(text, String(bad)).not.toMatch(bad);
    }
    expect([...text.matchAll(/propos/gi)]).toHaveLength(0);
    const excl = page.locator('#care-options .care-exclusions');
    for (const part of ['scoped separately', 'after-hours emergencies', 'anything requiring its own scope of work', 'No ranking, traffic, lead or revenue guarantees', 'You keep ownership of your accounts']) await expect(excl).toContainText(part);
    // R3c copy (Challenger L-N1): T5 says richer, with approval on bigger changes; T4 states the bounded #377 remediation wording; no hyphenated mid-term compounds that used to break
    expect(text).not.toMatch(/richest/i);
    await expect(page.locator('[data-care-option="t5"]')).toContainText('with your approval on bigger changes');
    await expect(page.locator('[data-care-option="t5"]')).toContainText('richer reporting');
    await expect(page.locator('[data-care-option="t4"]')).toContainText('Bounded remediation of the top 1–3 safe/approved recommendations');
    await expect(page.locator('[data-care-option="t4"]')).toContainText('where provider/data boundaries allow');
    await expect(page.locator('[data-care-option="t4"]')).not.toContainText('LDW handles');
    await expect(page.locator('[data-care-option="t3"]')).toContainText('only where actually available');
    // R3d: the gate-ON Services bridge link is plain wording with no proposal language
    await page.goto('/services/');
    const bridge = page.locator('section[aria-labelledby="care-concept-bridge-heading"]');
    await expect(bridge).toHaveCount(1);
    const bridgeText = await bridge.innerText();
    expect(bridgeText).toContain('Compare the five Website Care plans');
    expect(bridgeText).not.toMatch(/propos|feedback|provisional|not currently available|purchase/i);
    await expect(bridge.getByRole('link', { name: /Compare the five Website Care plans/ })).toHaveAttribute('href', '/services/website-care/#care-options');
    await page.goto('/services/website-care/');
    for (const gone of ['uptime-style', 'review-request', 'new-review', 'LDW completes']) expect(text).not.toContain(gone);
    expect(text).toContain('visibility monitoring');
    expect(text).toContain('review management');
    await expect(page.locator('script:not([src])')).toHaveCount(0);
    await expect(page.locator('script[src="/r5/care-carousel.js"]')).toHaveCount(1);
  });

  test('flag ON carousel: dots are hidden until JS, open on T3, centred, controllable, and the page does not overflow', async ({ page, browser }) => {
    test.skip(!ON, 'flag OFF build');
    // before JS: dots hidden in the served HTML
    const html = await (await page.request.get('/services/website-care/')).text();
    expect(html).toMatch(/class="care-dots"[^>]*hidden/);
    for (const [width, height] of [[390, 844], [375, 812], [360, 780]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/services/website-care/');
      const track = page.locator('.care-track');
      await expect(page.locator('.care-dots')).toBeVisible();
      await expect(page.locator('.care-dot[aria-current="true"]')).toHaveAttribute('data-care-dot', 't3');
      const geo = await page.evaluate(() => {
        const t = document.querySelector('.care-track').getBoundingClientRect(); const s = document.querySelector('[data-care-option="t3"]').getBoundingClientRect();
        const dots = [...document.querySelectorAll('.care-dot')].map((d) => d.getBoundingClientRect());
        return { off: Math.abs((s.left + s.width / 2) - (t.left + t.width / 2)), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, dotMin: Math.min(...dots.map((d) => Math.min(d.width, d.height))), peekL: s.left - t.left, peekR: t.right - s.right };
      });
      expect(geo.off, `${width}px T3 centred`).toBeLessThanOrEqual(2);
      expect(geo.overflow, `${width}px overflow`).toBeLessThanOrEqual(1);
      expect(geo.dotMin, `${width}px dot target`).toBeGreaterThanOrEqual(43.5);
      expect(geo.peekL, `${width}px left peek`).toBeGreaterThanOrEqual(20);
      expect(geo.peekR, `${width}px right peek`).toBeGreaterThanOrEqual(20);
      // dot click and keyboard move the track; no auto-rotate
      await page.locator('.care-dot[data-care-dot="t5"]').click();
      await expect(page.locator('.care-dot[aria-current="true"]')).toHaveAttribute('data-care-dot', 't5');
      await page.waitForTimeout(900);
      await track.focus();
      await page.keyboard.press('Home');
      await expect(page.locator('.care-dot[aria-current="true"]')).toHaveAttribute('data-care-dot', 't1');
      await page.waitForTimeout(1200);
      await expect(page.locator('.care-dot[aria-current="true"]')).toHaveAttribute('data-care-dot', 't1');
    }
    // JS disabled: still a scroll-snap track with every tier present, dots stay hidden, no overflow
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const nojs = await ctx.newPage();
    await nojs.goto('/services/website-care/');
    await expect(nojs.locator('.care-tier')).toHaveCount(5);
    await expect(nojs.locator('.care-dots')).toBeHidden();
    expect(await nojs.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await ctx.close();
  });

  test('flag ON section sits below the sticky header on arrival, and the active card AND its dots clear the real MobileContactBar rect by 24px', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    // R3c pose: the active card is parked 8px under the sticky header (so it is wholly visible), then the REAL bar element's
    // getBoundingClientRect().top is compared with the card bottom, the last list item and the dots.
    // (R3's test scrolled the page until the dots cleared the bar, so it passed by construction and never checked the card.)
    for (const [width, height, strict] of [[390, 844, true], [375, 812, true], [360, 780, true], [375, 667, true]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/services/website-care/#care-options');
      await page.waitForTimeout(400);
      const arrive = await page.evaluate(() => ({ header: document.querySelector('.site-header').getBoundingClientRect().bottom, h2: document.querySelector('#care-options h2').getBoundingClientRect().top }));
      expect(arrive.h2 - arrive.header, `${width}x${height} heading below header on arrival`).toBeGreaterThanOrEqual(24);
      if (!strict) continue;
      for (const id of ['t1', 't2', 't3', 't4', 't5']) {
        await page.locator(`.care-dot[data-care-dot="${id}"]`).click();
        await page.waitForTimeout(700);
        const r = await page.evaluate(async (id) => {
          document.documentElement.style.scrollBehavior = 'auto';
          const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
          const card = document.querySelector(`[data-care-option="${id}"]`);
          window.scrollBy(0, card.getBoundingClientRect().top - (header + 8)); await new Promise((r) => setTimeout(r, 300));
          const bar = document.querySelector('.mobile-contact-bar').getBoundingClientRect();
          const c = card.getBoundingClientRect(); const d = document.querySelector('.care-dots').getBoundingClientRect(); const last = [...card.querySelectorAll('li')].pop().getBoundingClientRect();
          const hits = [...document.querySelectorAll('.care-dot')].map((dot) => { const b = dot.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === dot; });
          return { cardTop: c.top, header, card: bar.top - c.bottom, last: bar.top - last.bottom, dots: bar.top - d.bottom, hits };
        }, id);
        expect(r.cardTop, `${width}x${height} ${id} card top not under header`).toBeGreaterThanOrEqual(r.header);
        expect(r.card, `${width}x${height} ${id} card bottom to bar`).toBeGreaterThanOrEqual(24);
        expect(r.last, `${width}x${height} ${id} last item to bar`).toBeGreaterThanOrEqual(24);
        expect(r.dots, `${width}x${height} ${id} dots to bar`).toBeGreaterThanOrEqual(24);
        expect(r.hits.every(Boolean), `${width}x${height} dots receive clicks`).toBe(true);
      }
    }
  });

  test('flag ON no tier text breaks at a hyphen, dash or slash (1440, 1280, 1024 and the three phones)', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768], [390, 844], [375, 812], [360, 780]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/services/website-care/');
      const breaks = await page.evaluate(() => {
        const out = []; const walker = document.createTreeWalker(document.querySelector('#care-options .care-plans'), NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n.textContent;
          for (let i = 1; i < t.length - 1; i++) {
            if (!/[-\u2010\u2011\u2012\u2013\u2014/]/.test(t[i]) || /\s/.test(t[i + 1])) continue;
            const a = document.createRange(); a.setStart(n, i); a.setEnd(n, i + 1); const c = document.createRange(); c.setStart(n, i + 1); c.setEnd(n, i + 2);
            const ra = a.getClientRects()[0]; const rc = c.getClientRects()[0];
            if (ra && rc && Math.abs(ra.top - rc.top) > 4) out.push(t.slice(Math.max(0, i - 14), i + 15));
          }
        }
        return out;
      });
      expect(breaks, `${width}px hyphen/dash/slash line breaks in tier text`).toEqual([]);
    }
  });

  test('flag ON text is readable on phones: no text under 13.5px (shared .eyebrow/.pill excluded) and no tier clipping', async ({ page }) => {
    test.skip(!ON, 'flag OFF build');
    for (const width of [390, 375, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/services/website-care/');
      const state = await page.evaluate(() => ({
        small: [...document.querySelectorAll('#care-options *')].filter((e) => !e.matches('.pill') && e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 13.5).map((e) => e.className),
        clipped: [...document.querySelectorAll('.care-tier')].filter((t) => t.scrollWidth > t.clientWidth + 1).length,
        link: document.querySelector('.care-talk a').getBoundingClientRect().height,
      }));
      expect(state.small, `${width}px small text`).toEqual([]);
      expect(state.clipped).toBe(0);
      expect(state.link).toBeGreaterThanOrEqual(43.5);
    }
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

// R3e/R3f: no placeholder, review, proposal, sample-data or illustration-disclaimer language visible to buyers, in either gate state.
// Matched against built visible text, alt, aria-label, title and meta description only (never hrefs, ids, class names or JSON keys),
// so code identifiers such as the /local-visibility-sample/ URL cannot false-positive.
test.describe('no placeholder, sample-data or illustration-disclaimer language on visitor-facing pages', () => {
  const ROUTES = ['/', '/services/', '/services/websites/', '/services/website-care/', '/services/business-systems-automation/', '/services/digital-ownership-platform-administration/', '/services/technology-consulting/', '/about/', '/connect/', '/discovery/', '/work/', '/work/gas-engine/', '/work/document-control/', '/work/secure-exchange/', '/work/owner-console/', '/work/reputation/', '/work/interview-facilitator/', '/website-check/', '/local-visibility-sample/', '/guides/website-maintenance-after-launch/', '/guides/website-ownership-handoff/'];
  const BANNED = /for feedback only|feedback only|not currently available|proposed (?:ongoing|care|plan|option)|provisional|placeholder|example setup|\btier [1-5]\b|\bdraft\b|coming soon|lorem ipsum|\bTBD\b/i;
  // R3f (Eddie, 4:49 AM): the "Example: live client site" labels, illustration disclaimers and sample-data boundaries are removed everywhere.
  const REMOVED = /example: live client site|illustrative situation|not a client (?:result|record|system|network)|illustration: |illustration · |illustrative[,.]|example layout|example (?:site structure|check loop|handoff|comparison)|original ldw diagram|\bsynthetic\b|sample (?:information|data)|sample[- ]points?\b|\bsampled\b|unsampled|example data|test-only|test data|\bfixture\b|precomputed|sample frame|internal tool · /i;
  test('visible text, alt text, aria labels and meta description carry none of the banned or removed phrases', async ({ request }) => {
    for (const route of ROUTES) {
      const res = await request.get(route);
      expect(res.status(), route).toBe(200);
      const html = await res.text();
      const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
      const visible = body.replace(/<[^>]+>/g, ' ');
      const attrs = [...body.matchAll(/\b(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(' | ');
      const meta = [...body.matchAll(/<meta[^>]+name="description"[^>]+content="([^"]*)"/g)].map((m) => m[1]).join(' | ');
      for (const [where, text] of [['visible text', visible], ['alt/aria/title text', attrs], ['meta description', meta]]) {
        expect(text.match(BANNED)?.[0] ?? null, `${route} ${where} (banned)`).toBeNull();
        expect(text.match(REMOVED)?.[0] ?? null, `${route} ${where} (removed label)`).toBeNull();
      }
    }
  });

  test('Site Care Plus keeps its Recommended choice flag when the plans are shown; no removed label sits next to it', async ({ page }) => {
    await page.goto('/services/website-care/');
    if (await page.locator('#care-options').count()) {
      await expect(page.locator('[data-care-option="t3"]')).toContainText('Recommended choice');
    }
  });
});

// R3f (Challenger R1 L6 / R3e L4): the guide citation hrefs are locked exactly, in order, in both gate states.
test.describe('guide citation hrefs are locked', () => {
  const GUIDES = {
    '/guides/website-maintenance-after-launch/': [
      'https://www.w3.org/WAI/standards-guidelines/wcag/',
      'https://www.w3.org/WAI/test-evaluate/',
      'https://developers.google.com/search/docs/appearance/page-experience',
      'https://developers.google.com/search/docs/appearance/core-web-vitals',
      'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
      'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
    ],
    '/guides/website-ownership-handoff/': [
      'https://www.icann.org/registrants',
      'https://support.google.com/webmasters/answer/7687615?hl=en',
      'https://support.google.com/business/answer/3403100?hl=en',
      'https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization',
      'https://developers.cloudflare.com/fundamentals/manage-members/',
    ],
  };
  for (const [route, expected] of Object.entries(GUIDES)) {
    test(`${route} cites exactly these sources`, async ({ page }) => {
      await page.goto(route);
      const hrefs = await page.locator('.guide-source-list a').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual(expected);
    });
  }
});
