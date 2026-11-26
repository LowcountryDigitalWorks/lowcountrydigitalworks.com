import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Consent + events behaviour of the analytics adapter, with EVERY third-party request intercepted locally (nothing reaches Google or Microsoft).
// Needs a TEST build that bakes 127.0.0.1 into the loader's host list (never a release build):
//   ANALYTICS_ENABLED=1 ANALYTICS_TEST_BUILD=1 ANALYTICS_TEST_EXTRA_HOSTS=127.0.0.1 npm run build
//   ANALYTICS_ENABLED=1 ANALYTICS_TEST_BUILD=1 ANALYTICS_TEST_EXTRA_HOSTS=127.0.0.1 npx playwright test tests/analytics-consent.spec.mjs
// Skipped in every other run.
const TEST_BUILD = process.env.ANALYTICS_ENABLED === '1' && process.env.ANALYTICS_TEST_BUILD === '1' && String(process.env.ANALYTICS_TEST_EXTRA_HOSTS ?? '').split(',').map((h) => h.trim()).includes('127.0.0.1');
const LOG = process.env.ANALYTICS_NETWORK_LOG ?? '';
test.skip(!TEST_BUILD, 'needs ANALYTICS_ENABLED=1 + ANALYTICS_TEST_BUILD=1 + ANALYTICS_TEST_EXTRA_HOSTS=127.0.0.1 build');

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const STORE = 'ldw-consent-v1';

// Stub vendor scripts. The gtag.js stub models how the real library builds each hit (r3, L4): parameters from 'set' apply to every hit,
// parameters from 'config' apply to every later hit for that stream, and an event's own parameters win over both. 'config' itself sends a
// page_view unless send_page_view is false. Like the real library it also sends dl/dr/dt, falling back to the LIVE document URL, referrer and
// title when nothing set page_location/page_referrer/page_title, so a missing or raw override shows up as a leak in a later event too.
// All stub traffic goes to the real vendor hostnames and is fulfilled locally.
const GTAG_STUB = `(function(){
  var globals={}, cfg={};
  function send(name,params){var q=new URLSearchParams();q.set('v','2');q.set('tid','G-127KLSQHRB');q.set('en',name);
    var all=Object.assign({},globals,cfg,params||{}); delete all.send_page_view;
    q.set('dl',all.page_location!==undefined?String(all.page_location):location.href);q.set('dr',all.page_referrer!==undefined?String(all.page_referrer):document.referrer);q.set('dt',all.page_title!==undefined?String(all.page_title):document.title);
    Object.keys(all).forEach(function(k){q.set('ep.'+k,String(all[k]));});
    new Image().src='https://www.google-analytics.com/g/collect?'+q.toString(); }
  function handle(e){var a=Array.prototype.slice.call(e);
    if(a[0]==='set'&&a[1]&&typeof a[1]==='object')Object.assign(globals,a[1]);
    if(a[0]==='config'){cfg=Object.assign({},a[2]||{}); if(!a[2]||a[2].send_page_view!==false)send('page_view',{});}
    if(a[0]==='event')send(a[1],a[2]);}
  var dl=window.dataLayer; dl.forEach(handle); var push=dl.push.bind(dl); dl.push=function(){Array.prototype.slice.call(arguments).forEach(handle); return push.apply(null,arguments);};
  window.__gtagStub=1;
})();`;
const GTM_STUB = `window.__gtmStub=1;new Image().src='https://www.googletagmanager.com/a?id=GTM-WZJ8HHKK';`;
const CLARITY_TAG_STUB = `window.__clarityTagStub=1;var s=document.createElement('script');s.async=true;s.src='https://scripts.clarity.ms/0.8.30/clarity.js';document.head.appendChild(s);`;
// DEV04 F3: like the real SDK (whose URL masking does not cover referrers), the runtime stub tries to record the live URL and document.referrer
// in its collect request, so a leaky load shows up in the intercepted log.
const CLARITY_RUNTIME_STUB = `window.__clarityRuntimeStub=1;fetch('https://k.clarity.ms/collect?u='+encodeURIComponent(location.href)+'&r='+encodeURIComponent(document.referrer),{method:'POST',mode:'no-cors',body:'x'}).catch(function(){});new Image().src='https://c.bing.com/c.gif';new Image().src='https://c.clarity.ms/c.gif';`;

async function intercept(context, log) {
  await context.route((url) => !['127.0.0.1', 'localhost'].includes(url.hostname), async (route) => {
    const url = new URL(route.request().url());
    const entry = { t: Date.now(), method: route.request().method(), url: url.href, referer: route.request().headers()['referer'] ?? null };
    const js = (body) => route.fulfill({ status: 200, contentType: 'application/javascript', body });
    const known = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|clarity\.ms|bing\.com|google\.com)$/.test(url.hostname);
    entry.action = known ? 'fulfilled-locally' : 'ABORTED-unexpected-host';
    log.push(entry);
    if (LOG) { mkdirSync(path.dirname(LOG), { recursive: true }); appendFileSync(LOG, JSON.stringify({ ...entry, test: test.info().title }) + '\n'); }
    if (!known) return route.abort();
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtag/js') return js(GTAG_STUB);
    if (url.hostname === 'www.googletagmanager.com' && url.pathname === '/gtm.js') return js(GTM_STUB);
    if (url.hostname === 'www.clarity.ms' && url.pathname.startsWith('/tag/')) return js(CLARITY_TAG_STUB);
    if (url.hostname === 'scripts.clarity.ms') return js(CLARITY_RUNTIME_STUB);
    return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
  });
}

async function setup(browser, { viewport, gpc = false, javaScriptEnabled = true, cookies = [] } = {}) {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1280, height: 900 }, javaScriptEnabled, isMobile: viewport ? viewport.width < 700 : false, hasTouch: viewport ? viewport.width < 700 : false });
  const log = [];
  await intercept(context, log);
  if (cookies.length) await context.addCookies(cookies);
  if (javaScriptEnabled) {
    await context.addInitScript((isGpc) => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      if (isGpc) Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
      // Links must not navigate away (tel:/sms:/mailto: and the external Dashform handoff) during the test; the click handlers still run first.
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[data-ldw-event]')) e.preventDefault(); });
    }, gpc);
  }
  const page = await context.newPage();
  return { context, page, log };
}

const collects = (log) => log.filter((e) => /^www\.google-analytics\.com$/.test(new URL(e.url).hostname) && e.url.includes('/g/collect')).map((e) => Object.fromEntries(new URL(e.url).searchParams));
const events = (log, name) => collects(log).filter((c) => c.en === name);
const vendorRequests = (log) => log.map((e) => e.url);
const stored = (page) => page.evaluate((k) => window.localStorage.getItem(k), STORE);
const settle = (page, ms = 1200) => page.waitForLoadState('load').then(() => page.waitForTimeout(ms));
const cspViolations = (page) => page.evaluate(() => window.__csp);

const PUBLIC_ROUTES = ['/', '/connect/', '/services/', '/services/websites/', '/discovery/', '/privacy/'];

test.describe('before consent', () => {
  test('zero Google/Microsoft requests, no storage, no cookies, banner shown', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, log } = await setup(browser);
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      await settle(page, 5000); // longer than the 4s idle timeout the loader would use if it were (wrongly) loading
      await expect(page.getByRole('region', { name: 'Your privacy choices' })).toBeVisible();
      expect(await stored(page)).toBeNull();
      expect(await page.evaluate(() => ({ gtag: typeof window.gtag, dl: typeof window.dataLayer, clarity: typeof window.clarity }))).toEqual({ gtag: 'undefined', dl: 'undefined', clarity: 'undefined' });
      expect(await page.evaluate(() => document.querySelectorAll('script[src*="googletagmanager"],script[src*="clarity"]').length)).toBe(0);
    }
    expect(vendorRequests(log)).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
    await context.close();
  });

  test('private routes: no banner, no loader, no requests, even with a prior choice', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/');
    await page.evaluate((k) => window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c: 1, t: Date.now() })), STORE);
    await page.goto('/share/');
    await settle(page, 5000);
    await expect(page.locator('#ldw-consent')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll('script[src*="ldw-analytics"]').length)).toBe(0);
    expect(vendorRequests(log)).toEqual([]);
    await context.close();
  });
});

test.describe('reject', () => {
  test('Reject all stores a rejection, loads nothing, and the banner stays gone on reload', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/');
    await page.getByRole('button', { name: 'Reject all' }).click();
    await expect(page.locator('#ldw-consent')).toBeHidden();
    expect(JSON.parse(await stored(page))).toMatchObject({ v: 1, a: 0, c: 0 });
    await settle(page, 5000);
    await page.reload();
    await settle(page, 5000);
    await expect(page.locator('#ldw-consent')).toBeHidden();
    expect(vendorRequests(log)).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    await context.close();
  });

  test('Global Privacy Control is treated as reject until the visitor chooses', async ({ browser }) => {
    const { context, page, log } = await setup(browser, { gpc: true });
    await page.goto('/');
    await settle(page, 5000);
    await expect(page.locator('#ldw-consent')).toBeHidden();
    expect(JSON.parse(await stored(page))).toMatchObject({ a: 0, c: 0 });
    expect(vendorRequests(log)).toEqual([]);
    await context.close();
  });
});

test.describe('accept', () => {
  test('Accept all: gtag, GTM and Clarity load once, consent keeps ad signals denied, exactly one page_view per page, one request set per tool', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/connect/?utm_source=x&email=a%40b.com#frag');
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect.poll(() => vendorRequests(log).some((u) => u.includes('scripts.clarity.ms')) && events(log, 'page_view').length).toBe(1);
    await settle(page, 1500);
    const urls = vendorRequests(log);
    expect(urls.filter((u) => u.includes('/gtag/js?id=G-127KLSQHRB')).length).toBe(1);
    expect(urls.filter((u) => u.includes('/gtm.js?id=GTM-WZJ8HHKK')).length).toBe(1);
    expect(urls.filter((u) => u === 'https://www.clarity.ms/tag/zabyszkk6y').length).toBe(1);
    expect(urls.some((u) => u.includes('scripts.clarity.ms'))).toBe(true);
    expect(events(log, 'page_view').length, 'exactly one page_view (automatic config page_view is disabled)').toBe(1);
    const dl = await page.evaluate(() => window.dataLayer.map((x) => JSON.stringify(Array.from(x))));
    const consent = dl.map((x) => JSON.parse(x)).filter((x) => x[0] === 'consent');
    expect(consent).toEqual([['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }], ['consent', 'update', { analytics_storage: 'granted' }]]);
    expect(dl.join(' ')).not.toMatch(/"(?:ad_storage|ad_user_data|ad_personalization)":"granted"/);
    const config = dl.map((x) => JSON.parse(x)).find((x) => x[0] === 'config');
    expect(config[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    expect(await page.evaluate(() => document.querySelectorAll('form[data-clarity-mask="True"]').length >= 0 && document.querySelectorAll('a[href^="tel:"]:not([data-clarity-mask="True"])').length)).toBe(0);
    expect(await cspViolations(page), 'every request the stubs make is inside the CSP allowlist').toEqual([]);
    expect(await page.evaluate(() => [window.__gtagStub, window.__gtmStub, window.__clarityTagStub, window.__clarityRuntimeStub])).toEqual([1, 1, 1, 1]);
    // second page: one more page_view, nothing duplicated
    await page.goto('/services/');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(2);
    await settle(page, 1500);
    expect(events(log, 'page_view').length).toBe(2);
    expect(JSON.parse(await stored(page))).toMatchObject({ a: 1, c: 1 });
    await context.close();
  });

  test('Preferences: analytics only keeps Clarity out', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/');
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.getByLabel(/Site analytics/).check();
    await page.getByRole('button', { name: 'Save choices' }).click();
    await expect.poll(() => events(log, 'page_view').length).toBe(1);
    await settle(page, 1500);
    expect(vendorRequests(log).some((u) => u.includes('clarity.ms'))).toBe(false);
    expect(JSON.parse(await stored(page))).toMatchObject({ a: 1, c: 0 });
    await context.close();
  });
});

test.describe('revoke', () => {
  test('footer Privacy choices reopens the banner; turning tools off clears cookies, reloads clean and stops all transmission', async ({ browser }) => {
    const { context, page, log } = await setup(browser, { cookies: [{ name: '_ga', value: 'GA1.1.1', url: 'http://127.0.0.1:4321' }, { name: '_ga_127KLSQHRB', value: 'x', url: 'http://127.0.0.1:4321' }, { name: '_clck', value: 'y', url: 'http://127.0.0.1:4321' }, { name: 'unrelated', value: 'keep', url: 'http://127.0.0.1:4321' }] });
    await page.goto('/connect/');
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect.poll(() => events(log, 'page_view').length).toBe(1);
    await page.getByRole('link', { name: 'Privacy choices' }).click();
    const banner = page.getByRole('region', { name: 'Your privacy choices' });
    await expect(banner).toBeVisible();
    await expect(banner).toBeFocused();
    await page.getByRole('button', { name: 'Preferences' }).click();
    await expect(page.getByLabel(/Site analytics/)).toBeChecked();
    await expect(page.getByLabel(/Session replay/)).toBeChecked();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reject all' }).click()]);
    await settle(page, 1000);
    expect(JSON.parse(await stored(page))).toMatchObject({ a: 0, c: 0 });
    expect((await context.cookies()).map((c) => c.name)).toEqual(['unrelated']);
    expect(await page.evaluate(() => ({ gtag: typeof window.gtag, dl: typeof window.dataLayer, clarity: typeof window.clarity }))).toEqual({ gtag: 'undefined', dl: 'undefined', clarity: 'undefined' });
    const before = log.length;
    await page.locator('a[data-ldw-method="phone"][data-ldw-placement="connect_actions"]').click();
    await page.goto('/services/');
    await settle(page, 5000);
    expect(log.length, 'no request of any kind after revocation').toBe(before);
    await context.close();
  });

  test('revoking only Clarity reloads without Clarity but keeps analytics', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/');
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect.poll(() => vendorRequests(log).some((u) => u.includes('scripts.clarity.ms'))).toBe(true);
    await page.getByRole('link', { name: 'Privacy choices' }).click();
    await page.getByRole('button', { name: 'Preferences' }).click();
    await page.getByLabel(/Session replay/).uncheck();
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Save choices' }).click()]);
    const mark = log.length;
    await expect.poll(() => vendorRequests(log).slice(mark).some((u) => u.includes('/gtag/js'))).toBe(true);
    await settle(page, 1500);
    expect(vendorRequests(log).slice(mark).some((u) => /clarity|bing/.test(u))).toBe(false);
    expect(await page.evaluate(() => typeof window.clarity)).toBe('undefined');
    await context.close();
  });
});

test.describe('events and PII', () => {
  const ACCEPT = async (page, log, route) => {
    await page.goto(route);
    await page.evaluate((k) => window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c: 0, t: Date.now() })), STORE);
    await page.reload();
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBeGreaterThan(0);
  };
  const CASES = [
    ['/connect/', 'a[data-ldw-method="sms"][data-ldw-placement="connect_actions"]', 'contact_method_click', { method: 'sms', placement: 'connect_actions' }],
    ['/connect/', 'a[data-ldw-method="phone"][data-ldw-placement="connect_actions"]', 'contact_method_click', { method: 'phone', placement: 'connect_actions' }],
    ['/connect/', 'a[data-ldw-method="email"][data-ldw-placement="connect_actions"]', 'contact_method_click', { method: 'email', placement: 'connect_actions' }],
    ['/connect/', 'a[data-ldw-event="contact_card_download"]', 'contact_card_download', { placement: 'connect_card' }],
    ['/', 'a[data-ldw-placement="home_hero"]', 'contact_method_click', { method: 'sms', placement: 'home_hero' }],
    ['/', 'footer a[data-ldw-method="phone"]', 'contact_method_click', { method: 'phone', placement: 'footer' }],
    ['/', 'footer a[data-ldw-method="email"]', 'contact_method_click', { method: 'email', placement: 'footer' }],
    ['/services/', 'a.svc-card__surface[data-ldw-service="websites"]', 'service_cta_click', { service_id: 'websites', placement: 'services_hub' }],
    ['/services/technology-consulting/', 'a[data-ldw-placement="service_detail"]', 'service_cta_click', { service_id: 'technology-consulting', placement: 'service_detail' }],
    ['/services/website-care/', 'a[data-ldw-placement="service_detail"]', 'service_cta_click', { service_id: 'website-care', placement: 'service_detail' }],
    ['/discovery/', 'a[data-ldw-placement="discovery_hero"]', 'discovery_handoff_click', { destination: 'dashform', placement: 'discovery_hero' }],
    ['/discovery/', 'a[data-ldw-placement="discovery_bottom"]', 'discovery_handoff_click', { destination: 'dashform', placement: 'discovery_bottom' }],
  ];
  for (const [route, selector, name, expected] of CASES) {
    test(`${name} ${JSON.stringify(expected)} from ${route}`, async ({ browser }) => {
      const { context, page, log } = await setup(browser);
      await ACCEPT(page, log, route);
      const before = events(log, name).length;
      await page.locator(selector).first().click();
      await expect.poll(() => events(log, name).length).toBe(before + 1);
      const sent = events(log, name).at(-1);
      const params = Object.fromEntries(Object.entries(sent).filter(([k]) => k.startsWith('ep.')).map(([k, v]) => [k.slice(3), v]));
      const own = Object.fromEntries(Object.entries(params).filter(([k]) => ['method', 'placement', 'service_id', 'destination', 'transport_type'].includes(k)));
      expect(own).toEqual({ ...expected, transport_type: 'beacon' });
      await context.close();
    });
  }

  test('mobile bar clicks send placement mobile_bar (mobile viewport)', async ({ browser }) => {
    const { context, page, log } = await setup(browser, { viewport: { width: 390, height: 844 } });
    await ACCEPT(page, log, '/');
    await page.locator('.mobile-contact-bar a[data-ldw-method="sms"]').click();
    await expect.poll(() => events(log, 'contact_method_click').length).toBe(1);
    expect(events(log, 'contact_method_click')[0]).toMatchObject({ 'ep.method': 'sms', 'ep.placement': 'mobile_bar' });
    await context.close();
  });

  test('PII: no phone number, email, href, link text, query string, fragment or form content in any request', async ({ browser }) => {
    test.setTimeout(90_000);
    const { context, page, log } = await setup(browser);
    await page.goto('/connect/?utm_source=newsletter&email=a%40b.com&phone=8436333123#secret');
    await page.evaluate((k) => window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c: 1, t: Date.now() })), STORE);
    await page.reload(); // a hash-only goto to the same URL would not reload the document
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    await page.getByRole('link', { name: /Find a service/ }).click(); // same-origin navigation: referrer carries the query
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(2);
    for (const sel of ['a[data-ldw-method="sms"]', 'a[data-ldw-method="phone"]', 'a[data-ldw-method="email"]']) await page.locator(sel).first().click({ timeout: 3000, noWaitAfter: true }).catch(() => {});
    await settle(page, 1500);
    const all = vendorRequests(log);
    const text = decodeURIComponent(all.join('\n'));
    expect(text).not.toMatch(/843|633-?3123|\+1843|@|mailto:|tel:|sms:|utm_source|newsletter|a@b\.com|secret|#|[?&]email=|[?&]phone=/i);
    for (const c of collects(log)) {
      expect(c['ep.page_location'], 'page_location is origin + path only').toMatch(/^http:\/\/127\.0\.0\.1:4321\/[a-z0-9/-]*$/);
      expect(c['ep.page_referrer'] ?? '').not.toMatch(/[?#]/);
    }
    expect(collects(log).some((c) => (c['ep.page_referrer'] ?? '').includes('/connect/'))).toBe(true);
    await context.close();
  });

  test('tampered or unknown attributes send nothing (allowlist, method/href cross-check)', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await ACCEPT(page, log, '/');
    const before = collects(log).length;
    await page.evaluate(() => {
      const mk = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstChild); };
      mk('<a id="t1" href="mailto:x@y.z" data-ldw-event="contact_method_click" data-ldw-method="phone" data-ldw-placement="footer">x</a>');
      mk('<a id="t2" href="tel:+15550001111" data-ldw-event="contact_method_click" data-ldw-method="phone" data-ldw-placement="somewhere_else">x</a>');
      mk('<a id="t3" href="/connect/" data-ldw-event="generate_lead" data-ldw-placement="footer">x</a>');
      mk('<a id="t4" href="https://example.com/" data-ldw-event="discovery_handoff_click" data-ldw-placement="discovery_hero">x</a>');
      mk('<a id="t5" href="/connect/" data-ldw-event="service_cta_click" data-ldw-service="secret-project-x" data-ldw-placement="services_hub">x</a>');
      mk('<a id="t6" href="/x.pdf" data-ldw-event="contact_card_download" data-ldw-placement="connect_card">x</a>');
    });
    for (const id of ['t1', 't2', 't3', 't4', 't5', 't6']) await page.locator('#' + id).click();
    await page.waitForTimeout(800);
    expect(collects(log).length).toBe(before);
    await context.close();
  });
});

// M1: the route allowlist baked into the loader. Every GA4 parameter that carries a URL (dl, dr, ep.page_location, ep.page_path,
// ep.page_referrer) must be a known route of this build or /other/; no segment of a visitor-supplied path may appear in ANY vendor request.
test.describe('route allowlist (M1)', () => {
  const ORIGIN = 'http://127.0.0.1:4321';
  const consentAll = (page) => page.evaluate((k) => window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c: 1, t: Date.now() })), STORE);
  const urlParams = (c) => ({ dl: c.dl, dr: c.dr ?? '', page_location: c['ep.page_location'], page_path: c['ep.page_path'], page_referrer: c['ep.page_referrer'] ?? '' });
  const PII_PATHS = [
    ['email in path', '/contact/foo@bar.com', /foo|bar\.com|%40|@/i],
    ['phone digits in path', '/connect/843-633-3123', /843|633|3123/],
    ['bare phone number in path', '/contact/8435551234', /843|555|1234/],
    ['name plus digits in path', '/x/john-smith-8435551234', /john|smith|843|555|1234|\/x\//i],
    ['unknown route (404 page)', '/this-page-does-not-exist/', /this-page|does-not-exist/],
  ];
  for (const [label, rawPath, leak] of PII_PATHS) {
    test(`${label}: GA4 gets /other/ for page_location, page_path and dl; no raw path segment in any request; no session replay`, async ({ browser }) => {
      const { context, page, log } = await setup(browser);
      const res = await page.goto(rawPath);
      if (label.startsWith('unknown')) expect(res.status(), 'served by the 404 page').toBe(404);
      await consentAll(page);
      await page.reload();
      await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
      await settle(page, 1500);
      const pv = events(log, 'page_view')[0];
      expect(urlParams(pv)).toMatchObject({ dl: ORIGIN + '/other/', page_location: ORIGIN + '/other/', page_path: '/other/' });
      for (const c of collects(log)) for (const [k, v] of Object.entries(urlParams(c))) expect(v, k).not.toMatch(leak);
      const text = decodeURIComponent(vendorRequests(log).join('\n'));
      expect(text, 'no vendor request carries the raw path').not.toMatch(leak);
      expect(vendorRequests(log).filter((u) => /clarity\.ms|bing\.com/.test(u)), 'Clarity never starts on a non-allowlisted path').toEqual([]);
      await context.close();
    });
  }

  test('same-origin referrer from a PII path: the 404 page sends only the origin (r3), so document.referrer and GA4 never see the path; the next page reports its own route', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/contact/foo@bar.com');
    await consentAll(page);
    await page.evaluate(() => { window.location.href = '/services/'; }); // script navigation: without the meta the browser would send the full same-origin referrer
    await page.waitForURL('**/services/');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    expect(await page.evaluate(() => document.referrer), 'document.referrer (read by Clarity directly) is the bare origin').toBe(ORIGIN + '/');
    const pv = events(log, 'page_view')[0];
    expect(urlParams(pv)).toEqual({ dl: ORIGIN + '/services/', dr: ORIGIN + '/', page_location: ORIGIN + '/services/', page_path: '/services/', page_referrer: ORIGIN + '/' });
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/foo|bar\.com|@/);
    await context.close();
  });

  // r3 (L1/L4): referrer policy on /other/ pages, the Referer header on cross-site requests, and config parameters carried into later events.
  const consentBeforeLoad = (context, clarity = 1) => context.addInitScript(([k, c]) => { if (location.hostname === '127.0.0.1') window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c, t: Date.now() })); }, [STORE, clarity]);
  const probe = async (page, log, name) => {
    await page.evaluate((n) => window.gtag('event', n, { percent_scrolled: 90 }), name); // like an Enhanced Measurement or GTM event: no page parameters of its own
    await expect.poll(() => events(log, name).length, { timeout: 10000 }).toBe(1);
    return events(log, name)[0];
  };

  test('r3 referrer meta: the 404 page and every unknown route carry <meta name="referrer" content="origin">; allowlisted pages keep the site policy', async ({ browser }) => {
    const { context, page } = await setup(browser);
    for (const p of ['/contact/foo@bar.com', '/this-page-does-not-exist/', '/x/john-smith-8435551234']) {
      await page.goto(p);
      expect(await page.locator('head meta[name="referrer"]').evaluateAll((ms) => ms.map((m) => m.getAttribute('content'))), p).toEqual(['origin']);
    }
    for (const p of ['/', '/services/', '/connect/', '/privacy/']) {
      await page.goto(p);
      await expect(page.locator('meta[name="referrer"]'), p).toHaveCount(0);
    }
    await context.close();
  });

  test('r3 Referer header: every cross-site request carries only the bare origin, from an allowlisted page with a query and from a PII path', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context);
    for (const p of ['/services/websites/?email=a%40b.com&phone=8435551234#frag', '/contact/foo@bar.com']) {
      const mark = log.length;
      await page.goto(p);
      await expect.poll(() => events(log.slice(mark), 'page_view').length, { timeout: 10000 }).toBe(1);
      await settle(page, 800);
      const refs = log.slice(mark).map((e) => e.referer);
      expect(refs.length, p + ': vendor requests seen').toBeGreaterThan(2);
      expect(refs.filter((r) => r === ORIGIN + '/').length, p + ': precondition, the browser sends a Referer').toBeGreaterThan(0);
      for (const r of refs) expect([null, ORIGIN + '/'], p + ': Referer ' + r).toContain(r);
    }
    await context.close();
  });

  test('r3 config carry-over: a later event with no page parameters on a PII path still reports /other/ (raw config page_location would leak)', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context);
    await page.goto('/contact/foo@bar.com');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    const ev = await probe(page, log, 'scroll');
    expect({ dl: ev.dl, page_location: ev['ep.page_location'] }).toEqual({ dl: ORIGIN + '/other/', page_location: ORIGIN + '/other/' });
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/foo|bar\.com|@/);
    await context.close();
  });

  test('r3 config carry-over: after a same-origin hop from a page with a query, later events report the referrer without it (raw config page_referrer would leak)', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context, 0); // analytics only: Clarity's address-bar clean-up does not run, so the query stays in the URL
    await page.goto('/services/websites/?email=a%40b.com&phone=8435551234');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    await page.evaluate(() => { window.location.href = '/connect/'; });
    await page.waitForURL('**/connect/');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(2);
    expect(await page.evaluate(() => document.referrer), 'precondition: the browser exposes the query in the same-origin referrer').toContain('email=a%40b.com');
    const ev = await probe(page, log, 'scroll');
    expect({ dr: ev.dr, page_referrer: ev['ep.page_referrer'] }).toEqual({ dr: ORIGIN + '/services/websites/', page_referrer: ORIGIN + '/services/websites/' });
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/a@b\.com|8435551234|email=|phone=/);
    await context.close();
  });

  test('r3 cross-site referrer: GA4 gets only the external origin, on page_view and on later events (a full external referrer would leak)', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context);
    await page.goto('/services/', { referer: 'https://www.google.com/search?q=john+smith+8435551234' });
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    expect(await page.evaluate(() => document.referrer), 'precondition: the page sees the full external referrer').toContain('google.com/search');
    const ev = await probe(page, log, 'scroll');
    for (const c of [events(log, 'page_view')[0], ev]) expect({ dr: c.dr, page_referrer: c['ep.page_referrer'] }).toEqual({ dr: 'https://www.google.com/', page_referrer: 'https://www.google.com/' });
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/john|smith|8435551234|search\?q/i);
    await context.close();
  });

  test('allowlisted routes pass through unchanged; query and fragment never sent; the baked allowlist has no private, 404 or /other/ entry', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/services/websites/?email=a%40b.com&gclid=zzz#frag');
    await consentAll(page);
    await page.reload();
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    expect(urlParams(events(log, 'page_view')[0])).toMatchObject({ dl: ORIGIN + '/services/websites/', page_location: ORIGIN + '/services/websites/', page_path: '/services/websites/' });
    const routes = JSON.parse((await (await page.request.get('/ldw-analytics.js')).text()).match(/var ROUTES = (\[[^\]]*\]);/)[1]);
    expect(routes).toContain('/');
    expect(routes).toContain('/services/websites/');
    expect(routes.some((r) => /^\/(share|admin|api)(\/|$)|404|other/.test(r)), 'no private route, 404 or /other/ in the allowlist').toBe(false);
    await context.close();
  });

  test('session replay: Clarity starts on an allowlisted route only after query and non-anchor fragment are removed from the address bar', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/connect/');
    await consentAll(page);
    await page.goto('/connect/?utm_source=x&email=a%40b.com#secret@x.com');
    await expect.poll(() => vendorRequests(log).some((u) => u.includes('scripts.clarity.ms')), { timeout: 10000 }).toBe(true);
    expect(page.url()).toBe(ORIGIN + '/connect/');
    await page.goto('/connect/#connect-heading');
    await settle(page, 1500);
    expect(page.url(), 'a real in-page anchor is kept').toBe(ORIGIN + '/connect/#connect-heading');
    await context.close();
  });

  // ---- DEV04 findings on PR #162 (comments 7091874698, 7092075014) ----
  const clarityHits = (log) => log.filter((e) => /(^|\.)(clarity\.ms|bing\.com)$/.test(new URL(e.url).hostname));
  const clarityState = (page) => page.evaluate(() => ({ clarity: typeof window.clarity, tag: window.__clarityTagStub ?? 0, runtime: window.__clarityRuntimeStub ?? 0, scripts: document.querySelectorAll('script[src*="clarity"]').length }));
  const clarityCookies = async (context) => (await context.cookies()).filter((c) => /^(_clck|_clsk|CLID|ANONCHK|MR|MUID|SM)$/.test(c.name));
  const optInViaBanner = async (page) => {
    await page.locator('footer [data-ldw-consent-open]').first().click();
    await page.getByRole('button', { name: 'Accept all' }).click();
  };

  test('DEV04 F1: the Website Care service CTA reports service_id website-care (not websites), once, with no href or text', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/services/website-care/');
    await page.evaluate((k) => window.localStorage.setItem(k, JSON.stringify({ v: 1, a: 1, c: 0, t: Date.now() })), STORE);
    await page.reload();
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    const cta = page.locator('a[data-ldw-event="service_cta_click"][data-ldw-placement="service_detail"]');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveAttribute('data-ldw-service', 'website-care');
    await cta.click();
    await expect.poll(() => events(log, 'service_cta_click').length).toBe(1);
    await page.waitForTimeout(800);
    const sent = events(log, 'service_cta_click');
    expect(sent.length, 'exactly one event for one click').toBe(1);
    expect(sent[0]).toMatchObject({ 'ep.service_id': 'website-care', 'ep.placement': 'service_detail' });
    const linkText = (await cta.textContent()).trim();
    const href = await cta.getAttribute('href');
    expect(linkText.length, 'precondition: the CTA has text').toBeGreaterThan(0);
    for (const [k, v] of Object.entries(sent[0]).filter(([key]) => key.startsWith('ep.'))) {
      expect(v.includes(linkText) || v.includes(href) || /sms:|tel:|mailto:|@/.test(v), k + ' carries no href, contact data or link text').toBe(false);
    }
    expect(events(log, 'service_cta_click').filter((c) => c['ep.service_id'] === 'websites'), 'no Websites attribution from the Care page').toEqual([]);
    await context.close();
  });

  for (const [label, patch] of [
    ['throws', () => { history.replaceState = function () { throw new DOMException('blocked', 'SecurityError'); }; }],
    ['is unavailable', () => { history.replaceState = undefined; }],
    ['silently does nothing', () => { history.replaceState = function () {}; }],
  ]) {
    test(`DEV04 F2: Clarity fails closed when history.replaceState ${label}: no Clarity tag, runtime, beacon or cookie, nothing leaks, GA4 still runs`, async ({ browser }) => {
      const { context, page, log } = await setup(browser);
      await consentBeforeLoad(context, 1);
      await context.addInitScript(patch);
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto('/connect/?email=placeholder%40example.test#untrusted');
      await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
      await settle(page, 5000);
      expect(page.url(), 'precondition: the query is still in the address bar').toContain('email=placeholder');
      expect(clarityHits(log).map((e) => e.url)).toEqual([]);
      expect(await clarityState(page)).toEqual({ clarity: 'undefined', tag: 0, runtime: 0, scripts: 0 });
      expect(await clarityCookies(context)).toEqual([]);
      expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/placeholder|example\.test|untrusted|email=/);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

  test('DEV04 F2 control: with a working History API the same address is cleaned and Clarity loads exactly once', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context, 1);
    await page.goto('/connect/?email=placeholder%40example.test#untrusted');
    await expect.poll(() => vendorRequests(log).filter((u) => u.includes('k.clarity.ms/collect')).length, { timeout: 10000 }).toBe(1);
    await settle(page, 1500);
    expect(page.url()).toBe(ORIGIN + '/connect/');
    expect(vendorRequests(log).filter((u) => u === 'https://www.clarity.ms/tag/zabyszkk6y').length).toBe(1);
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/placeholder|example\.test|untrusted|email=/);
    await context.close();
  });

  test('DEV04 F3: allowed route with a query, same-origin hop, then Clarity opt-in: Clarity does not load and the stub never sees the query', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context, 0); // analytics only, so the query stays in the first address
    await page.goto('/services/websites/?email=placeholder%40example.test&phone=8435551234');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    await page.evaluate(() => { window.location.href = '/connect/'; });
    await page.waitForURL('**/connect/');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(2);
    expect(await page.evaluate(() => document.referrer), 'precondition: the same-origin referrer carries the query').toContain('email=placeholder');
    await optInViaBanner(page);
    expect(JSON.parse(await stored(page))).toMatchObject({ a: 1, c: 1 });
    await settle(page, 3000);
    expect(clarityHits(log).map((e) => e.url)).toEqual([]);
    expect(await clarityState(page)).toEqual({ clarity: 'undefined', tag: 0, runtime: 0, scripts: 0 });
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/placeholder|example\.test|8435551234|email=|phone=/);
    await context.close();
  });

  test('DEV04 F3: an external referrer with a path and query keeps Clarity off for that page load; GA4 gets only the origin', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await consentBeforeLoad(context, 1);
    await page.goto('/services/', { referer: 'https://www.example.com/search?q=john+smith+8435551234' });
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    expect(await page.evaluate(() => document.referrer), 'precondition: the page sees the full external referrer').toContain('search?q=');
    await settle(page, 5000);
    expect(clarityHits(log).map((e) => e.url)).toEqual([]);
    expect(events(log, 'page_view')[0].dr).toBe('https://www.example.com/');
    expect(decodeURIComponent(vendorRequests(log).join('\n'))).not.toMatch(/john|smith|8435551234|search\?q/i);
    await context.close();
  });

  for (const [label, go] of [
    ['a clean same-origin hop', async (page) => { await page.goto('/services/websites/'); await page.evaluate(() => { window.location.href = '/connect/'; }); await page.waitForURL('**/connect/'); }],
    ['a bare external origin', async (page) => { await page.goto('/connect/', { referer: 'https://www.example.com/' }); }],
    ['no referrer', async (page) => { await page.goto('/connect/'); }],
  ]) {
    test(`DEV04 F3 control: Clarity still loads exactly once after ${label}, and its stub sees only safe URLs`, async ({ browser }) => {
      const { context, page, log } = await setup(browser);
      await consentBeforeLoad(context, 1);
      await go(page);
      const connectHits = () => log.filter((e) => e.url.includes('k.clarity.ms/collect') && new URL(e.url).searchParams.get('u') === ORIGIN + '/connect/');
      await expect.poll(() => connectHits().length, { timeout: 10000 }).toBe(1);
      await settle(page, 1500);
      const onConnect = connectHits();
      expect(onConnect.length, 'one Clarity runtime on /connect/').toBe(1);
      expect([ '', ORIGIN + '/services/websites/', 'https://www.example.com/' ]).toContain(new URL(onConnect[0].url).searchParams.get('r'));
      await context.close();
    });
  }
});

test.describe('JavaScript disabled', () => {
  test('every contact and handoff link works with its real href; nothing third-party; footer choices link reaches the privacy section', async ({ browser }) => {
    const { context, page, log } = await setup(browser, { javaScriptEnabled: false });
    await page.goto('/connect/');
    for (const href of [/^sms:/, /^tel:/, /^mailto:/, /\.vcf/]) expect(await page.locator('a').evaluateAll((as, src) => as.filter((a) => new RegExp(src).test(a.getAttribute('href') ?? '')).length, href.source)).toBeGreaterThan(0);
    await page.goto('/discovery/');
    expect(await page.locator('a[data-ldw-placement="discovery_hero"]').getAttribute('href')).toBe('https://getaiform.com/r/LiY9XI9qKE');
    await page.locator('footer a[href="/privacy/#privacy-choices"]').click();
    await expect(page).toHaveURL(/\/privacy\/#privacy-choices$/);
    await expect(page.locator('#privacy-choices')).toBeVisible();
    await expect(page.locator('#ldw-consent')).toHaveCount(0);
    expect(vendorRequests(log)).toEqual([]);
    await context.close();
  });
});

const VIEWPORTS = [{ name: '360x780', width: 360, height: 780 }, { name: '390x844', width: 390, height: 844 }, { name: '1440x900', width: 1440, height: 900 }];
test.describe('banner UX', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: visible, inside the viewport, clear of the mobile contact bar, buttons >= 44px, axe-clean collapsed and expanded`, async ({ browser }) => {
      const { context, page } = await setup(browser, { viewport: { width: vp.width, height: vp.height } });
      await page.goto('/');
      const banner = page.locator('#ldw-consent');
      await expect(banner).toBeVisible();
      const measure = () => page.evaluate(() => {
        const b = document.querySelector('#ldw-consent').getBoundingClientRect();
        const bar = document.querySelector('.mobile-contact-bar');
        const barRect = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
        const btns = [...document.querySelectorAll('#ldw-consent button')].filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().height * 10) / 10);
        return { top: b.top, bottom: b.bottom, height: b.height, left: b.left, right: b.right, vh: innerHeight, vw: innerWidth, barTop: barRect ? barRect.top : null, minBtn: Math.min(...btns), overflowX: document.documentElement.scrollWidth - innerWidth };
      });
      const m1 = await measure();
      expect(m1.top).toBeGreaterThanOrEqual(0); expect(m1.bottom).toBeLessThanOrEqual(m1.vh); expect(m1.left).toBeGreaterThanOrEqual(0); expect(m1.right).toBeLessThanOrEqual(m1.vw);
      expect(m1.minBtn).toBeGreaterThanOrEqual(44);
      expect(m1.overflowX).toBeLessThanOrEqual(0);
      if (m1.barTop !== null) expect(m1.bottom, 'banner sits above the mobile contact bar').toBeLessThanOrEqual(m1.barTop - 4);
      expect(m1.height / m1.vh, 'collapsed banner share of the viewport').toBeLessThan(0.45);
      let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => v.id), 'collapsed').toEqual([]);
      await page.getByRole('button', { name: 'Preferences' }).click();
      const m2 = await measure();
      expect(m2.top).toBeGreaterThanOrEqual(0); expect(m2.bottom).toBeLessThanOrEqual(m2.vh);
      if (m2.barTop !== null) expect(m2.bottom).toBeLessThanOrEqual(m2.barTop - 4);
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => v.id), 'expanded').toEqual([]);
      // page content can always scroll clear of the banner (and the bar): last footer line ends above both
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(250);
      const foot = await page.evaluate(() => { const f = document.querySelector('.site-footer').getBoundingClientRect(); const b = document.querySelector('#ldw-consent').getBoundingClientRect(); return { footerBottom: f.bottom, bannerTop: b.top }; });
      expect(foot.footerBottom, 'footer is not trapped behind the banner').toBeLessThanOrEqual(foot.bannerTop + 1);
      if (process.env.ANALYTICS_EVIDENCE_DIR) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: path.join(process.env.ANALYTICS_EVIDENCE_DIR, `banner-${vp.name}-expanded.png`) });
        await page.getByRole('button', { name: 'Preferences' }).click();
        await page.screenshot({ path: path.join(process.env.ANALYTICS_EVIDENCE_DIR, `banner-${vp.name}-collapsed.png`) });
      }
      await context.close();
    });
  }

  test('keyboard: banner is first after the skip link, Tab order and Enter work, Escape (reopened) returns focus, status is announced', async ({ browser }) => {
    const { context, page, log } = await setup(browser);
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Privacy Notice', exact: true }).first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Reject all' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Accept all' })).toBeFocused();
    await page.keyboard.press('Tab');
    const prefs = page.getByRole('button', { name: 'Preferences' });
    await expect(prefs).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(prefs).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel(/Site analytics/)).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); // replay checkbox, then Save choices
    await page.getByRole('button', { name: 'Save choices' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ldw-consent')).toBeHidden();
    await expect(page.locator('#ldw-consent-status')).toHaveText('Privacy choices saved.');
    await expect.poll(() => events(log, 'page_view').length, { timeout: 10000 }).toBe(1);
    const opener = page.getByRole('link', { name: 'Privacy choices' });
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ldw-consent')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ldw-consent')).toBeHidden();
    await expect(opener).toBeFocused();
    await context.close();
  });
});
