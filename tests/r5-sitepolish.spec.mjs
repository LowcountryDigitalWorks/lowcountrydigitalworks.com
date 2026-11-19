import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// R5 site-wide polish, kit 1: shared carousel, Services band + plans, Home router, towns 2x2, footer marks, rule fixes.
// Desktop-only project: every test sets its own viewport (the mobile project would only repeat them).
test.skip(({ isMobile }) => isMobile, 'viewports are set per test');

const PHONES = [[390, 844], [375, 812], [360, 780]];
const PAGES = ['/', '/about/', '/connect/', '/discovery/', '/work/', '/work/document-control/', '/services/'];

test('every phone carousel card AND its dots clear the real MobileContactBar rect by >= 24px with the card parked under the header', async ({ page }) => {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/services/', '/about/', '/connect/', '/discovery/', '/work/']) {
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
            out.push({ car: car.getAttribute('aria-label'), i, top: c.top, header, card: bar.top - c.bottom, dots: bar.top - d.bottom, dotsShown: !dots.hidden });
          }
        }
        return out;
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const at = `${width}x${height} ${route} ${r.car} slide ${r.i + 1}`;
        expect(r.dotsShown, `${at} dots shown`).toBe(true);
        expect(r.top, `${at} card top not under header`).toBeGreaterThanOrEqual(r.header);
        expect(r.card, `${at} card bottom to bar`).toBeGreaterThanOrEqual(24);
        expect(r.dots, `${at} dots to bar`).toBeGreaterThanOrEqual(24);
      }
    }
  }
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

test('k2: Connect tiles are equal; Work tool frames share one height at desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/connect/');
  const tiles = await page.locator('.connect-actions .connect-action').evaluateAll((els) => els.map((el) => [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height), getComputedStyle(el).backgroundColor]));
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
