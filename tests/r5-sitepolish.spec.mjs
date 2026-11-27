import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';

// R5 site-wide polish, kit 1: shared carousel, Services band + plans, Home router, towns 2x2, footer marks, rule fixes.
// Desktop-only project: every test sets its own viewport (the mobile project would only repeat them).
test.skip(({ isMobile }) => isMobile, 'viewports are set per test');

const PHONES = [[390, 844], [375, 812], [360, 780]];
const PAGES = ['/', '/about/', '/connect/', '/discovery/', '/work/', '/work/document-control/', '/services/'];
// Kit 4: the R5 rollout to every route. K4A = the pages redesigned in batch k4a (project and service detail pages).
const K4A = ['/work/gas-engine/', '/work/document-control/', '/work/owner-console/', '/work/interview-facilitator/', '/work/reputation/', '/work/secure-exchange/',
  '/services/websites/', '/services/website-care/', '/services/business-systems-automation/', '/services/digital-ownership-platform-administration/', '/services/technology-consulting/'];
// K4B = batch k4b: Approach, the guides, Website Check, the Local Visibility sample and Contact.
const K4B = ['/approach/', '/guides/', '/guides/website-maintenance-after-launch/', '/guides/website-ownership-handoff/', '/website-check/', '/local-visibility-sample/', '/contact/'];
// K4C = batch k4c, the last: the legal pages, Secure Share and the 404 page (reached through an unknown path). With k4c every route is on R5.
const K4C = ['/accessibility/', '/privacy/', '/terms/', '/share/', '/this-page-does-not-exist/'];
// All 29 built routes (the 404 page is reached through an unknown path). Since k4c every one of them must pass; there is no baseline mode.
const ALL_ROUTES = ['/', '/about/', '/accessibility/', '/approach/', '/connect/', '/contact/', '/discovery/', '/guides/', '/guides/website-maintenance-after-launch/',
  '/guides/website-ownership-handoff/', '/local-visibility-sample/', '/privacy/', '/services/', '/services/websites/', '/services/website-care/',
  '/services/business-systems-automation/', '/services/digital-ownership-platform-administration/', '/services/technology-consulting/', '/share/', '/terms/',
  '/website-check/', '/work/', '/work/document-control/', '/work/gas-engine/', '/work/owner-console/', '/work/interview-facilitator/', '/work/reputation/',
  '/work/secure-exchange/', '/this-page-does-not-exist/'];

// k5c (P2-1, Critiquito k5): the short 375x667 phone is checked too, for every carousel. A few cards are taller than the whole usable 375x667
// screen (header to bar); no dot placement can clear those, so they are listed by name in TALLER_THAN_SHORT_SCREEN and the test fails if
// any other carousel joins the list or if a listed one starts to fit (then it must pass like the rest).
const SHORT_PHONE = [375, 667];
const TALLER_THAN_SHORT_SCREEN = ['/services/ The four LDW services', '/services/ Website plans', '/work/ LDW systems and internal proof'];
test('every phone carousel card AND its dots clear the real MobileContactBar rect by >= 24px with the card parked under the header (390x844, 375x812, 360x780 and the short 375x667)', async ({ page }) => {
  test.setTimeout(300_000);
  const oversize = new Set();
  for (const [width, height] of [...PHONES, SHORT_PHONE]) {
    const short = width === SHORT_PHONE[0] && height === SHORT_PHONE[1];
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/services/', '/about/', '/connect/', '/discovery/', '/work/', ...K4A, '/approach/']) {
      await page.goto(route);
      await page.waitForTimeout(300);
      const rows = await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = 'auto';
        const out = [];
        for (const car of document.querySelectorAll('[data-carousel]')) {
          const dots = car.querySelector('[data-carousel-dots]');
          for (const [i, slide] of [...car.querySelectorAll('[data-carousel-slide]')].entries()) {
            const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
            window.scrollBy(0, slide.getBoundingClientRect().top - (header + 8));
            await new Promise((r) => setTimeout(r, 120));
            const barEl = document.querySelector('.mobile-contact-bar');
            // Pages without the Text/Call bar (e.g. Discovery) measure against the viewport bottom instead.
            const bar = barEl && getComputedStyle(barEl).display !== 'none' ? barEl.getBoundingClientRect() : { top: window.innerHeight };
            const c = slide.getBoundingClientRect();
            const d = dots.getBoundingClientRect();
            // room: the tallest card that could still leave its dots >= 24px above the bar when parked 8px under the header.
            const room = bar.top - 24 - (d.bottom - c.bottom) - (header + 8);
            out.push({ car: car.getAttribute('aria-label'), i, top: c.top, header, card: bar.top - c.bottom, dots: bar.top - d.bottom, dotsShown: !dots.hidden, h: c.height, room });
          }
        }
        return out;
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const at = `${width}x${height} ${route} ${r.car} slide ${r.i + 1}`;
        expect(r.dotsShown, `${at} dots shown`).toBe(true);
        expect(r.top, `${at} card top not under header`).toBeGreaterThanOrEqual(r.header);
        if (short && rows.some((o) => o.car === r.car && o.h > o.room)) { oversize.add(`${route} ${r.car}`); continue; }
        expect(r.card, `${at} card bottom to bar`).toBeGreaterThanOrEqual(24);
        expect(r.dots, `${at} dots to bar`).toBeGreaterThanOrEqual(24);
      }
    }
  }
  expect([...oversize].sort(), '375x667 carousels whose tallest card is taller than the usable screen').toEqual([...TALLER_THAN_SHORT_SCREEN].sort());
});

test('shared carousel: opens on slide 1, 44px dots, dot click moves only the track, peek >= 20px; grid with no dots at desktop', async ({ page }) => {
  for (const [width, height] of [[390, 844], [360, 780]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/services/');
    for (const label of ['The four LDW services', 'Website plans']) {
      const car = page.locator(`[data-carousel][aria-label="${label}"]`);
      await car.scrollIntoViewIfNeeded();
      const dots = car.locator('[data-carousel-dot]');
      await expect(dots.first()).toHaveAttribute('aria-current', 'true');
      for (const box of await dots.evaluateAll((ds) => ds.map((d) => d.getBoundingClientRect()))) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const peek = await car.evaluate((c) => {
        const t = c.querySelector('[data-carousel-track]').getBoundingClientRect();
        const s = c.querySelectorAll('[data-carousel-slide]')[1].getBoundingClientRect();
        return t.right - s.left;
      });
      expect(peek, `${width} ${label} next-card peek`).toBeGreaterThanOrEqual(20);
      const y0 = await page.evaluate(() => scrollY);
      await dots.nth(2).evaluate((d) => d.click());
      await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');
      expect(await page.evaluate(() => scrollY)).toBe(y0);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services/');
  for (const label of ['The four LDW services', 'Website plans']) {
    const car = page.locator(`[data-carousel][aria-label="${label}"]`);
    await expect(car.locator('[data-carousel-dots]')).toBeHidden();
    expect(await car.locator('[data-carousel-track]').evaluate((t) => getComputedStyle(t).display)).toBe('grid');
  }
  const cols = await page.locator('.plans-car [data-carousel-track]').evaluate((t) => getComputedStyle(t).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(4);
});

test('carousel without JavaScript: dots stay hidden and every card is still reachable', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/services/');
  await expect(page.locator('[data-carousel-dots]').first()).toBeHidden();
  await expect(page.locator('.svc-card')).toHaveCount(4);
  await expect(page.locator('.plan-slide')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await ctx.close();
});

test('Services: one dark mesh band, #start-mobile gone, both hero links go to #start, one CTA per card, gold eyebrow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services/');
  await expect(page.locator('#start-mobile')).toHaveCount(0);
  await expect(page.locator('.router-tile')).toHaveCount(0);
  await expect(page.locator('a.hero-start')).toHaveAttribute('href', '#start');
  await expect(page.locator('a.hero-next')).toHaveAttribute('href', '#start');
  await expect(page.locator('section.svc-band#start')).toHaveCount(1);
  await expect(page.locator('.svc-card a.svc-card__surface')).toHaveCount(4);
  await expect(page.locator('#start .eyebrow')).toHaveCSS('color', 'rgb(230, 208, 143)');
  expect(await page.locator('#start').evaluate((s) => getComputedStyle(s).backgroundColor)).toBe('rgb(16, 42, 58)');
});

test('Plans at desktop: four equal columns and the "adds" wells start on one line (subgrid)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services/');
  const rects = await page.locator('.plan-slide').evaluateAll((ss) => ss.map((s) => ({ w: s.getBoundingClientRect().width, adds: s.querySelector('.plan-slide__adds').getBoundingClientRect().top, inc: s.querySelector('.plan-slide__sub').getBoundingClientRect().top })));
  expect(rects).toHaveLength(4);
  for (const r of rects) {
    expect(Math.abs(r.w - rects[0].w)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.adds - rects[0].adds)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.inc - rects[0].inc)).toBeLessThanOrEqual(1);
  }
  await expect(page.getByText(/recommended/i)).toHaveCount(0);
});

test('Home router: depth cards on a deeper plate at desktop, number beside the icon, 44px arrow disc, phone carousel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const card = page.locator('#start a.problem-choice').first();
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(card).toHaveCSS('border-top-color', 'rgb(201, 194, 178)');
  await expect(page.locator('#start [data-carousel-track]')).toHaveCSS('background-color', 'rgb(232, 226, 212)');
  const arrow = await page.locator('#start .problem-choice__arrow').first().boundingBox();
  expect(arrow.width).toBeGreaterThanOrEqual(44);
  await expect(page.locator('#start a.problem-choice')).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const h = await page.locator('#start').evaluate((s) => s.getBoundingClientRect().height);
  expect(h).toBeLessThan(900);
});

test('founder photo appears once on Home (in "Work with Eddie"); the hero card keeps its text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('img[src="/founder/eddie-gugino-founder.webp"]')).toHaveCount(1);
  await expect(page.locator('.section--founder-cta img[data-founder-portrait]')).toHaveCount(1);
  await expect(page.locator('.hero-owner-card img')).toHaveCount(0);
  await expect(page.locator('.hero-owner-card')).toContainText('Eddie Gugino');
});

test('11 towns stay equal; South of the Broad is a 2x2 in a panel narrowed to that cluster (Home and Connect)', async ({ page }) => {
  for (const route of ['/', '/connect/']) {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(route);
      const r = await page.evaluate(() => {
        const north = [...document.querySelectorAll('ul.towns--north li')].map((li) => li.getBoundingClientRect());
        const south = [...document.querySelectorAll('ul.towns--south li')].map((li) => li.getBoundingClientRect());
        const panel = document.querySelector('ul.towns--south').closest('.town-group').getBoundingClientRect();
        return { n: north.length, s: south.length, widths: [...north, ...south].map((b) => b.width), heights: [...north, ...south].map((b) => b.height), southCols: new Set(south.map((b) => Math.round(b.left))).size, southRows: new Set(south.map((b) => Math.round(b.top))).size, panelW: panel.width, clusterW: Math.max(...south.map((b) => b.right)) - Math.min(...south.map((b) => b.left)) };
      });
      const at = `${route} ${width}`;
      expect(r.n + r.s, at).toBe(11);
      expect(Math.max(...r.widths) - Math.min(...r.widths), `${at} equal tile widths`).toBeLessThanOrEqual(1);
      // At phone widths "St. Helena Island" may wrap to two lines inside its equal-width tile (unchanged from base).
      if (width === 1440) expect(Math.max(...r.heights) - Math.min(...r.heights), `${at} equal tile heights`).toBeLessThanOrEqual(1);
      expect([r.southCols, r.southRows], `${at} South 2x2`).toEqual([2, 2]);
      if (width === 1440) expect(r.panelW - r.clusterW, `${at} South panel hugs its 2-column cluster`).toBeLessThanOrEqual(48);
    }
  }
});

test('rule fixes: no decorative marsh art on About, no doubled Discovery caption, Care-gold eyebrows only on dark', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('img[src*="towns-strip"]')).toHaveCount(0);
  await expect(page.locator('img[alt*="marsh" i]')).toHaveCount(0);
  await page.goto('/discovery/');
  await expect(page.locator('p.caption', { hasText: 'How a first note moves' })).toHaveCount(0);
  await expect(page.getByText(/illustration/i)).toHaveCount(0);
});

test('no horizontal overflow and axe-clean (wcag2a/aa) on the seven pages at 1440, 390 and 360', async ({ page }) => {
  test.setTimeout(180_000);
  for (const [width, height] of [[1440, 900], [390, 844], [360, 780]]) {
    await page.setViewportSize({ width, height });
    for (const route of PAGES) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route} ${width} overflowX`).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `${route} ${width} axe`).toEqual([]);
    }
  }
});

// Kit 2: About, Discovery, Connect, Work, Document Control and the shared mesh band.
test('k2: About, Discovery, Connect and Work use the shared carousel with depth cards; desktop grids show no dots', async ({ page }) => {
  const cases = [['/about/', 'Principles', 4], ['/discovery/', 'What to expect', 3], ['/connect/', 'How a first note moves', 4], ['/work/', 'LDW systems and internal proof', 5]];
  for (const [route, label, n] of cases) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const car = page.locator(`[data-carousel][aria-label="${label}"]`);
    await expect(car, `${route} carousel`).toHaveCount(1);
    await expect(car.locator('[data-carousel-slide]')).toHaveCount(n);
    await expect(car.locator('[data-carousel-dots]')).toBeVisible();
    const shadow = await car.locator('[data-carousel-slide] > *').first().evaluate((el) => getComputedStyle(el.matches('article, div') ? el : el.parentElement).boxShadow);
    expect(shadow, `${route} depth shadow`).not.toBe('none');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await expect(car.locator('[data-carousel-dots]')).toBeHidden();
  }
});

test('k2: mesh band on the existing dark strips and the one Discovery band; Connect has no dark band', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ['/', '/about/', '/discovery/', '/work/', '/work/document-control/']) {
    await page.goto(route);
    const navy = page.locator('main .section--navy');
    expect(await navy.count(), `${route} dark bands`).toBe(1);
    await expect(navy.first(), `${route} mesh`).toHaveClass(/band-mesh/);
    const bg = await navy.first().evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg, `${route} mesh gradient`).toContain('radial-gradient');
  }
  await page.goto('/connect/');
  await expect(page.locator('main .section--navy')).toHaveCount(0);
});

test('k2 (k5d: on-card actions): Connect contact actions are equal; Work tool frames share one height at desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/connect/');
  const tiles = await page.locator('.biz-card .biz-card__actions .biz-card__action').evaluateAll((els) => els.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height), getComputedStyle(el).backgroundColor]));
  expect(tiles.length).toBe(3);
  for (const t of tiles) expect(t, 'tile matches the first').toEqual(tiles[0]);
  await page.goto('/work/');
  const frames = await page.locator('.tools-car .tool-card__frame').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(frames.length).toBe(5);
  for (const h of frames) expect(Math.abs(h - frames[0])).toBeLessThanOrEqual(1);
});

// Kit 3: 44px tap targets everywhere on the seven pages (P2-1) and the Home request flow + tools on the shared components (P2-2).
// No exemptions: every visible interactive element must offer a hit area of at least 44x44 CSS px. The hit area is the element box,
// widened by an absolutely positioned ::before/::after when a short label uses one (breadcrumbs), so the reading layout does not move.
const TAP_EXEMPT = []; // [route, accessible text] pairs; keep empty unless a true in-prose link cannot reach 44px (list it in the FEE)
test('k3: every visible a, button, [role=button], input, select, summary and carousel dot is at least 44x44 on the seven pages at 390 and 360', async ({ page }) => {
  test.setTimeout(120_000);
  const misses = [];
  for (const [width, height] of [[390, 844], [360, 780]]) {
    await page.setViewportSize({ width, height });
    for (const route of PAGES) {
      await page.goto(route);
      await page.waitForTimeout(150);
      const rows = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, summary, [data-carousel-dot]')) {
          if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          let w = r.width, h = r.height;
          for (const ps of ['::before', '::after']) {
            const p = getComputedStyle(el, ps);
            if (p.content === 'none' || p.position !== 'absolute') continue;
            w = Math.max(w, parseFloat(p.width) || 0);
            h = Math.max(h, parseFloat(p.height) || 0);
          }
          out.push({ text: (el.innerText || el.getAttribute('aria-label') || el.value || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60), w, h });
        }
        return out;
      });
      expect(rows.length, `${route} has interactive elements`).toBeGreaterThan(5);
      for (const r of rows) {
        if (TAP_EXEMPT.some(([p, t]) => p === route && t === r.text)) continue;
        if (r.w < 43.5 || r.h < 43.5) misses.push(`${width} ${route} "${r.text}" ${r.w.toFixed(1)}x${r.h.toFixed(1)}`);
      }
    }
  }
  expect(misses, 'sub-44px tap targets').toEqual([]);
});

test('k3: grown tap targets do not move the page (Connect links, Document Control captions and breadcrumb keep their place)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connect/');
  const links = page.locator('.connect-links a');
  for (let i = 0; i < await links.count(); i += 1) expect((await links.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(44);
  const gap = await page.locator('.connect-links').evaluate((el) => getComputedStyle(el).rowGap);
  expect(gap).not.toBe('normal');
  await page.goto('/work/document-control/');
  const crumb = page.locator('.breadcrumbs a[href="/work/"]');
  const box = await crumb.boundingBox();
  const hit = await crumb.evaluate((el) => parseFloat(getComputedStyle(el, '::after').width));
  expect(hit).toBeGreaterThanOrEqual(44);
  expect(box.width, 'the label keeps its own width').toBeLessThan(44);
  await crumb.focus();
  expect(await crumb.evaluate((el) => getComputedStyle(el).outlineStyle), 'focus ring stays visible').not.toBe('none');
});

test('k3: Home request flow and tools use the shared carousel and depth cards; the tools row links into /work/', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const flow = page.locator('#home-request [data-carousel][aria-label="How a request moves"]');
  await expect(flow.locator('[data-carousel-slide] .flow-card')).toHaveCount(3);
  await expect(flow.locator('[data-carousel-dots]')).toBeVisible();
  const tools = page.locator('[data-home-internal-proof] [data-carousel]');
  await expect(tools.locator('[data-carousel-slide] .tool-card')).toHaveCount(5);
  await expect(tools.locator('[data-carousel-dots]')).toBeVisible();
  await expect(page.locator('[data-home-internal-proof] .home-tools__more a')).toHaveAttribute('href', '/work/#internal-proof');
  for (const card of [flow.locator('.flow-card').first(), tools.locator('.tool-card').first()]) expect(await card.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(flow.locator('[data-carousel-dots]')).toBeHidden();
  const flowTops = await flow.locator('[data-carousel-slide]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(flowTops).size, 'three steps in one row').toBe(1);
  const frames = await tools.locator('.tool-card__frame').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  expect(frames.length).toBe(5);
  for (const h of frames) expect(Math.abs(h - frames[0])).toBeLessThanOrEqual(1);
});

test('k3: About principle 03 carries the Services non-endorsement line under the five tool marks, word for word', async ({ page }) => {
  const LINE = 'Marks identify tools LDW uses. They do not imply endorsement by those companies.';
  await page.goto('/services/');
  await expect(page.locator('.svc-card__visual .tool-row + .caption')).toHaveText(LINE);
  for (const [width, height] of [[1440, 900], [390, 844], [360, 780]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/about/');
    const media = page.locator('.principle-card .num-card__media:has(> .tool-row)');
    await expect(media.locator('.tool-row img')).toHaveCount(5);
    const caption = media.locator('.tool-row + .caption');
    await expect(caption).toHaveText(LINE);
    const [row, cap, box] = await Promise.all([media.locator('.tool-row').boundingBox(), caption.boundingBox(), media.boundingBox()]);
    expect(cap.y, `${width}: line sits below the marks`).toBeGreaterThanOrEqual(row.y + row.height - 1);
    expect(cap.y + cap.height, `${width}: line stays inside the frame`).toBeLessThanOrEqual(box.y + box.height + 1);
  }
});

// Kit 4a: project and service detail pages on the R5 templates, and the 29-route audit (tap targets, overflow, axe incl. color-contrast).
const TAP_JS = () => {
  const out = [];
  for (const el of document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, summary, [data-carousel-dot]')) {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let w = r.width, h = r.height;
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (p.content === 'none' || p.position !== 'absolute') continue;
      w = Math.max(w, parseFloat(p.width) || 0);
      h = Math.max(h, parseFloat(p.height) || 0);
    }
    if (w < 43.5 || h < 43.5) out.push(`"${(el.innerText || el.getAttribute('aria-label') || el.value || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60)}" ${w.toFixed(1)}x${h.toFixed(1)}`);
  }
  return out;
};
const WIDTHS = [[1440, 900], [390, 844], [360, 780]];
const report = async (testInfo, name, misses) => {
  await testInfo.attach(name, { body: JSON.stringify(misses, null, 1), contentType: 'application/json' });
  // Optional: K4_AUDIT_OUT=<dir> writes the per-route misses (expected: {}) next to the gate evidence (off by default; tests never write elsewhere).
  if (process.env.K4_AUDIT_OUT) writeFileSync(`${process.env.K4_AUDIT_OUT}/${name}.json`, JSON.stringify(misses, null, 1));
};

test('k4: every visible a, button, [role=button], input, select, summary and carousel dot is at least 44x44 on all 29 routes at 1440, 390 and 360 (every route must pass)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const byRoute = {};
  const fails = [];
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(120);
      const misses = await page.evaluate(TAP_JS);
      if (!misses.length) continue;
      byRoute[`${width} ${route}`] = misses;
      fails.push(...misses.map((m) => `${width} ${route} ${m}`));
    }
  }
  await report(testInfo, 'k4-tap-misses', byRoute);
  expect(fails, 'sub-44px tap targets').toEqual([]);
});

test('k4: no horizontal overflow and axe-clean (wcag2a/aa incl. color-contrast) on all 29 routes at 1440, 390 and 360 (every route must pass)', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const byRoute = {};
  const fails = [];
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const misses = [...(overflow > 0 ? [`overflowX ${overflow}px`] : []), ...axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)];
      if (!misses.length) continue;
      byRoute[`${width} ${route}`] = misses;
      fails.push(...misses.map((m) => `${width} ${route} ${m}`));
    }
  }
  await report(testInfo, 'k4-overflow-axe-misses', byRoute);
  expect(fails, 'overflow or axe violations').toEqual([]);
});

test('k4a: every /work/<slug>/ page uses the R5 project template: proof steps and 2+ screenshots on the shared carousel, one mesh band, icon frame where no screenshot exists', async ({ page }) => {
  test.setTimeout(120_000);
  const cases = [['/work/gas-engine/', 4, 1], ['/work/document-control/', 4, 2], ['/work/owner-console/', 2, 3], ['/work/interview-facilitator/', 3, 1], ['/work/reputation/', 3, 0], ['/work/secure-exchange/', 4, 2]];
  for (const [route, steps, shots] of cases) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    await expect(page.locator('html'), `${route} R5`).toHaveAttribute('data-dir', 'l');
    const proc = page.locator('[data-carousel][aria-label="How the proof is structured"]');
    await expect(proc.locator('[data-carousel-slide] > .project-process__step'), `${route} steps`).toHaveCount(steps);
    await expect(proc.locator('[data-carousel-dots]')).toBeVisible();
    expect(await proc.locator('.project-process__step').first().evaluate((el) => getComputedStyle(el).boxShadow), `${route} depth`).not.toBe('none');
    const vis = page.locator('[data-carousel][aria-label="Visual evidence"]');
    await expect(vis, `${route} screenshot carousel`).toHaveCount(shots > 1 ? 1 : 0);
    await expect(page.locator('.project-visual'), `${route} screenshots`).toHaveCount(shots);
    // k5/k5b (Eddie's Nov 14 rule, no placeholder or disclaimer text): the "screenshots will appear here" note and its empty icon frame are gone.
    await expect(page.locator('.asset-gap, .asset-gap__mark'), `${route} no empty proof frame`).toHaveCount(0);
    expect(await page.locator('main').innerText(), `${route} no "will appear here" note`).not.toMatch(/will appear here|Public-safe screenshots/i);
    const navy = page.locator('main .section--navy');
    await expect(navy).toHaveCount(1);
    await expect(navy.first()).toHaveClass(/band-mesh/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await expect(proc.locator('[data-carousel-dots]')).toBeHidden();
    const tops = await proc.locator('[data-carousel-slide]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size, `${route} steps in one row at desktop`).toBe(1);
  }
});

test('k4a: service detail outcomes are three depth cards with a neutral 24px check marker in the 40px chip (no implied order) on the shared carousel (one row at desktop) and every navy band carries the mesh', async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of K4A.filter((r) => r.startsWith('/services/'))) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const car = page.locator('[data-carousel][aria-label="Useful outcomes"]');
    await expect(car.locator('[data-carousel-slide] > .svc-outcomes__item'), `${route} outcomes`).toHaveCount(3);
    await expect(car.locator('[data-carousel-dots]')).toBeVisible();
    expect(await car.locator('.svc-outcomes__item').first().evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
    const marks = car.locator('.svc-outcomes__n');
    await expect(marks, `${route} markers`).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(marks.nth(i), `${route} marker ${i + 1} is the check icon`).toHaveAttribute('aria-hidden', 'true');
      await expect(marks.nth(i).locator('svg.ui-icon path')).toHaveAttribute('d', 'm5 12.5 4.5 4.5L19 7');
      const svg = await marks.nth(i).locator('svg.ui-icon').boundingBox();
      const chip = await marks.nth(i).boundingBox();
      expect([Math.round(svg.width), Math.round(svg.height)], `${route} marker ${i + 1} check is 24x24`).toEqual([24, 24]);
      expect(Math.round(chip.height), `${route} marker ${i + 1} chip stays 40px`).toBe(40);
      expect((await marks.nth(i).textContent()).trim(), `${route} marker ${i + 1} carries no ordinal`).toBe('');
    }
    const navy = page.locator('main .section--navy');
    expect(await navy.count(), `${route} navy bands`).toBeGreaterThan(0);
    for (let i = 0; i < await navy.count(); i += 1) await expect(navy.nth(i), `${route} band ${i + 1} mesh`).toHaveClass(/band-mesh/);
    const provider = await page.locator('.service-provider a').boundingBox();
    expect(provider.height, `${route} Provided by link`).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await expect(car.locator('[data-carousel-dots]')).toBeHidden();
    const tops = await car.locator('[data-carousel-slide]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size, `${route} three outcomes in one row`).toBe(1);
  }
});

test('k4a: /work/reputation/ breadcrumb and View source reach 44px without moving their labels', async ({ page }) => {
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto('/work/reputation/');
    const crumb = page.locator('.breadcrumbs a[href="/work/"]');
    expect(await crumb.evaluate((el) => parseFloat(getComputedStyle(el, '::after').width)), `${width} crumb hit width`).toBeGreaterThanOrEqual(44);
    expect((await crumb.boundingBox()).height, `${width} crumb height`).toBeGreaterThanOrEqual(44);
    const src = page.locator('.page-hero a[href*="github.com/LowcountryDigitalWorks/reputation"]');
    const box = await src.boundingBox();
    expect(box.height, `${width} View source height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${width} View source width`).toBeGreaterThanOrEqual(44);
    await src.focus();
    expect(await src.evaluate((el) => getComputedStyle(el).outlineStyle), 'focus ring stays visible').not.toBe('none');
  }
});

test('k4b: the seven k4b routes are on R5 with a mesh on every navy band; Approach stages and expectations are depth cards on the shared carousel', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of K4B) {
    await page.goto(route);
    await expect(page.locator('html'), `${route} R5`).toHaveAttribute('data-dir', 'l');
    const navy = page.locator('main .section--navy');
    for (let i = 0; i < await navy.count(); i += 1) await expect(navy.nth(i), `${route} band ${i + 1} mesh`).toHaveClass(/band-mesh/);
  }
  for (const route of ['/approach/', '/guides/', '/guides/website-ownership-handoff/', '/contact/']) {
    await page.goto(route);
    await expect(page.locator('.page-hero .page-hero-plate h1'), `${route} hero plate`).toHaveCount(1);
  }
  await page.goto('/approach/');
  const stages = page.locator('[data-carousel][aria-label="Three stages"]');
  await expect(stages.locator('[data-carousel-slide] > .flow__step.depth-card')).toHaveCount(3);
  await expect(stages.locator('.depth-card__n')).toHaveText(['01', '02', '03']);
  await expect(stages.locator('[data-carousel-dots]')).toBeVisible();
  expect(await stages.locator('.flow__step').first().evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  await expect(page.locator('.approach-expectations [data-carousel-slide] > .card.depth-card')).toHaveCount(4);
  await page.goto('/guides/');
  await expect(page.locator('.guide-card.depth-card')).toHaveCount(2);
  await page.goto('/contact/');
  await expect(page.locator('.contact-safety.depth-card')).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/approach/');
  await expect(stages.locator('[data-carousel-dots]')).toBeHidden();
  const tops = await stages.locator('[data-carousel-slide]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size, 'three stages in one row at desktop').toBe(1);
});

test('k4b: guide source links, Website Check and Local Visibility summaries and Contact socials reach 44px; each Contact social shows its own mark', async ({ page }) => {
  test.setTimeout(120_000);
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    for (const route of ['/guides/website-maintenance-after-launch/', '/guides/website-ownership-handoff/']) {
      await page.goto(route);
      const links = page.locator('.guide-source-list a');
      expect(await links.count(), `${route} sources`).toBeGreaterThan(0);
      for (let i = 0; i < await links.count(); i += 1) {
        const hit = await links.nth(i).evaluate((el) => parseFloat(getComputedStyle(el, '::after').height));
        expect(hit, `${width} ${route} source ${i + 1} hit height`).toBeGreaterThanOrEqual(44);
      }
    }
    for (const [route, sel] of [['/website-check/', '.audit-demo__details > summary'], ['/local-visibility-sample/', '.local-proof__detail > summary']]) {
      await page.goto(route);
      expect((await page.locator(sel).first().boundingBox()).height, `${width} ${route} summary`).toBeGreaterThanOrEqual(44);
    }
    await page.goto('/contact/');
    const socials = page.locator('.social-list a');
    await expect(socials).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      const box = await socials.nth(i).boundingBox();
      expect(Math.min(box.width, box.height), `${width} social ${i + 1}`).toBeGreaterThanOrEqual(44);
    }
  }
  const marks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.social-list a')].map((a) => [a.textContent.trim(), a.querySelector('svg').innerHTML])));
  const footer = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.footer-social-link')].map((a) => [a.textContent.trim(), a.querySelector('svg').innerHTML])));
  for (const name of ['Facebook', 'X', 'LinkedIn']) expect(marks[name], `${name} mark matches the footer`).toBe(footer[name]);
});

test('k4b P2-1 (k4c update): on phones every /work/<slug>/ hero keeps its CTAs >= 24px above the real MobileContactBar, "Why it matters" follows within a normal section gap, and the Why plate top and heading clear the bar by >= 24px (all 18 cases; Document Control chips share one row)', async ({ page }) => {
  test.setTimeout(120_000);
  const projects = K4A.filter((r) => r.startsWith('/work/'));
  // k4d: no exceptions. Document Control's two chips share one row on phones (k4c listed 375x667 as an exception at +3.1px), so all 18 cases need 24.
  for (const [width, height] of [[390, 844], [360, 780], [375, 667]]) {
    await page.setViewportSize({ width, height });
    for (const route of projects) {
      await page.goto(route);
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const copy = document.querySelector('.project-hero-grid > .readable');
        const ctas = [...copy.querySelectorAll('.actions a, .actions button, a.button')].filter((el) => el.offsetParent);
        const cta = Math.max(...ctas.map((el) => el.getBoundingClientRect().bottom));
        const bar = document.querySelector('.mobile-contact-bar').getBoundingClientRect().top;
        const card = document.querySelector('.project-hero-grid > .project-summary-card');
        const why = card.getBoundingClientRect().top;
        const heading = card.querySelector('.eyebrow').getBoundingClientRect().bottom;
        const section = document.querySelector('main > .section:not(.page-hero)');
        const sectionGap = section ? parseFloat(getComputedStyle(section).paddingTop) * 2 : 64;
        const chips = [...copy.querySelectorAll('.chip-row > .chip')].map((el) => el.getBoundingClientRect());
        const chipFont = chips.length ? parseFloat(getComputedStyle(copy.querySelector('.chip-row > .chip')).fontSize) : null;
        return { cta, bar, why, heading, sectionGap, ctaCount: ctas.length, chipTops: chips.map((r) => r.top), chipHeights: chips.map((r) => r.height), chipFont };
      });
      const key = `${width}x${height} ${route}`;
      expect(m.ctaCount, `${key} CTAs`).toBeGreaterThan(0);
      expect(m.bar - m.cta, `${key} CTA clearance`).toBeGreaterThanOrEqual(24);
      expect(m.why - m.cta, `${key} CTA-to-Why gap`).toBeLessThanOrEqual(m.sectionGap);
      expect(m.why - m.cta, `${key} Why below CTAs`).toBeGreaterThan(0);
      expect(m.bar - m.why, `${key} Why plate top clearance`).toBeGreaterThanOrEqual(24);
      expect(m.bar - m.heading, `${key} Why heading clearance`).toBeGreaterThanOrEqual(24);
      if (m.chipTops.length) {
        expect(new Set(m.chipTops.map((t) => Math.round(t))).size, `${key} chips share one row`).toBe(1);
        for (const h of m.chipHeights) expect(h, `${key} chip tap height`).toBeGreaterThanOrEqual(44);
        expect(m.chipFont, `${key} chip type stays on the R5 scale`).toBeGreaterThanOrEqual(12.8);
      }
    }
  }
});

// k4c L-N2 (Challenger k4b review): the k4b snug heroes (8cd0aa6). On phones the hero's key content (its CTAs, or the whole hero copy plate where the hero has no CTAs)
// clears the real MobileContactBar by >= 24px, and the next section starts within one normal section gap of it (no stretched empty hero).
test('k4c L-N2 (+k5c L3): on phones the snug heroes (Approach, Guides, ownership guide, Contact, Accessibility, Privacy, Terms, Share) keep their CTAs or hero copy >= 24px above the real MobileContactBar and the next section starts within the gap', async ({ page }) => {
  test.setTimeout(120_000);
  // k5c L3 (Challenger k5): the four k4c snug heroes (Accessibility, Privacy, Terms, Share) are held to the same rule.
  const SNUG = ['/approach/', '/guides/', '/guides/website-ownership-handoff/', '/contact/', '/accessibility/', '/privacy/', '/terms/', '/share/'];
  const rows = [];
  for (const [width, height] of [[390, 844], [360, 780], [375, 667]]) {
    await page.setViewportSize({ width, height });
    for (const route of SNUG) {
      await page.goto(route);
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const hero = document.querySelector('.page-hero.page-hero--snug');
        if (!hero) return null;
        const ctas = [...hero.querySelectorAll('.actions a, .actions button, a.button')].filter((el) => el.offsetParent);
        const plate = hero.querySelector('.page-hero-plate, .readable') || hero.querySelector('.container');
        const key = ctas.length ? Math.max(...ctas.map((el) => el.getBoundingClientRect().bottom)) : plate.getBoundingClientRect().bottom;
        const bar = document.querySelector('.mobile-contact-bar').getBoundingClientRect().top;
        let next = hero.nextElementSibling;
        while (next && !next.getBoundingClientRect().height) next = next.nextElementSibling;
        if (!next) next = hero.parentElement.nextElementSibling;
        const nextTop = next.getBoundingClientRect().top;
        const sectionGap = parseFloat(getComputedStyle(next).paddingTop) * 2 || 64;
        return { kind: ctas.length ? 'CTAs' : 'hero copy', key, bar, nextTop, sectionGap, heroBottom: hero.getBoundingClientRect().bottom };
      });
      const label = `${width}x${height} ${route}`;
      expect(m, `${label} has a snug hero`).not.toBeNull();
      rows.push({ label, ...m });
      expect.soft(m.bar - m.key, `${label} ${m.kind} clearance above the bar`).toBeGreaterThanOrEqual(24);
      expect.soft(m.nextTop - m.key, `${label} next section starts within the gap`).toBeLessThanOrEqual(m.sectionGap);
      expect.soft(m.nextTop, `${label} next section follows the hero`).toBeGreaterThanOrEqual(m.key);
    }
  }
  if (process.env.K4_AUDIT_OUT) writeFileSync(`${process.env.K4_AUDIT_OUT}/k4c-snug-heroes.json`, JSON.stringify(rows, null, 1));
});

// k5b (Coordinator): /work/reputation/ has no screenshot, so the Evidence section ends with its evidence cards: no empty card or frame renders,
// and the section closes at its own bottom padding (no leftover gap) at 1440, 390 and 360.
test('k5b: /work/reputation/ Evidence section renders no empty proof card and closes up at its own padding at 1440, 390 and 360', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844], [360, 780]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/work/reputation/');
    const m = await page.evaluate(() => {
      const sec = document.querySelector('#proof');
      const box = sec.querySelector(':scope > .container');
      const cards = [...sec.querySelectorAll('article, .card, .depth-card, [class*="card"], .asset-gap, figure, aside')].filter((el) => el.getBoundingClientRect().height > 0);
      const empty = cards.filter((el) => !el.textContent.trim() && !el.querySelector('img, picture, video'));
      const last = box.lastElementChild;
      return {
        empty: empty.map((el) => el.className || el.tagName),
        lastClass: last.className,
        gap: sec.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom,
        pad: parseFloat(getComputedStyle(sec).paddingBottom) + parseFloat(getComputedStyle(box).paddingBottom) + parseFloat(getComputedStyle(last).marginBottom),
      };
    });
    const key = `${width}x${height}`;
    expect(m.empty, `${key} empty cards`).toEqual([]);
    expect(m.lastClass, `${key} the section ends with the evidence cards`).toContain('evidence-grid');
    expect(Math.abs(m.gap - m.pad), `${key} gap below the evidence cards ${m.gap} vs padding ${m.pad}`).toBeLessThanOrEqual(1.5);
  }
});

test('k4c: on phones every R5 route with the MobileContactBar keeps scroll-padding-bottom >= the bar height + 24px', async ({ page }) => {
  test.setTimeout(120_000);
  for (const [width, height] of [[390, 844], [375, 667]]) {
    await page.setViewportSize({ width, height });
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.mobile-contact-bar');
        const shown = bar && getComputedStyle(bar).display !== 'none';
        return { shown, barH: shown ? bar.getBoundingClientRect().height : 0, pad: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) || 0 };
      });
      if (!m.shown) continue;
      expect(m.pad, `${width}x${height} ${route} scroll-padding-bottom vs bar ${m.barH}`).toBeGreaterThanOrEqual(m.barH + 24);
    }
  }
});

test('k4c: every route is on R5; the legal pages, Secure Share and the 404 page use the plate, depth surfaces and the mesh band', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ALL_ROUTES) {
    await page.goto(route);
    await expect(page.locator('html'), `${route} R5`).toHaveAttribute('data-dir', 'l');
    const navy = page.locator('main .section--navy');
    for (let i = 0; i < await navy.count(); i += 1) await expect(navy.nth(i), `${route} band ${i + 1} mesh`).toHaveClass(/band-mesh/);
  }
  for (const route of ['/accessibility/', '/privacy/', '/terms/']) {
    await page.goto(route);
    await expect(page.locator('.page-hero .page-hero-plate h1'), `${route} hero plate`).toHaveCount(1);
    await expect(page.locator('main .legal-sheet.depth-card'), `${route} legal sheet`).toHaveCount(1);
    expect(await page.locator('main .legal-sheet').evaluate((el) => getComputedStyle(el).boxShadow), `${route} depth`).not.toBe('none');
  }
  await page.goto('/share/');
  await expect(page.locator('.page-hero .page-hero-plate h1')).toHaveCount(1);
  await expect(page.locator('main .card.depth-card')).toHaveCount(2);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,noarchive');
  await expect(page.locator('script[src="/ldw-analytics.js"]'), 'Secure Share stays excluded from analytics').toHaveCount(0);
  await page.goto('/this-page-does-not-exist/');
  await expect(page.locator('main .notfound-card.depth-card h1')).toHaveText('That page is not here.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  // no marsh art outside the shared hero: k4c pages without a hero carry no background image in main
  const art = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((el) => getComputedStyle(el).backgroundImage.includes('url(')).length);
  expect(art, '404 has no hero art').toBe(0);
});

test('k4c: legal wording is unchanged by the restyle (text of <main> on Accessibility, Privacy and Terms matches the pre-k4c build)', async ({ page }) => {
  const { createHash } = await import('node:crypto');
  // sha256 (first 24 hex) of document.querySelector('main').textContent, recorded from the 9b21822 builds (flags OFF and analytics ON).
  const expected = {
    '/accessibility/': ['a15686ea1a5cb4e5f51d5951'],
    '/privacy/': ['c1462225da4f865b6a9739b4', '5a48d60142a38c9444441c90'],
    '/terms/': ['9c89c529ae1bc6c0c2a98380'],
  };
  for (const [route, shas] of Object.entries(expected)) {
    await page.goto(route);
    const text = await page.evaluate(() => document.querySelector('main').textContent);
    const sha = createHash('sha256').update(text).digest('hex').slice(0, 24);
    const analyticsBuild = await page.locator('script[src="/ldw-analytics.js"]').count();
    expect(shas, `${route} main text sha ${sha} (analytics build: ${analyticsBuild > 0})`).toContain(sha);
    if (route === '/privacy/') expect(sha, 'privacy variant matches the build flags').toBe(shas[analyticsBuild > 0 ? 1 : 0]);
  }
});

// k5c (P2-3, Critiquito k5): Connect's town chips broke "Habersham" and "Hardeeville" mid-word at 360. Every town name, on Home and Connect,
// must only wrap between whole words, at 1440, 390, 375x667 and 360; the 11 tiles stay equal width, 2 per row on phones, >= 44px tall.
test('k5c: town chip labels on Home and Connect never break mid-word at 1440, 390, 375x667 and 360; 11 equal tiles', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844], [375, 667], [360, 780]]) {
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/connect/']) {
      await page.goto(route);
      const rows = await page.evaluate(() => [...document.querySelectorAll('.town-group ul.towns li')].map((li) => {
        const t = li.firstChild;
        const broken = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(t.textContent))) {
          const r = document.createRange();
          r.setStart(t, m.index);
          r.setEnd(t, m.index + m[0].length);
          if ([...r.getClientRects()].filter((q) => q.width > 0.5).length > 1) broken.push(m[0]);
        }
        const b = li.getBoundingClientRect();
        return { town: li.textContent.trim(), broken, w: b.width, h: b.height, top: b.top };
      }));
      const at = `${width}x${height} ${route}`;
      expect(rows.length, `${at} 11 towns`).toBe(11);
      for (const r of rows) {
        expect(r.broken, `${at} ${r.town} breaks mid-word`).toEqual([]);
        expect(r.h, `${at} ${r.town} tap height`).toBeGreaterThanOrEqual(44);
      }
      const widths = rows.map((r) => r.w);
      expect(Math.max(...widths) - Math.min(...widths), `${at} equal tiles`).toBeLessThanOrEqual(0.5);
      if (width < 900) expect(new Set(rows.slice(0, 2).map((r) => Math.round(r.top))).size, `${at} two tiles per row`).toBe(1);
    }
  }
});
