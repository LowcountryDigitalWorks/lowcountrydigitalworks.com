import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://lowcountrydigitalworks.com';
export const MIN_HSTS_MAX_AGE = 15_552_000;

const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 750;
const SAFE_METHOD = 'GET';
const USER_AGENT = 'LDW-Production-Smoke/1.0 (+https://lowcountrydigitalworks.com/)';

const routeChecks = [
  ['/', 'Websites and business systems that make work easier.'],
  ['/services/', 'Start with what your business needs to work better.'],
  ['/services/business-systems-automation/', null],
  ['/work/', 'See the problem, the proof, and the boundary.'],
  ['/work/gas-engine/', 'Internal evidence infrastructure'],
  ['/about/', 'Local, practical, and accountable by design.'],
  ['/connect/', 'Tell me what is getting in the way.'],
  ['/privacy/', 'does not intentionally set nonessential cookies'],
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

export function assertSecurityHeaders(headers) {
  const csp = headers.get('content-security-policy') ?? '';
  assert.ok(csp, 'Content-Security-Policy header must be present');
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

export function assertSitemap(text) {
  const required = [
    'https://lowcountrydigitalworks.com/connect/',
    'https://lowcountrydigitalworks.com/guides/',
    'https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/',
    'https://lowcountrydigitalworks.com/guides/website-ownership-handoff/',
    'https://lowcountrydigitalworks.com/services/business-systems-automation/',
    'https://lowcountrydigitalworks.com/work/gas-engine/',
  ];
  for (const url of required) {
    assert.ok(text.includes(url), 'sitemap missing accepted URL: ' + url);
  }
  assert.ok(
    !text.includes('https://lowcountrydigitalworks.com/contact/'),
    'legacy Contact must remain excluded from sitemap',
  );
  assert.ok(
    !text.includes('https://lowcountrydigitalworks.com/share'),
    'Secure Share must remain excluded from sitemap',
  );
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

async function fetchWithRetry(url, { redirect = 'follow' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: SAFE_METHOD,
        redirect,
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
    assert.equal(response.status, 200, path + ' must return HTTP 200');
    assertContentType(response, 'text/html');
    const body = await response.text();
    assertHtmlPage(body, new URL(path, configured).href, marker);
    routeResponses.set(path, { response, body });
    results.push({ name: path, detail: 'HTTP 200 + canonical/structure' });
  }

  const home = routeResponses.get('/');
  const security = assertSecurityHeaders(home.response.headers);
  results.push({ name: 'security headers', detail: 'accepted controls; HSTS max-age=' + security.maxAge });

  const shareResponse = await fetchWithRetry(new URL('/share/', configured));
  assert.equal(shareResponse.status, 200, '/share/ must return HTTP 200');
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
  assert.equal(robotsResponse.status, 200, '/robots.txt must return HTTP 200');
  assertContentType(robotsResponse, 'text/plain');
  const robots = await robotsResponse.text();
  assertRobots(robots);
  results.push({ name: '/robots.txt', detail: 'approved search/AI policy' });

  const sitemapResponse = await fetchWithRetry(new URL('/sitemap.xml', configured));
  assert.equal(sitemapResponse.status, 200, '/sitemap.xml must return HTTP 200');
  const sitemap = await sitemapResponse.text();
  assertSitemap(sitemap);
  results.push({ name: '/sitemap.xml', detail: 'accepted public routes' });

  const vcardResponse = await fetchWithRetry(new URL('/eddie-gugino-lowcountry-digital-works.vcf', configured));
  assert.equal(vcardResponse.status, 200, 'vCard must return HTTP 200');
  const vcard = await vcardResponse.text();
  assert.ok(vcard.includes('FN:Eddie Gugino'), 'vCard must retain Eddie Gugino identity');
  results.push({ name: 'vCard', detail: 'HTTP 200 + expected identity' });

  const portraitResponse = await fetchWithRetry(new URL('/founder/eddie-gugino-founder.webp', configured));
  assert.equal(portraitResponse.status, 200, 'founder portrait must return HTTP 200');
  assertContentType(portraitResponse, 'image/webp');
  await portraitResponse.body?.cancel();
  results.push({ name: 'founder portrait', detail: 'HTTP 200 image/webp' });

  const missingResponse = await fetchWithRetry(new URL('/__ldw-production-smoke-missing__', configured));
  assert.equal(missingResponse.status, 404, 'definitely-missing route must return HTTP 404');
  await missingResponse.body?.cancel();
  results.push({ name: '404 behavior', detail: 'expected HTTP 404' });

  const wwwResponse = await fetchWithRetry('https://www.lowcountrydigitalworks.com/', { redirect: 'manual' });
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
