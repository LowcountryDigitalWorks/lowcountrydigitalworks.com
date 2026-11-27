import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://lowcountrydigitalworks.com';
export const MIN_HSTS_MAX_AGE = 15_552_000;

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 750;
const SAFE_METHOD = 'GET';

const SAFE_DIAGNOSTIC_HEADER_VALUE_PATTERNS = Object.freeze({
  'cf-ray': /^[A-Fa-f0-9]{12,32}-[A-Za-z0-9]{3,8}$/,
  'cf-mitigated': /^challenge$/i,
  server: /^cloudflare$/i,
  'content-type': /^(?:text|application|image|font|audio|video|multipart|message)\/[A-Za-z0-9!#$&^_.+-]{1,80}(?:;\s*charset=[A-Za-z0-9._-]{1,40})?$/i,
  'retry-after': /^(?:\d{1,10}|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT)$/,
});
const SAFE_DIAGNOSTIC_HEADERS = Object.freeze(Object.keys(SAFE_DIAGNOSTIC_HEADER_VALUE_PATTERNS));

function sanitizeDiagnosticHeaderValue(name, rawValue) {
  const value = rawValue.trim().replace(/\s+/g, ' ');
  return SAFE_DIAGNOSTIC_HEADER_VALUE_PATTERNS[name]?.test(value) ? value : null;
}

export function formatResponseDiagnostics(response, requestUrl, { allowWww = false } = {}) {
  const target = assertSafeSmokeRequestUrl(requestUrl, { allowWww });
  const fields = ['path=' + target.pathname];

  for (const name of SAFE_DIAGNOSTIC_HEADERS) {
    const rawValue = response.headers.get(name);
    if (rawValue === null) continue;

    const value = sanitizeDiagnosticHeaderValue(name, rawValue);
    if (value !== null) {
      fields.push(name + '=' + value);
    }
  }

  return fields.join('; ');
}

export function assertExpectedStatus(response, expectedStatuses, requestUrl, message, options = {}) {
  const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (statuses.includes(response.status)) return;

  const expected = statuses.map(status => 'HTTP ' + status).join(' or ');
  const diagnostics = formatResponseDiagnostics(response, requestUrl, options);
  fail(message + ': expected ' + expected + ', received HTTP ' + response.status + ' [' + diagnostics + ']');
}
const USER_AGENT = 'LDW-Production-Smoke/1.0 (+https://lowcountrydigitalworks.com/)';

// Analytics (GA4 + GTM + Clarity) is OFF unless a release is built with ANALYTICS_ENABLED=1. After such a release, run the smoke with
// PRODUCTION_ANALYTICS_EXPECTED=1 so it asserts the ON state (analytics disclosure, extended CSP, loader tag) instead of the OFF state.
export const PRIVACY_MARKER_OFF = 'does not intentionally use advertising trackers, behavioral analytics, nonessential cookies';
export const PRIVACY_MARKER_ON = 'uses analytics and site-experience tools';
export const ANALYTICS_CSP_ORIGINS = ['googletagmanager.com', 'google-analytics.com', 'analytics.google.com', 'clarity.ms', 'c.bing.com'];
const analyticsExpected = process.env.PRODUCTION_ANALYTICS_EXPECTED === '1';

export function assertAnalyticsCsp(csp, expected) {
  const has = (origin) => csp.includes(origin);
  if (!expected) {
    for (const origin of ANALYTICS_CSP_ORIGINS) assert.ok(!has(origin), 'analytics OFF: CSP must not allow ' + origin);
  } else {
    for (const origin of ANALYTICS_CSP_ORIGINS) assert.ok(has(origin), 'analytics ON: CSP must allow ' + origin);
    assert.match(csp, /script-src\s+'self'[^;]*https:\/\/www\.googletagmanager\.com/i, 'analytics ON: script-src must allow GTM/gtag');
  }
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline/i, 'CSP must never allow unsafe-eval or unsafe-inline');
  assert.doesNotMatch(csp, /frame-src/i, 'CSP must not add frame-src (no GTM noscript iframe)');
}

export function assertAnalyticsHtml(html, expected) {
  const tags = html.match(/<script\b[^>]*\bsrc="\/ldw-analytics\.js"[^>]*>/g) ?? [];
  assert.equal(tags.length, expected ? 1 : 0, 'analytics loader tag count (expected ' + (expected ? 1 : 0) + ')');
}

// L3: the live loader must carry exactly the two production hosts (a stray test-only host override would add more) and a non-empty
// route allowlist with no private route, 404 page or /other/ entry (M1).
export const PRODUCTION_ANALYTICS_HOSTS = ['lowcountrydigitalworks.com', 'www.lowcountrydigitalworks.com'];
export function assertAnalyticsLoader(js) {
  const hosts = js.match(/var HOSTS = (\[[^\]]*\]);/);
  assert.ok(hosts, 'analytics loader: HOSTS list not found');
  assert.deepEqual(JSON.parse(hosts[1]), PRODUCTION_ANALYTICS_HOSTS, 'analytics loader: HOSTS must be exactly the production hosts');
  const routes = js.match(/var ROUTES = (\[[^\]]*\]);/);
  assert.ok(routes, 'analytics loader: ROUTES allowlist not found');
  const list = JSON.parse(routes[1]);
  assert.ok(list.includes('/') && list.length > 1, 'analytics loader: ROUTES allowlist must list the built pages');
  assert.ok(list.every((r) => /^\/(?:[a-z0-9-]+\/)*$/.test(r) && r !== '/other/' && !/^\/(share|admin|api)(\/|$)|404/.test(r)), 'analytics loader: ROUTES has a private, 404 or malformed entry');
  return { hosts: PRODUCTION_ANALYTICS_HOSTS.length, routes: list.length };
}

const routeChecks = [
  ['/', 'Your website should bring in calls, not questions.'],
  ['/services/', 'Start with what your business needs to work better.'],
  ['/services/business-systems-automation/', null],
  ['/services/website-care/', null],
  ['/work/', 'See the problem, the proof, and the boundary.'],
  ['/work/gas-engine/', 'Internal evidence infrastructure'],
  ['/about/', 'Local, practical, and accountable by design.'],
  ['/connect/', 'Tell me what is getting in the way.'],
  ['/privacy/', analyticsExpected ? PRIVACY_MARKER_ON : PRIVACY_MARKER_OFF],
];

function fail(message) {
  throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCanonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const canonicalTag = tags.find(tag => /\brel=["']canonical["']/i.test(tag));
  if (!canonicalTag) return null;
  const match = canonicalTag.match(/\bhref=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

// The Website Care plans preview (#care-options) must never reach the live site: no preview marker, plans markup, price cards or loader.
export function assertNoCarePreview(html, label = 'page') {
  assert.ok(!html.includes('data-care-options-preview'), label + ' must not contain the Website Care preview marker [data-care-options-preview]');
  assert.doesNotMatch(html, /id="care-options"|care-carousel|class="care-tier|care-concept-bridge/, label + ' must not contain Website Care plans preview markup');
}

export function assertHtmlPage(html, canonicalUrl, marker = null) {
  assert.match(html, /<h1\b/i, 'HTML page must contain an h1');
  assert.equal(getCanonicalHref(html), canonicalUrl, 'canonical URL must match accepted production identity');
  if (marker) {
    assert.ok(html.includes(marker), 'expected stable marker not found: ' + marker);
  }
}

export function parseHstsMaxAge(value) {
  const match = value.match(/(?:^|;)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function assertSecurityHeaders(headers, { analytics = analyticsExpected } = {}) {
  const csp = headers.get('content-security-policy') ?? '';
  assert.ok(csp, 'Content-Security-Policy header must be present');
  assertAnalyticsCsp(csp, analytics);
  assert.match(csp, /default-src\s+'self'/i, 'CSP must retain default-src self');
  assert.match(csp, /frame-ancestors\s+'none'/i, 'CSP must retain frame-ancestors none');

  const hsts = headers.get('strict-transport-security') ?? '';
  assert.ok(hsts, 'Strict-Transport-Security header must be present');
  const maxAge = parseHstsMaxAge(hsts);
  assert.ok(Number.isInteger(maxAge), 'HSTS must contain an integer max-age');
  assert.ok(
    maxAge >= MIN_HSTS_MAX_AGE,
    'HSTS max-age regressed below accepted 6-month Cloudflare baseline: ' + maxAge,
  );
  assert.doesNotMatch(hsts, /includeSubDomains/i, 'includeSubDomains must remain off unless separately approved');
  assert.doesNotMatch(hsts, /(?:^|;)\s*preload(?:;|$)/i, 'HSTS preload must remain off unless separately approved');

  assert.equal(
    headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
    'Referrer-Policy must match accepted production baseline',
  );
  assert.equal(
    headers.get('x-content-type-options'),
    'nosniff',
    'X-Content-Type-Options must remain nosniff',
  );
  assert.equal(headers.get('x-frame-options'), 'DENY', 'X-Frame-Options must remain DENY');
  assert.equal(
    headers.get('cross-origin-opener-policy'),
    'same-origin',
    'Cross-Origin-Opener-Policy must remain same-origin',
  );

  const permissions = headers.get('permissions-policy') ?? '';
  for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
    assert.ok(permissions.includes(directive), 'Permissions-Policy missing accepted directive: ' + directive);
  }

  return { maxAge };
}

export function assertRobots(text) {
  assert.ok(
    text.includes('Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference'),
    'robots.txt must retain approved Content-Signal policy',
  );
  assert.ok(
    text.includes('User-agent: GPTBot\nDisallow: /'),
    'robots.txt must retain GPTBot training-crawl block',
  );
  assert.ok(
    text.includes('Sitemap: https://lowcountrydigitalworks.com/sitemap.xml'),
    'robots.txt must retain production sitemap',
  );
  assert.ok(
    !text.includes('User-agent: OAI-SearchBot\nDisallow:'),
    'robots.txt must not block OAI-SearchBot without a separate decision',
  );
  assert.ok(
    !text.includes('User-agent: Google-Extended\nDisallow:'),
    'robots.txt must not block Google-Extended without a separate decision',
  );
}

export function parseSitemapLocations(text) {
  const locations = new Map();
  for (const match of text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const url = new URL(match[1].trim());
    assert.equal(url.origin, PRODUCTION_ORIGIN, 'sitemap locations must use canonical production origin');
    assert.equal(url.search, '', 'sitemap locations must not contain query parameters');
    assert.equal(url.hash, '', 'sitemap locations must not contain fragments');
    locations.set(url.href, url);
  }
  assert.ok(locations.size > 0, 'sitemap must contain at least one valid location');
  return locations;
}

export function assertSitemap(text) {
  const locations = parseSitemapLocations(text);
  const requiredPaths = [
    '/connect/',
    '/guides/',
    '/guides/website-maintenance-after-launch/',
    '/guides/website-ownership-handoff/',
    '/services/business-systems-automation/',
    '/work/gas-engine/',
  ];
  for (const path of requiredPaths) {
    const url = new URL(path, PRODUCTION_ORIGIN).href;
    assert.ok(locations.has(url), 'sitemap missing accepted URL: ' + url);
  }

  const legacyContact = new URL('/contact/', PRODUCTION_ORIGIN).href;
  assert.ok(!locations.has(legacyContact), 'legacy Contact must remain excluded from sitemap');

  const exposesSecureShare = [...locations.values()].some(url =>
    url.pathname === '/share' || url.pathname.startsWith('/share/'),
  );
  assert.ok(!exposesSecureShare, 'Secure Share must remain excluded from sitemap');
}

export function assertWwwBehavior({ status, location, body }) {
  if ([301, 302, 307, 308].includes(status)) {
    assert.ok(location, 'www redirect must include a Location header');
    const target = new URL(location, 'https://www.lowcountrydigitalworks.com/');
    assert.equal(target.origin, PRODUCTION_ORIGIN, 'www redirect must target canonical apex origin');
    assert.equal(target.pathname, '/', 'www home redirect must target canonical home path');
    return 'redirect';
  }

  assert.equal(status, 200, 'www must either redirect to apex or serve a canonicalized 200 response');
  assert.equal(
    getCanonicalHref(body),
    PRODUCTION_ORIGIN + '/',
    'www 200 response must canonicalize to apex',
  );
  return 'canonical-200';
}

export function assertSafeSmokeRequestUrl(value, { allowWww = false } = {}) {
  const target = value instanceof URL ? value : new URL(value);
  const allowedOrigins = allowWww
    ? new Set([PRODUCTION_ORIGIN, 'https://www.lowcountrydigitalworks.com'])
    : new Set([PRODUCTION_ORIGIN]);

  assert.ok(
    allowedOrigins.has(target.origin),
    'production smoke request escaped approved origin: ' + target.origin,
  );
  assert.equal(target.username, '', 'production smoke requests must not include URL credentials');
  assert.equal(target.password, '', 'production smoke requests must not include URL credentials');

  if (target.pathname === '/share/continue' || target.pathname.startsWith('/share/continue/')) {
    fail('production smoke must never request /share/continue');
  }

  return target;
}

export async function fetchWithRetry(
  url,
  { allowWww = false, fetchImpl = fetch } = {},
) {
  const target = assertSafeSmokeRequestUrl(url, { allowWww });
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(target, {
        method: SAFE_METHOD,
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status >= 500 && attempt === 1) {
        await response.body?.cancel();
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    }
  }

  throw lastError ?? new Error('request failed without a response');
}

function assertContentType(response, expected) {
  const contentType = response.headers.get('content-type') ?? '';
  assert.ok(
    contentType.toLowerCase().includes(expected.toLowerCase()),
    'unexpected content-type for ' + response.url + ': ' + contentType,
  );
}

async function writeGithubSummary(results) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;

  const lines = [
    '## LDW production smoke',
    '',
    '- Target: ' + PRODUCTION_ORIGIN,
    '- Method boundary: GET only; no authentication; Secure Share external transition not requested',
    '',
    '| Check | Result |',
    '| --- | --- |',
    ...results.map(item => '| ' + item.name + ' | ' + item.detail + ' |'),
    '',
  ];
  await appendFile(target, lines.join('\n'), 'utf8');
}

export async function runProductionSmoke() {
  const configured = new URL(process.env.PRODUCTION_BASE_URL ?? PRODUCTION_ORIGIN);
  if (configured.origin !== PRODUCTION_ORIGIN || configured.pathname !== '/') {
    fail('production smoke target is fixed to ' + PRODUCTION_ORIGIN + ' and cannot scan arbitrary URLs');
  }

  const results = [];
  const routeResponses = new Map();

  for (const [path, marker] of routeChecks) {
    const url = new URL(path, configured);
    const response = await fetchWithRetry(url);
    assertExpectedStatus(response, 200, url, path + ' must return HTTP 200');
    assertContentType(response, 'text/html');
    const body = await response.text();
    assertHtmlPage(body, new URL(path, configured).href, marker);
    assertNoCarePreview(body, path);
    assertAnalyticsHtml(body, analyticsExpected);
    if (path === '/privacy/') {
      if (analyticsExpected) assert.ok(!body.includes(PRIVACY_MARKER_OFF), 'analytics ON: privacy page must not keep the no-analytics sentence');
      else assert.ok(!body.includes(PRIVACY_MARKER_ON), 'analytics OFF: privacy page must not claim analytics');
    }
    routeResponses.set(path, { response, body });
    results.push({ name: path, detail: 'HTTP 200 + canonical/structure' });
  }

  if (analyticsExpected) {
    const loaderUrl = new URL('/ldw-analytics.js', configured);
    const loader = await fetchWithRetry(loaderUrl);
    assertExpectedStatus(loader, 200, loaderUrl, '/ldw-analytics.js must return HTTP 200 when analytics is expected');
    const counts = assertAnalyticsLoader(await loader.text());
    results.push({ name: '/ldw-analytics.js', detail: `HOSTS = ${counts.hosts} production hosts, ROUTES = ${counts.routes}` });
  }

  const home = routeResponses.get('/');
  const security = assertSecurityHeaders(home.response.headers);
  results.push({ name: 'security headers', detail: 'accepted controls; HSTS max-age=' + security.maxAge });

  const shareResponse = await fetchWithRetry(new URL('/share/', configured));
  assertExpectedStatus(shareResponse, 200, new URL('/share/', configured), '/share/ must return HTTP 200');
  assertContentType(shareResponse, 'text/html');
  const shareBody = await shareResponse.text();
  assertHtmlPage(shareBody, PRODUCTION_ORIGIN + '/share/', 'Share requested sensitive information.');
  assert.match(
    shareBody,
    /<meta\b[^>]*name=["']robots["'][^>]*content=["']noindex,noarchive["'][^>]*>/i,
    'Secure Share must retain noindex,noarchive',
  );
  assert.ok(
    shareBody.includes('href="/share/continue"'),
    'Secure Share must retain fixed same-origin transition CTA',
  );
  results.push({ name: '/share/', detail: 'HTTP 200 + noindex + fixed same-origin CTA' });

  const robotsResponse = await fetchWithRetry(new URL('/robots.txt', configured));
  assertExpectedStatus(robotsResponse, 200, new URL('/robots.txt', configured), '/robots.txt must return HTTP 200');
  assertContentType(robotsResponse, 'text/plain');
  const robots = await robotsResponse.text();
  assertRobots(robots);
  results.push({ name: '/robots.txt', detail: 'approved search/AI policy' });

  const sitemapResponse = await fetchWithRetry(new URL('/sitemap.xml', configured));
  assertExpectedStatus(sitemapResponse, 200, new URL('/sitemap.xml', configured), '/sitemap.xml must return HTTP 200');
  const sitemap = await sitemapResponse.text();
  assertSitemap(sitemap);
  results.push({ name: '/sitemap.xml', detail: 'accepted public routes' });

  const vcardResponse = await fetchWithRetry(new URL('/eddie-gugino-lowcountry-digital-works.vcf', configured));
  assertExpectedStatus(vcardResponse, 200, new URL('/eddie-gugino-lowcountry-digital-works.vcf', configured), 'vCard must return HTTP 200');
  const vcard = await vcardResponse.text();
  assert.ok(vcard.includes('FN:Eddie Gugino'), 'vCard must retain Eddie Gugino identity');
  results.push({ name: 'vCard', detail: 'HTTP 200 + expected identity' });

  const portraitResponse = await fetchWithRetry(new URL('/founder/eddie-gugino-founder.webp', configured));
  assertExpectedStatus(portraitResponse, 200, new URL('/founder/eddie-gugino-founder.webp', configured), 'founder portrait must return HTTP 200');
  assertContentType(portraitResponse, 'image/webp');
  await portraitResponse.body?.cancel();
  results.push({ name: 'founder portrait', detail: 'HTTP 200 image/webp' });

  const missingResponse = await fetchWithRetry(new URL('/__ldw-production-smoke-missing__', configured));
  assertExpectedStatus(missingResponse, 404, new URL('/__ldw-production-smoke-missing__', configured), 'definitely-missing route must return HTTP 404');
  await missingResponse.body?.cancel();
  results.push({ name: '404 behavior', detail: 'expected HTTP 404' });

  const wwwUrl = 'https://www.lowcountrydigitalworks.com/';
  const wwwResponse = await fetchWithRetry(wwwUrl, { allowWww: true });
  assertExpectedStatus(wwwResponse, [200, 301, 302, 307, 308], wwwUrl, 'www must return an accepted response', { allowWww: true });
  const wwwBody = wwwResponse.status === 200 ? await wwwResponse.text() : '';
  const wwwMode = assertWwwBehavior({
    status: wwwResponse.status,
    location: wwwResponse.headers.get('location'),
    body: wwwBody,
  });
  results.push({ name: 'www behavior', detail: wwwMode });

  await writeGithubSummary(results);
  return results;
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  runProductionSmoke()
    .then(results => {
      for (const result of results) {
        console.log('[PASS] ' + result.name + ' — ' + result.detail);
      }
      console.log('Production smoke passed: ' + results.length + ' checks.');
    })
    .catch(error => {
      console.error('[FAIL] Production smoke failed.');
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
