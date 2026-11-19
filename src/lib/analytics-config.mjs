// Analytics source-only kit: ONE module for the build-time gate, the approved tracker IDs/origins and the CSP extension.
// Imported by astro.config.mjs (loader emit + dist/_headers rewrite), src/layouts/BaseLayout.astro, src/pages/privacy.astro and the tests.
// Default OFF. ON only when ANALYTICS_ENABLED === '1' at BUILD time. Even when ON, the loader only runs on the production hostnames (see ANALYTICS_HOSTS).
export const GA4_ID = 'G-127KLSQHRB';
export const GTM_ID = 'GTM-WZJ8HHKK';
export const CLARITY_ID = 'zabyszkk6y';

// Runtime hostname allowlist baked into the emitted loader. workers.dev, previews and localhost are not in it.
export const ANALYTICS_HOSTS = ['lowcountrydigitalworks.com', 'www.lowcountrydigitalworks.com'];

// Private/secure routes: no loader tag, no banner, no events, ever (the loader also checks this list at runtime; a test pins both copies together).
export const ANALYTICS_EXCLUDED_PREFIXES = ['/share', '/admin', '/api'];
export function analyticsRouteAllowed(pathname) {
  const p = String(pathname).toLowerCase();
  return !ANALYTICS_EXCLUDED_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));
}

// Every origin added to the CSP, with the reason. Nothing is added to default-src, style-src, font-src or frame-src;
// no 'unsafe-inline' / 'unsafe-eval' / wildcard-TLD / bare-scheme sources.
export const CSP_ADDITIONS = {
  'script-src': [
    'https://www.googletagmanager.com', // gtag.js (GA4) and gtm.js (GTM container)
    'https://www.clarity.ms', // Clarity tag loader /tag/<id>
    'https://scripts.clarity.ms', // Clarity runtime (clarity.js); missing from older Clarity docs but required
  ],
  'connect-src': [
    'https://www.googletagmanager.com', // GTM/gtag config + collect
    'https://*.google-analytics.com', // GA4 collect (www., region1., ...)
    'https://*.analytics.google.com', // GA4 regional collect endpoints
    'https://www.google.com', // GA4 collect fallback / ccm endpoint
    'https://*.clarity.ms', // Clarity collect (a-z.clarity.ms load-balanced)
    'https://c.bing.com', // Clarity cookie/sync endpoint
  ],
  'img-src': [
    'https://www.googletagmanager.com', // GTM/gtag pixel fallbacks
    'https://*.google-analytics.com', // GA4 image beacon fallback
    'https://*.clarity.ms', // Clarity c.gif beacon
    'https://c.bing.com', // Clarity sync pixel
  ],
};

const evaluate = (env) => env.ANALYTICS_ENABLED === '1';
// Read once (by astro.config.mjs, before Astro loads any .env into process.env) and pinned, so config, pages and the privacy copy cannot disagree.
const PIN = Symbol.for('ldw.analytics-gate');
export function analyticsEnabled(env = process.env) {
  if (env !== process.env) return evaluate(env);
  if (!(PIN in globalThis)) globalThis[PIN] = evaluate(process.env);
  return globalThis[PIN];
}

// Test-only: extra hostnames baked into a BUILD (never a runtime override). Honoured only when ANALYTICS_ENABLED=1 AND ANALYTICS_TEST_BUILD=1.
// Used for the local network-log evidence run with all requests intercepted. A stray ANALYTICS_TEST_EXTRA_HOSTS without the explicit
// ANALYTICS_TEST_BUILD=1 marker fails the build (assertNoStrayTestHosts, called at config load), so a release build cannot carry it.
export function analyticsTestHosts(env = process.env) {
  return String(env.ANALYTICS_TEST_EXTRA_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
}
export function assertNoStrayTestHosts(env = process.env) {
  const extra = analyticsTestHosts(env);
  if (extra.length && env.ANALYTICS_TEST_BUILD !== '1') {
    throw new Error(`[ldw-analytics] ANALYTICS_TEST_EXTRA_HOSTS is set (${extra.join(', ')}) without ANALYTICS_TEST_BUILD=1. Refusing to build: unset it for a release build.`);
  }
}
export function analyticsHosts(env = process.env) {
  const extra = evaluate(env) && env.ANALYTICS_TEST_BUILD === '1' ? analyticsTestHosts(env) : [];
  return [...ANALYTICS_HOSTS, ...extra];
}

// Route allowlist baked into the loader (M1): the public routes this build actually emitted (dist/**/index.html), canonical trailing-slash form.
// Any other path (404s, typed or crafted URLs such as /contact/foo@bar.com) is reported as OTHER_ROUTE in page_location, page_path and the
// same-origin page_referrer, so no visitor-supplied path segment ever reaches GA4. 404.html and excluded private routes are never listed.
export const OTHER_ROUTE = '/other/';
export function analyticsRoutes(htmlFiles) {
  const routes = new Set();
  for (const raw of htmlFiles) {
    const f = String(raw).replaceAll('\\', '/').replace(/^\/+/, '');
    if (f !== 'index.html' && !f.endsWith('/index.html')) continue;
    const route = '/' + f.slice(0, -'index.html'.length);
    if (!/^\/(?:[a-z0-9-]+\/)*$/.test(route)) throw new Error('analytics route allowlist: unexpected route shape ' + route);
    if (analyticsRouteAllowed(route)) routes.add(route);
  }
  if (!routes.has('/')) throw new Error('analytics route allowlist: build emitted no home page');
  return [...routes].sort();
}

// Referrer on /other/ pages (r3, closes the L1 Clarity document.referrer gap): every built page that the loader reports as /other/ (in practice
// 404.html, which also answers every unknown route) carries <meta name="referrer" content="origin">. A navigation from a visitor-typed path such as
// /contact/foo@bar.com to an allowlisted page then exposes only the origin in document.referrer (and the Referer header), so a tool that reads
// document.referrer itself (Clarity) never sees the raw path. Static markup only: no inline script, CSP unchanged. Private routes load nothing and are left alone.
export const OTHER_REFERRER_META = '<meta name="referrer" content="origin">';
export function otherRoutePages(htmlFiles, routes) {
  const allow = new Set(routes);
  const out = [];
  for (const raw of htmlFiles) {
    const f = String(raw).replaceAll('\\', '/').replace(/^\/+/, '');
    if (!f.endsWith('.html')) continue;
    const isIndex = f === 'index.html' || f.endsWith('/index.html');
    const route = '/' + (isIndex ? f.slice(0, -'index.html'.length) : f);
    if (!analyticsRouteAllowed(route)) continue;
    if (isIndex && allow.has(route)) continue;
    out.push(f);
  }
  return out.sort();
}
export function addOtherReferrerMeta(html) {
  if (/<meta\s+name=["']?referrer/i.test(html)) throw new Error('page already declares a referrer policy');
  const m = html.match(/<meta charset=["']?utf-8["']?\s*\/?>/i) ?? html.match(/<head[^>]*>/i);
  if (!m) throw new Error('page has no <head> to carry the referrer meta');
  const at = m.index + m[0].length;
  return html.slice(0, at) + OTHER_REFERRER_META + html.slice(at);
}

export function extendCsp(policy, additions = CSP_ADDITIONS) {
  let out = policy;
  for (const [directive, origins] of Object.entries(additions)) {
    const re = new RegExp(`(^|;)(\\s*${directive}\\s+)([^;]*)`, 'i');
    const m = out.match(re);
    if (!m) throw new Error(`CSP has no ${directive} directive to extend`);
    if (origins.some((o) => m[3].includes(o))) throw new Error(`CSP ${directive} already contains an analytics origin`);
    out = out.replace(re, (_all, lead, name, value) => `${lead}${name}${value.trimEnd()} ${origins.join(' ')}`);
  }
  return out;
}

export function extendHeadersFile(text) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^\s+Content-Security-Policy:/.test(l));
  if (i < 0) throw new Error('_headers has no Content-Security-Policy line');
  const m = lines[i].match(/^(\s+Content-Security-Policy:\s*)(.*)$/);
  lines[i] = m[1] + extendCsp(m[2]);
  return lines.join('\n');
}

// Inert event hooks for real anchors: spread into an <a> (`<a href=... {...ldw('contact_method_click', { method: 'sms', placement: 'footer' })}>`).
// Returns NOTHING unless ANALYTICS_ENABLED=1, so a default (OFF) build is byte-identical to the base site. The adapter re-validates every value at click time.
export function ldw(event, { method, service, placement }) {
  if (!analyticsEnabled()) return {};
  const attrs = { 'data-ldw-event': event };
  if (method) attrs['data-ldw-method'] = method;
  if (service) attrs['data-ldw-service'] = service;
  attrs['data-ldw-placement'] = placement;
  return attrs;
}
