import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import contact from '../src/data/contact.json' with { type: 'json' };

// k5d: the /connect/ contact card (adapted from the R5 contact-card reference). The accepted tidal card, its canonical white logo and its
// copy stay; Save contact is the primary action (>= 52px) and Text, Call and Email are on-card actions (>= 44px) with the existing ldw()
// events. These tests never click tel:, mailto:, sms: or social links; they read hrefs and attributes only.
test.skip(({ isMobile }) => isMobile, 'viewports are set per test');

const VCARD = '/eddie-gugino-lowcountry-digital-works.vcf';
// sha256 of public/eddie-gugino-lowcountry-digital-works.vcf (git blob 5c87536); k5d leaves the download bytes unchanged.
const VCARD_SHA256 = '5201fcc755007f518e31de39e80cccd2915438f296b2af0796e9de019dc7b4ae';
const LOGO = '/brand/logo/lowcountry-digital-works-logo-horizontal-white.svg';
// 320, 360, 375x667, 390, 768, 1440, then 1280x720 at 200% and 400% zoom (640x360 and 320x180 CSS px).
const VIEWPORTS = [[320, 780, 1], [360, 780, 1], [375, 667, 1], [390, 844, 1], [768, 1024, 1], [1440, 900, 1], [640, 360, 2], [320, 180, 4]];
const ACTIONS = [
  ['Text Eddie', `sms:${contact.phone.number}`, 'sms'],
  ['Call Eddie', `tel:${contact.phone.number}`, 'phone'],
  ['Email Eddie', `mailto:${contact.email.address}`, 'email'],
];

test('k5d: Connect contact card keeps its logo and copy, Save contact is the >= 52px primary and Text/Call/Email are >= 44px on-card actions at every viewport and zoom', async ({ browser }) => {
  test.setTimeout(180_000);
  for (const [width, height, zoom] of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: zoom });
    const page = await context.newPage();
    await page.goto('/connect/');
    const at = `${width}x${height}@${zoom}x`;
    const card = page.locator('#main-content article.biz-card.biz-card--tidal');
    await expect(card, `${at} one card`).toHaveCount(1);
    const logo = card.locator('img.biz-card__logo');
    await expect(logo, `${at} canonical logo`).toHaveAttribute('src', LOGO);
    await expect(logo).toHaveAttribute('alt', 'Lowcountry Digital Works');
    expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0), `${at} logo loads`).toBe(true);
    await expect(card.locator('.biz-card__name')).toHaveText(contact.founder.name);
    await expect(card.locator('.biz-card__place')).toHaveText('Beaufort, South Carolina');
    await expect(card.locator('.biz-card__line').nth(0)).toHaveText(contact.phone.display);
    await expect(card.locator('.biz-card__line').nth(1)).toHaveText(contact.email.address);
    const save = card.locator('a.biz-card__save');
    await expect(save).toHaveText('Save contact');
    await expect(save).toHaveAttribute('href', `${VCARD}#on-card`);
    await expect(save).toHaveAttribute('download', '');
    // ldw() writes its data-ldw-* hooks only in an analytics-enabled build; with analytics OFF none may appear.
    const analyticsBuild = (await page.locator('[data-ldw-event]').count()) > 0;
    if (analyticsBuild) {
      await expect(save).toHaveAttribute('data-ldw-event', 'contact_card_download');
      await expect(save).toHaveAttribute('data-ldw-placement', 'connect_card');
    } else {
      await expect(card.locator('[data-ldw-event], [data-ldw-method], [data-ldw-placement]')).toHaveCount(0);
    }
    const m = await card.evaluate((c) => {
      const box = (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, left: b.left, right: b.right }; };
      const acts = [...c.querySelectorAll('.biz-card__actions a.biz-card__action')];
      const midword = [];
      for (const el of [...acts, ...c.querySelectorAll('.biz-card__line, .biz-card__name, .biz-card__title, .biz-card__place, .biz-card__qr-copy, .biz-card__qr-narrow > summary')]) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const re = /[^\s@]+/g;
          let mm;
          while ((mm = re.exec(t.textContent))) {
            const r = document.createRange();
            r.setStart(t, mm.index);
            r.setEnd(t, mm.index + mm[0].length);
            if ([...r.getClientRects()].filter((q) => q.width > 0.5).length > 1) midword.push(mm[0]);
          }
        }
      }
      return {
        save: box(c.querySelector('a.biz-card__save')), card: box(c),
        acts: acts.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), ev: a.dataset.ldwEvent, method: a.dataset.ldwMethod, placement: a.dataset.ldwPlacement, ...box(a) })),
        midword, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inlineStyle: c.querySelectorAll('[style]').length, extras: c.querySelectorAll('script, iframe, form, canvas, svg:not(.ui-icon), img:not(.biz-card__logo):not(.biz-card__qr-plate > img[src="/r5/assets/qr/ldw-connect-qr.svg"])').length,
      };
    });
    expect(m.save.h, `${at} Save contact height`).toBeGreaterThanOrEqual(52);
    expect(m.acts.map((a) => [a.text, a.href, a.ev, a.method, a.placement]), `${at} on-card actions`).toEqual(ACTIONS.map(([t, h, method]) => (analyticsBuild ? [t, h, 'contact_method_click', method, 'connect_actions'] : [t, h, undefined, undefined, undefined])));
    for (const a of m.acts) {
      expect(a.h, `${at} ${a.text} height`).toBeGreaterThanOrEqual(44);
      expect(a.w, `${at} ${a.text} width`).toBeGreaterThanOrEqual(44);
      expect(a.top, `${at} ${a.text} sits under Save contact`).toBeGreaterThanOrEqual(m.save.top + m.save.h);
      expect(a.left, `${at} ${a.text} inside the card`).toBeGreaterThanOrEqual(m.card.left);
      expect(a.right, `${at} ${a.text} inside the card`).toBeLessThanOrEqual(m.card.right + 0.5);
    }
    expect(Math.max(...m.acts.map((a) => a.w)) - Math.min(...m.acts.map((a) => a.w)), `${at} equal actions`).toBeLessThanOrEqual(0.5);
    expect(m.midword, `${at} no mid-word breaks on the card`).toEqual([]);
    expect(m.overflowX, `${at} no horizontal overflow`).toBeLessThanOrEqual(1);
    // k5e: the QR asset is now expected (owner c7179098374 supersedes the k5d no-QR scope); anything else is still an extra.
    expect(m.inlineStyle + m.extras, `${at} no inline style, script, iframe, form, inline SVG or extra image besides the logo and the QR asset`).toBe(0);
    // One of each contact link in the page body: the old tiles are gone, nothing is doubled.
    await expect(page.locator('#main-content .connect-actions')).toHaveCount(0);
    for (const [, href] of ACTIONS) await expect(page.locator(`#main-content a[href="${href}"]`), `${at} ${href} once`).toHaveCount(1);
    await context.close();
  }
});

// k5e: the fifth stop is the QR link on wide layouts and the closed 'Show QR' disclosure on narrow ones; 375x667 added, and the
// focused control must also clear the MobileContactBar (contact-bar clearance), not only the sticky header.
test('k5d (+k5e): keyboard reaches Save contact, Text, Call, Email, then the QR link (wide) or Show QR (narrow), with a visible focus ring, clear of the header and the contact bar, at 375x667, 390, 1440 and 400% zoom', async ({ browser }) => {
  for (const [width, height, zoom] of [[375, 667, 1], [390, 844, 1], [1440, 900, 1], [320, 180, 4]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: zoom });
    const page = await context.newPage();
    await page.goto('/connect/');
    const at = `${width}x${height}@${zoom}x`;
    // Contact-bar clearance: BaseLayout deliberately omits the MobileContactBar on /connect/ (the card carries the same actions), so
    // nothing can cover the card from below; keep it that way, and the barTop guard below still applies if it ever returns.
    await expect(page.locator('.mobile-contact-bar'), `${at} no MobileContactBar on /connect/`).toHaveCount(0);
    const seen = [];
    for (let i = 0; i < 40 && seen.length < 5; i += 1) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(450); // the page scrolls smoothly to the focused element
      const f = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || !e.closest('.biz-card')) return null;
        const cs = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        // WCAG 2.4.11: the focused control may not be hidden by the sticky header; at least half of it must show below the header.
        const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
        const bar = document.querySelector('.mobile-contact-bar');
        const barTop = bar && getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().height > 0 ? bar.getBoundingClientRect().top : innerHeight;
        const shown = Math.min(b.bottom, innerHeight, barTop) - Math.max(b.top, header);
        return { text: e.textContent.trim(), outline: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), inView: shown >= b.height / 2 };
      });
      if (f) seen.push(f);
    }
    const fifth = width >= 900 ? 'lowcountrydigitalworks.com/connect/' : 'Show QR';
    expect(seen.map((f) => f.text), `${at} focus order on the card`).toEqual(['Save contact', 'Text Eddie', 'Call Eddie', 'Email Eddie', fifth]);
    for (const f of seen) {
      expect(f.outline, `${at} ${f.text} focus ring`).toBe('solid');
      expect(f.ow, `${at} ${f.text} focus ring width`).toBeGreaterThanOrEqual(2);
      expect(f.inView, `${at} ${f.text} at least half visible between the sticky header and the contact bar`).toBe(true);
    }
    await context.close();
  }
});

test('k5d: the contact file download bytes are unchanged and it is still the only vCard source', async ({ page }) => {
  const res = await page.request.get(VCARD);
  expect(res.ok()).toBeTruthy();
  const body = Buffer.from(await res.body());
  expect(createHash('sha256').update(body).digest('hex'), 'vCard bytes').toBe(VCARD_SHA256);
  await page.goto('/connect/');
  const vcfLinks = await page.locator('a[href*=".vcf"]').evaluateAll((els) => [...new Set(els.map((a) => a.getAttribute('href').split('#')[0]))]);
  expect(vcfLinks).toEqual([VCARD]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// k5e: owner's frozen /connect/ card spec (PR #140 c7179098374 > c7178946132 > c7178729248 > c7178558027).
const QR_SRC = '/r5/assets/qr/ldw-connect-qr.svg';
const CONNECT_URL = 'https://lowcountrydigitalworks.com/connect/';
// sha256 of the owner's qr-kit ldw-connect-qr.svg (kit 5038c628…); the shipped file must be byte-identical.
const QR_SHA256 = '5f9d8fb4efd1336eb7210ee12b62dc7be1307dd0713404de199cadb9cfde0362';
const WIDE = [[1440, 900, 1], [1180, 820, 1], [1024, 768, 1], [950, 900, 1], [900, 900, 1]];
const NARROW = [[320, 780, 1], [360, 780, 1], [375, 667, 1], [390, 844, 1], [768, 1024, 1], [640, 360, 2], [320, 180, 4]];

// Decode a rendered element: screenshot it, read the pixels back through a canvas on a blank page, run jsQR in node.
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
  const r = jsQR(Uint8ClampedArray.from(px.data), px.w, px.h);
  return { text: r ? r.data : null, version: r ? r.version : null, png };
}

// Geometry and paint checks for one visible QR: >= 176px, square, uncropped inside its white plate and the card, no filter/invert.
const qrGeometry = (img) => {
  const b = (e) => e.getBoundingClientRect();
  const plate = img.closest('.biz-card__qr-plate');
  const card = img.closest('.biz-card');
  const cs = getComputedStyle(img);
  const ps = getComputedStyle(plate);
  const ib = b(img); const pb = b(plate); const cb = b(card);
  let filtered = false;
  for (let e = img; e && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.filter !== 'none' || s.mixBlendMode !== 'normal' || (s.transform !== 'none' && e === img)) filtered = true;
  }
  return {
    w: ib.width, h: ib.height, natural: img.naturalWidth, complete: img.complete, src: img.getAttribute('src'), alt: img.getAttribute('alt'),
    insidePlate: ib.left >= pb.left - 0.5 && ib.right <= pb.right + 0.5 && ib.top >= pb.top - 0.5 && ib.bottom <= pb.bottom + 0.5,
    insideCard: pb.left >= cb.left && pb.right <= cb.right + 0.5,
    plateBg: ps.backgroundColor, objectFit: cs.objectFit, filtered,
  };
};

test('k5e: the shipped QR asset is the owner file byte for byte and encodes only the canonical /connect/ URL', async ({ page }) => {
  const res = await page.request.get(QR_SRC);
  expect(res.ok()).toBeTruthy();
  const body = Buffer.from(await res.body());
  expect.soft(createHash('sha256').update(body).digest('hex'), 'QR asset bytes').toBe(QR_SHA256);
  const svg = body.toString('utf8');
  expect(svg, 'opaque white background covering the full 41x41 grid (4-module quiet zone)').toContain('viewBox="0 0 41 41"');
  expect(svg).toContain('<rect width="41" height="41" fill="#fff"/>');
  expect(svg, 'no script, link or foreign content').not.toMatch(/<script|href=|foreignObject|<style/i);
  // no module may be drawn inside the 4-module quiet zone
  const mods = [...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => [Number(m[1]), Number(m[2])]);
  expect(mods.length).toBeGreaterThan(300);
  expect(mods.filter(([x, y]) => x < 4 || y < 4 || x > 36 || y > 36), 'modules in the quiet zone').toEqual([]);
});

test('k5e: on wide layouts the card shows the QR at >= 176px on a white plate, uncropped and unfiltered, decoding to the canonical /connect/ URL, with "Scan with your phone" and the URL link; Show QR is not offered', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const evidence = [];
  for (const [width, height, zoom] of WIDE) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: zoom });
    const page = await context.newPage();
    await page.goto('/connect/');
    const at = `${width}x${height}@${zoom}x`;
    const card = page.locator('#main-content article.biz-card');
    const wide = card.locator('.biz-card__qr--wide');
    await expect(wide, `${at} QR block visible`).toBeVisible();
    await expect(card.locator('.biz-card__qr-narrow'), `${at} no Show QR on wide layouts`).toBeHidden();
    const img = wide.locator('.biz-card__qr-plate > img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0), { message: `${at} QR loaded` }).toBe(true);
    const g = await img.evaluate(qrGeometry);
    expect(g.src).toBe(QR_SRC);
    expect(g.alt).toBe('QR code for lowcountrydigitalworks.com/connect/');
    expect(g.w, `${at} QR width`).toBeGreaterThanOrEqual(176);
    expect(Math.abs(g.w - g.h), `${at} QR square`).toBeLessThanOrEqual(0.5);
    expect(g.insidePlate, `${at} QR fully inside its plate`).toBe(true);
    expect(g.insideCard, `${at} plate fully inside the card`).toBe(true);
    expect(g.plateBg, `${at} white plate`).toBe('rgb(255, 255, 255)');
    expect(g.filtered, `${at} no filter, blend or transform on the QR`).toBe(false);
    await expect(wide.locator('.biz-card__qr-copy strong')).toHaveText('Scan with your phone');
    const link = wide.locator('.biz-card__qr-copy a');
    await expect(link).toHaveAttribute('href', CONNECT_URL);
    await expect(link).toHaveText('lowcountrydigitalworks.com/connect/');
    expect((await link.boundingBox()).height, `${at} URL link target`).toBeGreaterThanOrEqual(44);
    // QR section sits after Save contact and the three actions.
    const order = await card.evaluate((c) => {
      const t = (q) => c.querySelector(q).getBoundingClientRect().top;
      return { actions: c.querySelector('.biz-card__actions').getBoundingClientRect().bottom, qr: t('.biz-card__qr--wide') };
    });
    expect(order.qr, `${at} QR after the actions`).toBeGreaterThanOrEqual(order.actions);
    const d = await decodeElement(context, wide.locator('.biz-card__qr-plate'));
    expect(d.text, `${at} decoded QR`).toBe(CONNECT_URL);
    evidence.push({ viewport: at, rendered: [g.w, g.h], decoded: d.text, version: d.version });
    if (process.env.K5E_QR_OUT) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${process.env.K5E_QR_OUT}/rendered-qr-${width}x${height}.png`, d.png);
    }
    await context.close();
  }
  testInfo.annotations.push({ type: 'qr-decode', description: JSON.stringify(evidence) });
  if (process.env.K5E_QR_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${process.env.K5E_QR_OUT}/rendered-decode-wide.json`, JSON.stringify(evidence, null, 1));
  }
});

test('k5e: on narrow layouts and at 200%/400% zoom the QR is hidden by default, Save/Text/Call/Email come first, and a closed native "Show QR" disclosure reveals a >= 176px decodable QR without overflow', async ({ browser }) => {
  test.setTimeout(180_000);
  const evidence = [];
  for (const [width, height, zoom] of NARROW) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: zoom });
    const page = await context.newPage();
    await page.goto('/connect/');
    const at = `${width}x${height}@${zoom}x`;
    const card = page.locator('#main-content article.biz-card');
    await expect(card.locator('.biz-card__qr--wide'), `${at} wide QR not rendered`).toBeHidden();
    const details = card.locator('details.biz-card__qr-narrow');
    await expect(details, `${at} one disclosure`).toHaveCount(1);
    expect(await details.evaluate((d) => d.open), `${at} closed by default`).toBe(false);
    const summary = details.locator('summary');
    await expect(summary).toHaveText('Show QR');
    await expect(details.locator('img'), `${at} QR hidden while closed`).toBeHidden();
    const s = await card.evaluate((c) => {
      const b = (q) => c.querySelector(q).getBoundingClientRect();
      return { save: b('a.biz-card__save').top, acts: b('.biz-card__actions').bottom, sum: b('.biz-card__qr-narrow > summary'), visibleImgs: [...c.querySelectorAll('img')].filter((i) => i.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })).map((i) => i.className || i.getAttribute('src')) };
    });
    expect(s.sum.top, `${at} Show QR after the actions`).toBeGreaterThanOrEqual(s.acts);
    expect(s.sum.height, `${at} Show QR target`).toBeGreaterThanOrEqual(44);
    expect(s.visibleImgs, `${at} only the logo shows before opening`).toEqual(['biz-card__logo']);
    await summary.click(); // a native disclosure, not a contact link
    expect(await details.evaluate((d) => d.open), `${at} opens`).toBe(true);
    const img = details.locator('.biz-card__qr-plate > img');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0), { message: `${at} QR loaded` }).toBe(true);
    const g = await img.evaluate(qrGeometry);
    expect(g.w, `${at} QR width`).toBeGreaterThanOrEqual(176);
    expect(g.insidePlate && g.insideCard, `${at} QR uncropped`).toBe(true);
    expect(g.plateBg).toBe('rgb(255, 255, 255)');
    expect(g.filtered).toBe(false);
    await expect(details.locator('.biz-card__qr-copy a')).toHaveAttribute('href', CONNECT_URL);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${at} no overflow when open`).toBeLessThanOrEqual(1);
    // At 400% (320x180 CSS px) the 194px plate is taller than the whole viewport, so the sticky header and contact bar necessarily overlap
    // part of it; for the decode only, they are hidden through the CSSOM (layout unchanged) and that is recorded in the evidence.
    const tall = await page.evaluate(() => innerHeight < 260);
    if (tall) await page.evaluate(() => { for (const e of document.querySelectorAll('.site-header, .mobile-contact-bar')) e.style.visibility = 'hidden'; });
    const d = await decodeElement(context, details.locator('.biz-card__qr-plate'));
    expect(d.text, `${at} decoded QR`).toBe(CONNECT_URL);
    evidence.push({ viewport: at, rendered: [g.w, g.h], decoded: d.text, overlaysHiddenForDecode: tall });
    await context.close();
  }
  if (process.env.K5E_QR_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${process.env.K5E_QR_OUT}/rendered-decode-narrow-opened.json`, JSON.stringify(evidence, null, 1));
  }
});

test('k5e: company first: the official white horizontal logo (the Footer one) leads the card, Eddie Gugino / Founder / Beaufort follow, no avatar and no duplicate wordmark', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 780]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/connect/');
    const at = `${width}`;
    const card = page.locator('#main-content article.biz-card');
    const footerLogo = await page.locator('footer img.footer-logo').getAttribute('src');
    await expect(card.locator('img.biz-card__logo')).toHaveAttribute('src', footerLogo);
    await expect(card.locator('.biz-card__avatar'), `${at} no initials avatar`).toHaveCount(0);
    const m = await card.evaluate((c) => {
      const top = (q) => c.querySelector(q).getBoundingClientRect().top;
      const logo = c.querySelector('img.biz-card__logo').getBoundingClientRect();
      const words = [...c.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^\s*lowcountry digital works\s*$/i.test(e.textContent)).length;
      return { logo: logo.top, logoW: logo.width, name: top('.biz-card__name'), title: top('.biz-card__title'), place: top('.biz-card__place'), words, first: c.firstElementChild.className };
    });
    expect(m.first, `${at} header first`).toBe('biz-card__banner');
    expect(m.logo, `${at} logo above the name`).toBeLessThan(m.name);
    expect(m.name).toBeLessThan(m.title);
    expect(m.title).toBeLessThan(m.place);
    expect(m.logoW, `${at} logo legible width`).toBeGreaterThanOrEqual(160);
    expect(m.words, `${at} no second text wordmark`).toBe(0);
    await expect(card.locator('.biz-card__name')).toHaveText(contact.founder.name);
    await expect(card.locator('.biz-card__title')).toHaveText(`${contact.founder.role} · Lowcountry Digital Works LLC`);
  }
});

// WCAG relative-luminance contrast on composited colours.
const contrastProbe = () => {
  const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) stack.push(c); if (c.a === 1) break; } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (const c of stack.reverse()) acc = over(c, acc); return acc; };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const card = document.querySelector('#main-content article.biz-card');
  const sel = ['.biz-card__name', '.biz-card__title', '.biz-card__place', 'a.biz-card__save', 'a.biz-card__action', '.biz-card__line', '.biz-card__qr-copy strong', '.biz-card__qr-copy a', '.biz-card__qr-narrow > summary', '.biz-card__tagline'];
  const text = [];
  for (const q of sel) for (const e of card.querySelectorAll(q)) {
    if (!e.getBoundingClientRect().width) continue;
    const fg = parse(getComputedStyle(e).color); const bg = bgOf(e);
    text.push({ q, fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio(over(fg, bg), bg) * 100) / 100 });
  }
  const cs = getComputedStyle(card);
  const surface = bgOf(card.parentElement);
  const cardBg = parse(cs.backgroundColor);
  const edge = parse(cs.borderTopColor);
  return {
    text, surface: hex(surface), card: hex(cardBg), edge: hex(edge), edgeWidth: parseFloat(cs.borderTopWidth),
    edgeVsSurface: Math.round(ratio(edge, surface) * 100) / 100, edgeVsCard: Math.round(ratio(edge, cardBg) * 100) / 100,
    cardVsSurface: Math.round(ratio(cardBg, surface) * 100) / 100, cardAlpha: cardBg.a,
    backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none', shadow: cs.boxShadow,
  };
};

test('k5e: card text keeps >= 4.5:1, the #52796D edge separates the white card from the page by >= 3:1, the card is opaque (no glass) with a restrained shadow, at 1440, 950, 390 and 320', async ({ page }) => {
  const out = [];
  for (const [width, height] of [[1440, 900], [950, 900], [390, 844], [320, 780]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/connect/');
    if (width < 900) await page.locator('.biz-card__qr-narrow > summary').click();
    const m = await page.evaluate(contrastProbe);
    out.push({ width, ...m });
    for (const t of m.text) expect.soft(t.ratio, `${width} ${t.q} ${t.fg} on ${t.bg}`).toBeGreaterThanOrEqual(4.5);
    expect(m.card, `${width} white card`).toBe('#FFFFFF');
    expect(m.edge, `${width} card edge`).toBe('#52796D');
    expect(m.edgeWidth, `${width} edge width`).toBeGreaterThanOrEqual(1.5);
    expect(m.edgeVsSurface, `${width} edge vs page surface ${m.surface}`).toBeGreaterThanOrEqual(3);
    expect(m.cardAlpha, `${width} opaque card`).toBe(1);
    expect(m.backdrop, `${width} no glass`).toBe('none');
    expect(m.shadow, `${width} shadow present`).not.toBe('none');
    const alphas = [...m.shadow.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((x) => Number(x[1]));
    expect(Math.max(...alphas), `${width} restrained shadow`).toBeLessThanOrEqual(0.2);
  }
  if (process.env.K5E_CONTRAST_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.K5E_CONTRAST_OUT, JSON.stringify(out, null, 1));
  }
});
