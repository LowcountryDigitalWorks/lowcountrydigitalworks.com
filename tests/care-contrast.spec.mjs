import { test, expect } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { careOptionsPreviewEnabled } from '../src/lib/care-gate.mjs';

// R3f-c: rendered-pixel text contrast for the gated Website Care plans preview (#care-options).
// 27 text groups x 3 viewports (1440x900, 390x844, 360x780) = 81 measured points; every point must be >= 4.5:1 (WCAG AA, normal text).
// Method (same as the site-polish k1 sweep): hide the sticky header and the mobile contact bar, centre the element's slide in the carousel,
// make the text transparent, screenshot the text box (Range rect, 1px inset, so borders and list-marker art beside the text are excluded),
// and compare the computed text colour with the worst background pixel: the lightest 2% for light text, the darkest 2% for dark text.
// Only runs on a Care-preview build (CARE_OPTIONS_PREVIEW=1 WORKERS_CI=1 WORKERS_CI_BRANCH=<preview branch>), once, in chromium-desktop.
// Optional: CARE_CONTRAST_LOG=<file.jsonl> records every point.
const ON = careOptionsPreviewEnabled();
const LOG = process.env.CARE_CONTRAST_LOG;
const MIN = 4.5;
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 780 }];
const DEF = '.care-tier:not(.care-tier--rec)';
const REC = '.care-tier--rec';
const T4 = '.care-tier[data-care-option="t4"]';
export const POINTS = [
  ['gold', 'section eyebrow', '.care-options .eyebrow'],
  ['gold', 'tier price prefix ("Starting at")', '.care-tier__prefix'],
  ['gold', 'tier price note ("Custom plan")', '.care-tier__note'],
  ['heading', 'section h2', '.care-options h2'],
  ['body', 'section lede', '.care-options .lede'],
  ['body', 'tier job line', `${DEF} .care-tier__job`],
  ['body', 'tier job line (recommended)', `${REC} .care-tier__job`],
  ['body', 'tier lead ("Everything in ...")', `${DEF} .care-tier__lead`],
  ['body', 'tier lead (recommended)', `${REC} .care-tier__lead`],
  ['body', 'tier list items', `${DEF} .care-tier__list li`],
  ['body', 'tier list items (recommended)', `${REC} .care-tier__list li`],
  ['body', 'tier foot', '.care-tier__foot'],
  ['body', 'exclusions', '.care-exclusions'],
  ['body', 'talk line', '.care-talk'],
  ['tier label', 'recommended flag', `${REC} .care-tier__flag`],
  ['tier label', 'tier name', `${DEF} .care-tier__name`],
  ['tier label', 'tier name (recommended)', `${REC} .care-tier__name`],
  ['tier label', 'tier name (t4 dark)', `${T4} .care-tier__name`],
  ['tier label', 'tier family', `${DEF} .care-tier__family`],
  ['tier label', 'tier family (recommended)', `${REC} .care-tier__family`],
  ['tier label', 'tier family (t4 dark)', `${T4} .care-tier__family`],
  ['price', 'amount', `${DEF} .care-tier__amount`],
  ['price', 'amount (recommended)', `${REC} .care-tier__amount`],
  ['price', 'amount (t4 dark)', `${T4} .care-tier__amount`],
  ['price', 'per month', `${DEF} .care-tier__per`],
  ['price', 'per month (recommended)', `${REC} .care-tier__per`],
  ['link', 'section text link', '.care-options .text-link'],
];

test.skip(!ON, 'Care preview gate is OFF in this build');

// Decodes a PNG and returns the worst-case background for the given text colour (runs on about:blank: no site CSP involved).
async function worstBackground(helper, png, rgb) {
  return helper.evaluate(async ({ b64, rgb }) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const inset = bmp.width > 6 && bmp.height > 6 ? 1 : 0;
    const d = ctx.getImageData(inset, inset, bmp.width - 2 * inset, bmp.height - 2 * inset).data;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    const px = [];
    for (let i = 0; i < d.length; i += 4) px.push([lum(d[i], d[i + 1], d[i + 2]), d[i], d[i + 1], d[i + 2]]);
    px.sort((a, b) => a[0] - b[0]);
    const lt = lum(...rgb);
    const light = lt > px[Math.floor(px.length / 2)][0];
    const bg = light ? px[Math.max(0, Math.ceil(px.length * 0.98) - 1)] : px[Math.floor(px.length * 0.02)];
    const [hi, lo] = lt > bg[0] ? [lt, bg[0]] : [bg[0], lt];
    const hex = (a) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('');
    return { ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, bg: hex(bg.slice(1)), text: hex(rgb) };
  }, { b64: png.toString('base64'), rgb });
}

for (const viewport of VIEWPORTS) {
  test(`Care preview text contrast >= ${MIN}:1 on rendered pixels at ${viewport.width}x${viewport.height} (27 text groups)`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'viewports are set explicitly; run once');
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', isMobile: viewport.width < 700, hasTouch: viewport.width < 700 });
    const page = await context.newPage();
    const helper = await context.newPage();
    await page.goto('/services/website-care/');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      document.querySelectorAll('.site-header, .mobile-contact-bar').forEach((e) => e.style.setProperty('visibility', 'hidden', 'important'));
    });
    const results = [];
    for (const [group, label, sel] of POINTS) {
      const loc = page.locator(sel);
      const n = await loc.count();
      expect(n, `${label}: ${sel} exists`).toBeGreaterThan(0);
      let worst = null;
      for (let i = 0; i < Math.min(n, 40); i++) {
        const el = loc.nth(i);
        const box = await el.evaluate((e) => {
          if (!e.textContent.trim()) return null;
          const t = e.closest('.care-track');
          const s = e.closest('[data-care-option]');
          if (t && s && t.scrollWidth > t.clientWidth + 1) {
            const tr = t.getBoundingClientRect(); const sr = s.getBoundingClientRect();
            t.scrollLeft += (sr.left - tr.left) - (tr.width - sr.width) / 2;
          }
          e.scrollIntoView({ block: 'center' });
          return true;
        });
        if (!box) continue;
        await page.waitForTimeout(60);
        const m = await el.evaluate((e) => {
          const r = document.createRange(); r.selectNodeContents(e);
          const b = r.getBoundingClientRect();
          const cs = getComputedStyle(e);
          if (b.width < 2 || b.height < 2 || cs.visibility === 'hidden') return null;
          const rgb = cs.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
          return { x: b.left, y: b.top, width: b.width, height: b.height, rgb };
        });
        if (!m) continue;
        await el.evaluate((e) => { e.style.setProperty('color', 'transparent', 'important'); e.querySelectorAll('*').forEach((k) => k.style.setProperty('color', 'transparent', 'important')); });
        const png = await page.screenshot({ clip: { x: Math.max(0, m.x), y: Math.max(0, m.y), width: m.width, height: m.height }, animations: 'disabled' });
        await el.evaluate((e) => { e.style.removeProperty('color'); e.querySelectorAll('*').forEach((k) => k.style.removeProperty('color')); });
        const r = await worstBackground(helper, png, m.rgb);
        if (!worst || r.ratio < worst.ratio) worst = { ...r, index: i };
      }
      expect(worst, `${label}: at least one visible, non-empty element measured`).not.toBeNull();
      const point = { viewport: `${viewport.width}x${viewport.height}`, group, label, sel, ...worst };
      results.push(point);
      if (LOG) { mkdirSync(path.dirname(LOG), { recursive: true }); appendFileSync(LOG, JSON.stringify(point) + '\n'); }
    }
    await context.close();
    expect(results).toHaveLength(POINTS.length);
    const failing = results.filter((p) => p.ratio < MIN).map((p) => `${p.label} ${p.text} on ${p.bg} = ${p.ratio}`);
    expect(failing, `points below ${MIN}:1`).toEqual([]);
  });
}
