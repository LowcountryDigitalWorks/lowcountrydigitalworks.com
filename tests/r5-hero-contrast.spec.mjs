import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

// k4b L1 (Challenger k4a review): rendered-pixel contrast of every project-hero text element over the marsh band.
// For each element: read its text colour, make its text (and icon strokes) transparent, screenshot the element, then sample only the
// pixels under its glyph boxes (Range client rects). The background used is the worst 2% pixel on the side away from the text colour,
// so a photo showing through anywhere behind the words lowers the score. Every element must reach 4.5:1 at 1440, 1180, 1024, 390 and 360.
test.skip(({ isMobile }) => isMobile, 'viewports are set per test');

const PROJECTS = ['/work/gas-engine/', '/work/document-control/', '/work/owner-console/', '/work/interview-facilitator/', '/work/reputation/', '/work/secure-exchange/'];
// k4c L-N1 (Challenger): 1024 and 1180 added; without the plate those widths measured 4.05 and 2.70.
const WIDTHS = [[1440, 900], [1180, 820], [1024, 768], [390, 844], [360, 780]];
// k5c L2 (Challenger k5): the About founder card plates start at 761px, so the About tests also cover one width inside 761-899 and one inside 900-1000.
const ABOUT_WIDTHS = [...WIDTHS, [800, 900], [950, 900]];
// k5e L2 (Challenger k5d delta): L2 was about the project-hero plate (also from 761px), so the project-hero test gets the same two widths.
const PROJECT_WIDTHS = [...WIDTHS, [800, 900], [950, 900]];
const HERO_TEXT = [
  '.project-hero-grid > .readable .work-row__meta > span', '.project-hero-grid > .readable h1', '.project-hero-grid > .readable .lede',
  '.project-hero-grid > .readable .project-quick-boundary', '.project-hero-grid > .readable .chip', '.project-hero-grid > .readable .actions a',
  '.project-hero-grid > .project-summary-card p',
];
const lum = ([r, g, b]) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

async function measure(page, el) {
  const info = await el.evaluate((node) => {
    const rgb = getComputedStyle(node).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const box = node.getBoundingClientRect();
    const rects = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rects.push([r.left - box.left, r.top - box.top, r.width, r.height]);
    }
    return { rgb, w: box.width, rects };
  });
  if (!info.rects.length || info.w < 2) return null;
  const hide = (on) => el.evaluate((node, hidden) => {
    for (const k of [node, ...node.querySelectorAll('*')]) {
      for (const prop of ['color', 'text-decoration-color']) hidden ? k.style.setProperty(prop, 'transparent', 'important') : k.style.removeProperty(prop);
    }
  }, on);
  await hide(true);
  const png = await el.screenshot({ animations: 'disabled' });
  await hide(false);
  const { data, info: meta } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const scale = meta.width / info.w;
  const px = [];
  for (const [x, y, w, h] of info.rects) {
    const x0 = Math.max(0, Math.floor(x * scale)), y0 = Math.max(0, Math.floor(y * scale));
    const x1 = Math.min(meta.width, Math.ceil((x + w) * scale)), y1 = Math.min(meta.height, Math.ceil((y + h) * scale));
    for (let yy = y0; yy < y1; yy += 1) for (let xx = x0; xx < x1; xx += 1) {
      const i = (yy * meta.width + xx) * meta.channels; px.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (!px.length) return null;
  px.sort((a, b) => lum(a) - lum(b));
  const light = lum(info.rgb) > lum(px[Math.floor(px.length / 2)]);
  const bg = light ? px[Math.max(0, Math.floor(px.length * 0.98) - 1)] : px[Math.floor(px.length * 0.02)];
  return { ratio: ratio(info.rgb, bg), text: info.rgb, bg };
}

test('k4b L1 (+k5e L2): every project hero text element (pill, title, lede, boundary line, chips, buttons, View source, Why it matters) keeps >= 4.5:1 over the hero art at 1440, 1180, 1024, 950, 800, 390 and 360', async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const rows = [];
  for (const [width, height] of PROJECT_WIDTHS) {
    await page.setViewportSize({ width, height });
    for (const route of PROJECTS) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.querySelectorAll('.site-header, .mobile-contact-bar').forEach((n) => n.style.setProperty('visibility', 'hidden', 'important')));
      let min = null;
      for (const sel of HERO_TEXT) {
        const loc = page.locator(sel);
        for (let i = 0; i < await loc.count(); i += 1) {
          const el = loc.nth(i);
          if (!(await el.isVisible())) continue;
          const m = await measure(page, el);
          if (!m) continue;
          const label = `${width} ${route} ${sel}${i ? ` #${i + 1}` : ''}`;
          rows.push({ width, route, sel, i, ratio: Math.round(m.ratio * 100) / 100, text: m.text, bg: m.bg });
          if (!min || m.ratio < min.ratio) min = { ratio: m.ratio, label };
          expect.soft(m.ratio, `${label} rgb(${m.text}) on rgb(${m.bg})`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(min, `${width} ${route} measured something`).not.toBeNull();
      // k5e L2: the marsh art starts at 900px, so at 761-899 the hero field is already solid #EFE9DD and the pixels alone cannot tell a
      // missing plate; the declared design is the solid plate from 761px, so assert it directly at every width >= 761.
      if (width >= 761) {
        const plates = await page.evaluate(() => ['.project-hero-grid > .readable', '.project-hero-grid > .project-summary-card']
          .map((q) => document.querySelector(q)).filter(Boolean).map((e) => getComputedStyle(e).backgroundColor));
        expect.soft(plates, `${width} ${route} project hero copy and summary card on the solid plate #EFE9DD`).toEqual(plates.map(() => 'rgb(239, 233, 221)'));
        expect.soft(plates.length, `${width} ${route} plates found`).toBeGreaterThanOrEqual(1);
      }
    }
  }
  const out = JSON.stringify(rows, null, 1);
  await testInfo.attach('hero-contrast.json', { body: out, contentType: 'application/json' });
  if (process.env.HERO_CONTRAST_OUT) writeFileSync(process.env.HERO_CONTRAST_OUT, out);
});

// k5b (Coordinator): the About hero founder card label ("Meet Eddie") sits on a translucent card over the marsh from 761px; measured on its
// glyphs it was 3.32-3.51:1 at 1024-1440. It must keep >= 4.5:1 at every width.
test('k5b: About hero founder card label keeps >= 4.5:1 on its glyphs at 1440, 1180, 1024, 950, 800, 390 and 360', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const rows = [];
  for (const [width, height] of ABOUT_WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto('/about/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.querySelectorAll('.site-header, .mobile-contact-bar').forEach((n) => n.style.setProperty('visibility', 'hidden', 'important')));
    const el = page.locator('.about-owner-card .eyebrow');
    await expect(el, `${width} label present`).toHaveCount(1);
    await el.scrollIntoViewIfNeeded();
    const m = await measure(page, el);
    expect(m, `${width} measured`).not.toBeNull();
    rows.push({ width, ratio: Math.round(m.ratio * 100) / 100, text: m.text, bg: m.bg });
    expect.soft(m.ratio, `${width} About "Meet Eddie" rgb(${m.text}) on rgb(${m.bg})`).toBeGreaterThanOrEqual(4.5);
  }
  await testInfo.attach('about-label-contrast.json', { body: JSON.stringify(rows, null, 1), contentType: 'application/json' });
  if (process.env.ABOUT_CONTRAST_OUT) writeFileSync(process.env.ABOUT_CONTRAST_OUT, JSON.stringify(rows, null, 1));
});

// k5c (Coordinator): the founder card location line ("Beaufort, South Carolina · Owner-operated") had the same problem as the label, measured
// 3.23-3.47:1 on its glyphs at 1024-1440. It must keep >= 4.5:1 at every width.
test('k5c: About hero founder card location line keeps >= 4.5:1 on its glyphs at 1440, 1180, 1024, 950, 800, 390 and 360', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const rows = [];
  for (const [width, height] of ABOUT_WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto('/about/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.querySelectorAll('.site-header, .mobile-contact-bar').forEach((n) => n.style.setProperty('visibility', 'hidden', 'important')));
    const el = page.locator('.about-owner-card > div > p:last-child');
    await expect(el, `${width} location line present`).toHaveCount(1);
    await expect(el, `${width} location line copy`).toHaveText('Beaufort, South Carolina · Owner-operated');
    await el.scrollIntoViewIfNeeded();
    const m = await measure(page, el);
    expect(m, `${width} measured`).not.toBeNull();
    rows.push({ width, ratio: Math.round(m.ratio * 100) / 100, text: m.text, bg: m.bg });
    expect.soft(m.ratio, `${width} About location line rgb(${m.text}) on rgb(${m.bg})`).toBeGreaterThanOrEqual(4.5);
    // P2-2 (Critiquito k5) + L2: from 761px (checked at 800, 950, 1024, 1180, 1440) the line sits on the solid plate var(--plate-bg-solid) #EFE9DD, which gives #55656D 5.01:1.
    if (width >= 761) {
      expect.soft(m.bg, `${width} location line backing is the solid plate #EFE9DD`).toEqual([239, 233, 221]);
      expect.soft(Math.round(m.ratio * 100) / 100, `${width} location line on the plate`).toBeGreaterThanOrEqual(5.01);
    }
  }
  await testInfo.attach('about-location-contrast.json', { body: JSON.stringify(rows, null, 1), contentType: 'application/json' });
  if (process.env.ABOUT_LOCATION_CONTRAST_OUT) writeFileSync(process.env.ABOUT_LOCATION_CONTRAST_OUT, JSON.stringify(rows, null, 1));
});
