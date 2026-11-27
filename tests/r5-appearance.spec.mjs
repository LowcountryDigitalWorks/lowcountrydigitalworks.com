import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import AxeBuilder from '@axe-core/playwright';

// k5f: optional site-wide Light / Dark / System appearance control (footer). System is the default; the choice is kept only in this
// browser (localStorage in try/catch); public/r5/appearance.js is a same-origin head script (CSP script-src 'self') so the resolved
// mode is on <html> before first paint; without JS the CSS follows prefers-color-scheme. Light mode is the k5e site unchanged.
// These tests never click tel:, sms:, mailto: or social links.
test.skip(({ isMobile }) => isMobile, 'viewports are set per test');

const KEY = 'ldw-appearance';
const ROUTES = ['/', '/about/', '/accessibility/', '/approach/', '/connect/', '/contact/', '/discovery/', '/guides/', '/guides/website-maintenance-after-launch/',
  '/guides/website-ownership-handoff/', '/local-visibility-sample/', '/privacy/', '/services/', '/services/websites/', '/services/website-care/',
  '/services/business-systems-automation/', '/services/digital-ownership-platform-administration/', '/services/technology-consulting/', '/share/', '/terms/',
  '/website-check/', '/work/', '/work/document-control/', '/work/gas-engine/', '/work/owner-console/', '/work/interview-facilitator/', '/work/reputation/',
  '/work/secure-exchange/', '/404.html'];
const WIDTHS = [[1440, 900], [390, 844], [360, 780]];
const VCARD = '/eddie-gugino-lowcountry-digital-works.vcf';
const VCARD_SHA256 = '5201fcc755007f518e31de39e80cccd2915438f296b2af0796e9de019dc7b4ae';
const CONNECT_URL = 'https://lowcountrydigitalworks.com/connect/';
const DARK_PAGE = 'rgb(13, 27, 37)'; // #0D1B25
// Owner dark card spec (PR #140 c7178946132).
const CARD_DARK = { body: 'rgb(225, 240, 233)', header: 'rgb(16, 60, 66)', edge: 'rgb(145, 213, 191)', ink: 'rgb(16, 42, 58)', label: 'rgb(36, 99, 92)', save: 'rgb(7, 86, 78)', onSave: 'rgb(255, 255, 255)' };
const CARD_LIGHT = { body: 'rgb(255, 255, 255)', edge: 'rgb(82, 121, 109)' };

const control = (page) => page.locator('fieldset[data-appearance-control]');
const mode = (page) => page.evaluate(() => [document.documentElement.getAttribute('data-color-pref'), document.documentElement.getAttribute('data-color-mode')]);
const pick = async (page, value) => { const c = control(page); await c.scrollIntoViewIfNeeded(); await c.getByRole('radio', { name: value[0].toUpperCase() + value.slice(1), exact: true }).check(); };

// In-page WCAG contrast helpers (sRGB relative luminance); colours resolved through a canvas so any CSS colour works.
const CONTRAST_FN = `(() => {
  const cv = document.createElement('canvas').getContext('2d');
  const rgba = (c) => { cv.clearRect(0,0,1,1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0,0,1,1); return [...cv.getImageData(0,0,1,1).data]; };
  const L = ([r,g,b]) => { const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  window.__cr = (a, b) => { const x = L(rgba(a)), y = L(rgba(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
})()`;

test('k5f: appearance control is a labelled single-choice group of three 44px icon radios, System by default', async ({ browser }) => {
  for (const [width, height] of [[1440, 900], [320, 780]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto('/privacy/');
    const group = page.getByRole('group', { name: 'Appearance', exact: true });
    await expect(group).toHaveCount(1);
    await expect(group).toBeVisible();
    const radios = group.getByRole('radio');
    await expect(radios).toHaveCount(3);
    for (const [i, name] of ['Light', 'Dark', 'System'].entries()) {
      await expect(radios.nth(i)).toHaveAccessibleName(name);
      await expect(radios.nth(i)).toHaveAttribute('name', 'ldw-appearance');
    }
    await expect(group.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(await mode(page)).toEqual(['system', 'light']);
    const sizes = await page.locator('.appearance-control__opt').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.width, b.height]; }));
    for (const [w, h] of sizes) { expect(w, `${width} target width`).toBeGreaterThanOrEqual(44); expect(h, `${width} target height`).toBeGreaterThanOrEqual(44); }
    // Icons only: no visible text in the options (names come from aria-label; title is the hover tooltip).
    expect(await page.locator('.appearance-control__opt').evaluateAll((els) => els.map((e) => e.innerText.trim()))).toEqual(['', '', '']);
    // Single selection, by pointer and by keyboard (native radio group).
    await pick(page, 'dark');
    expect(await mode(page)).toEqual(['dark', 'dark']);
    expect(await page.locator('input[name="ldw-appearance"]:checked').count()).toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'System' })).toBeChecked();
    await expect(group.getByRole('radio', { name: 'System' })).toBeFocused();
    expect(await mode(page)).toEqual(['system', 'light']);
    expect(await page.locator('input[name="ldw-appearance"]:checked').count()).toBe(1);
    // Visible keyboard focus.
    const ring = await page.locator('.appearance-control__opt--system').evaluate((e) => getComputedStyle(e).outlineStyle);
    expect(ring).not.toBe('none');
    await context.close();
  }
});

test('k5f: a selected System looks different from an explicitly selected Light or Dark', async ({ browser }) => {
  for (const os of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: os });
    const page = await context.newPage();
    await page.goto('/privacy/');
    const look = () => page.locator('.appearance-control__opt').evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return `${s.backgroundColor}|${s.borderTopStyle}|${s.borderTopColor}|${getComputedStyle(e.querySelector('svg')).color}`; }));
    const system = await look();
    await pick(page, os);
    const explicit = await look();
    expect(await mode(page)).toEqual([os, os]);
    expect(system, `${os}: System-resolved-${os} differs from explicit ${os}`).not.toEqual(explicit);
    // With System selected, the option it resolves to is marked (dashed) but not filled like the selected option.
    await pick(page, 'system');
    const idx = os === 'light' ? 0 : 1;
    const s = (await look())[idx].split('|');
    expect(s[1], `${os}: resolved option dashed`).toBe('dashed');
    expect(s[0], `${os}: resolved option not filled`).toBe('rgba(0, 0, 0, 0)');
    await context.close();
  }
});

test('k5f: the choice persists across reloads and routes; System removes the stored key; storage events sync tabs', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/privacy/');
  await pick(page, 'dark');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('dark');
  await page.reload();
  expect(await mode(page)).toEqual(['dark', 'dark']);
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await page.goto('/services/');
  expect(await mode(page)).toEqual(['dark', 'dark']);
  const other = await context.newPage();
  await other.goto('/about/');
  await pick(page, 'light');
  await expect.poll(() => mode(other)).toEqual(['light', 'light']);
  await pick(page, 'system');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
  await page.reload();
  expect(await mode(page)).toEqual(['system', 'light']);
  // A junk stored value is treated as System.
  await page.evaluate((k) => localStorage.setItem(k, 'sepia'), KEY);
  await page.reload();
  expect(await mode(page)).toEqual(['system', 'light']);
  await context.close();
});

test('k5f: with storage blocked the page follows the OS, never throws, and the control still works for the page', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await context.addInitScript(() => {
    for (const m of ['getItem', 'setItem', 'removeItem']) Storage.prototype[m] = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/privacy/');
  expect(await mode(page)).toEqual(['system', 'dark']);
  await pick(page, 'light');
  expect(await mode(page)).toEqual(['light', 'light']);
  await page.reload();
  expect(await mode(page), 'nothing stored: back to the OS').toEqual(['system', 'dark']);
  expect(errors).toEqual([]);
  await context.close();
});

test('k5f: without JavaScript the site follows prefers-color-scheme and hides the control', async ({ browser }) => {
  for (const os of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: os, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/connect/');
    expect(await mode(page)).toEqual([null, null]);
    await expect(control(page)).toBeHidden();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const card = await page.locator('article.biz-card--tidal').evaluate((c) => [getComputedStyle(c).backgroundColor, getComputedStyle(c).borderTopColor]);
    if (os === 'dark') { expect(bg).toBe(DARK_PAGE); expect(card).toEqual([CARD_DARK.body, CARD_DARK.edge]); }
    else { expect(bg).not.toBe(DARK_PAGE); expect(card).toEqual([CARD_LIGHT.body, CARD_LIGHT.edge]); }
    await context.close();
  }
});

test('k5f: no flash: the resolved mode is on <html> before <body> exists, from a same-origin blocking head script', async ({ browser }) => {
  for (const [os, stored, want] of [['dark', null, 'dark'], ['light', 'dark', 'dark'], ['dark', 'light', 'light']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: os });
    await context.addInitScript(([k, v]) => {
      try { if (v) localStorage.setItem(k, v); } catch (e) { /* ignore */ }
      window.__atBody = 'unseen';
      new MutationObserver((recs, obs) => {
        if (document.body) { window.__atBody = document.documentElement.getAttribute('data-color-mode'); obs.disconnect(); }
      }).observe(document, { childList: true, subtree: true });
    }, [KEY, stored]);
    const page = await context.newPage();
    await page.goto('/services/');
    expect(await page.evaluate(() => window.__atBody), `${os}/${stored}: mode at <body> insertion`).toBe(want);
    const s = await page.evaluate(() => {
      const el = document.querySelector('script[src="/r5/appearance.js"]');
      return { inHead: !!el && el.parentElement === document.head, async: el?.async, defer: el?.defer, type: el?.type, inline: [...document.scripts].filter((x) => !x.src && x.type !== 'application/ld+json').length, inlineStyleAttr: document.querySelectorAll('[style]').length };
    });
    expect(s).toEqual({ inHead: true, async: false, defer: false, type: '', inline: 0, inlineStyleAttr: 0 });
    await context.close();
  }
});

test('k5f: dark mode on all 29 routes at 1440/390/360: axe WCAG A/AA clean, no overflow, header and contact bar intact', async ({ browser }) => {
  test.setTimeout(600_000);
  const fails = [];
  for (const [width, height] of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' });
    const page = await context.newPage();
    for (const r of ROUTES) {
      await page.goto(r);
      const at = `${width} ${r}`;
      expect(await mode(page), at).toEqual(['system', 'dark']);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of axe.violations) for (const n of v.nodes) fails.push(`${at} ${v.id} ${n.target.join(' ')}`);
      const geo = await page.evaluate(() => {
        const vis = (e) => e && e.checkVisibility({ visibilityProperty: true, opacityProperty: true });
        const bar = document.querySelector('.mobile-contact-bar, [data-mobile-contact-bar]');
        const ctl = document.querySelector('[data-appearance-control]');
        const brand = document.querySelector('.site-header .brand');
        const lightLogo = brand?.querySelector('img:first-child'); const darkLogo = brand?.querySelector('img.brand-logo-on-dark');
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          header: document.querySelector('.site-header').getBoundingClientRect().height,
          logos: [vis(lightLogo), vis(darkLogo), !!darkLogo && darkLogo.complete && darkLogo.naturalWidth > 0],
          bar: vis(bar) ? bar.getBoundingClientRect().height : 0,
          optSizes: [...document.querySelectorAll('.appearance-control__opt')].map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height)),
          ctlVisible: vis(ctl) };
      });
      if (geo.overflow > 0) fails.push(`${at} overflow ${geo.overflow}`);
      if (geo.header > 120) fails.push(`${at} header height ${geo.header}`);
      if (geo.logos.join() !== 'false,true,true') fails.push(`${at} logo swap ${geo.logos}`);
      if (!geo.ctlVisible || geo.optSizes.some((s) => s < 44)) fails.push(`${at} control ${geo.ctlVisible} ${geo.optSizes}`);
      if (width < 768 && !['/discovery/', '/connect/'].includes(r) && r !== '/404.html' && geo.bar && geo.bar < 44) fails.push(`${at} contact bar ${geo.bar}`);
      // The footer control is reachable above the contact bar at the end of the page.
      if (width < 768) {
        await control(page).scrollIntoViewIfNeeded();
        const hit = await page.evaluate(() => { const o = document.querySelector('.appearance-control__opt--dark').getBoundingClientRect(); const e = document.elementFromPoint(o.left + o.width / 2, o.top + o.height / 2); return !!e && !!e.closest('.appearance-control__opt--dark'); });
        if (!hit) fails.push(`${at} control covered`);
      }
    }
    await context.close();
  }
  expect(fails).toEqual([]);
});

test('k5f: in resolved dark the /connect/ card is the owner mint focal surface; contrast and separation measured on the rendered page; light card unchanged', async ({ browser }, testInfo) => {
  const evidence = [];
  for (const [label, os, choose] of [['system-dark', 'dark', null], ['forced-dark', 'light', 'dark'], ['light', 'light', null], ['forced-light', 'dark', 'light']]) {
    for (const [width, height] of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: os });
      const page = await context.newPage();
      await page.goto('/connect/');
      if (choose) { await pick(page, choose); await page.evaluate(() => window.scrollTo(0, 0)); }
      await page.evaluate(CONTRAST_FN);
      const m = await page.locator('article.biz-card--tidal').evaluate((c) => {
        const cs = (q) => getComputedStyle(q ? c.querySelector(q) : c);
        const page = getComputedStyle(c.closest('section')).backgroundColor;
        const body = cs().backgroundColor;
        const pairs = {
          name: [cs('.biz-card__name').color, body], title: [cs('.biz-card__title').color, body], place: [cs('.biz-card__place').color, body],
          line: [cs('.biz-card__line').color, body], save: [cs('a.biz-card__save').color, cs('a.biz-card__save').backgroundColor],
          action: [cs('a.biz-card__action').color, cs('a.biz-card__action').backgroundColor],
        };
        const out = { page, body, edge: cs().borderTopColor, header: cs('.biz-card__banner').backgroundColor, ink: cs('.biz-card__name').color, label: cs('.biz-card__title').color,
          save: cs('a.biz-card__save').backgroundColor, onSave: cs('a.biz-card__save').color, plate: cs('.biz-card__qr-plate').backgroundColor, ratios: {} };
        for (const [k, [f, b]] of Object.entries(pairs)) out.ratios[k] = +window.__cr(f, b).toFixed(2);
        out.ratios.edgeVsPage = +window.__cr(out.edge, page).toFixed(2);
        out.ratios.bodyVsPage = +window.__cr(body, page).toFixed(2);
        out.ratios.actionEdgeVsBody = +window.__cr(cs('a.biz-card__action').borderTopColor, body).toFixed(2);
        out.ratios.saveVsBody = +window.__cr(out.save, body).toFixed(2);
        return out;
      });
      const at = `${label} ${width}`;
      evidence.push({ at, ...m });
      if (label.endsWith('dark')) {
        expect(m.page, `${at} page`).toBe(DARK_PAGE);
        expect([m.body, m.header, m.edge, m.ink, m.label, m.save, m.onSave], `${at} owner tokens`).toEqual([CARD_DARK.body, CARD_DARK.header, CARD_DARK.edge, CARD_DARK.ink, CARD_DARK.label, CARD_DARK.save, CARD_DARK.onSave]);
        expect(m.ratios.edgeVsPage, `${at} perimeter vs page`).toBeGreaterThanOrEqual(3);
        expect(m.ratios.bodyVsPage, `${at} body vs page`).toBeGreaterThanOrEqual(7);
      } else {
        expect([m.body, m.edge], `${at} k5e light card`).toEqual([CARD_LIGHT.body, CARD_LIGHT.edge]);
      }
      for (const k of ['name', 'title', 'place', 'line', 'save', 'action']) expect(m.ratios[k], `${at} ${k} text`).toBeGreaterThanOrEqual(4.5);
      expect(m.ratios.actionEdgeVsBody, `${at} action boundary`).toBeGreaterThanOrEqual(3);
      expect(m.plate, `${at} white QR plate`).toBe('rgb(255, 255, 255)');
      await context.close();
    }
  }
  testInfo.annotations.push({ type: 'card-contrast', description: JSON.stringify(evidence) });
  if (process.env.K5F_OUT) (await import('node:fs')).writeFileSync(`${process.env.K5F_OUT}/connect-card-dark-measure.json`, JSON.stringify(evidence, null, 1));
});

async function decodeElement(context, locator) {
  const png = await locator.screenshot({ animations: 'disabled' });
  const blank = await context.newPage();
  const px = await blank.evaluate(async (d) => {
    const img = new Image(); img.src = `data:image/png;base64,${d}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, data: Array.from(g.getImageData(0, 0, c.width, c.height).data) };
  }, png.toString('base64'));
  await blank.close();
  // dontInvert: dark modules on a light plate only (an inverted code would not pass).
  const r = jsQR(Uint8ClampedArray.from(px.data), px.w, px.h, { inversionAttempts: 'dontInvert' });
  return r ? r.data : null;
}

test('k5f: the QR decodes in dark (wide and narrow opened) on its white plate, and the vCard bytes are unchanged', async ({ browser }) => {
  for (const [os, choose] of [['dark', null], ['light', 'dark']]) {
    const wideCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: os });
    const wide = await wideCtx.newPage();
    await wide.goto('/connect/');
    if (choose) { await pick(wide, choose); }
    expect((await mode(wide))[1]).toBe('dark');
    const plate = wide.locator('.biz-card__qr--wide .biz-card__qr-plate');
    await plate.scrollIntoViewIfNeeded();
    expect(await plate.evaluate((p) => getComputedStyle(p).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await plate.locator('img').evaluate((i) => { const c = getComputedStyle(i); return [c.filter, c.mixBlendMode]; }), 'QR not filtered').toEqual(['none', 'normal']);
    expect(await decodeElement(wideCtx, plate), `${os}/${choose} wide decode`).toBe(CONNECT_URL);
    const res = await wide.request.get(VCARD);
    expect(createHash('sha256').update(await res.body()).digest('hex'), 'vCard bytes').toBe(VCARD_SHA256);
    await wideCtx.close();
    const narrowCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: os });
    const narrow = await narrowCtx.newPage();
    await narrow.goto('/connect/');
    if (choose) { await pick(narrow, choose); }
    const details = narrow.locator('details.biz-card__qr-narrow');
    await details.locator('summary').click();
    const p2 = details.locator('.biz-card__qr-plate');
    await p2.scrollIntoViewIfNeeded();
    expect(await decodeElement(narrowCtx, p2), `${os}/${choose} narrow decode`).toBe(CONNECT_URL);
    await narrowCtx.close();
  }
});
