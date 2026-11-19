import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MIN_HSTS_MAX_AGE,
  ANALYTICS_CSP_ORIGINS,
  assertAnalyticsCsp,
  assertAnalyticsHtml,
  assertAnalyticsLoader,
  assertExpectedStatus,
  formatResponseDiagnostics,
  PRODUCTION_ORIGIN,
  assertNoCarePreview,
  assertRobots,
  assertSecurityHeaders,
  assertSitemap,
  assertWwwBehavior,
  fetchWithRetry,
  parseHstsMaxAge,
} from '../scripts/production-smoke.mjs';

function acceptedHeaders(hsts = 'max-age=' + MIN_HSTS_MAX_AGE) {
  return new Headers({
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; script-src 'self' 'nonce-test'",
    'strict-transport-security': hsts,
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
}

test('public policy keeps discovery as a first-party link and blocks external embedding', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const csp = headers.match(/Content-Security-Policy:\s*([^\r\n]+)/i)?.[1] ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /frame-src|frame-ancestors[^;]*getaiform\.com|getaiform\.com/i);
});

test('accepted production security headers pass', () => {
  const result = assertSecurityHeaders(acceptedHeaders(), { analytics: false });
  assert.equal(result.maxAge, MIN_HSTS_MAX_AGE);
});

test('security headers fail closed when HSTS max-age regresses', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=2592000'), { analytics: false }),
    /HSTS max-age regressed below accepted 6-month Cloudflare baseline/,
  );
});

test('security headers fail closed if includeSubDomains or preload appears without approval', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; includeSubDomains'), { analytics: false }),
    /includeSubDomains must remain off/,
  );
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; preload'), { analytics: false }),
    /HSTS preload must remain off/,
  );
});

test('HSTS parser accepts current Cloudflare six-month value', () => {
  assert.equal(parseHstsMaxAge('max-age=15552000'), 15_552_000);
});

test('robots policy preserves search and AI answer visibility while reserving training', () => {
  const robots = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'Sitemap: https://lowcountrydigitalworks.com/sitemap.xml',
  ].join('\n');
  assert.doesNotThrow(() => assertRobots(robots));
});

test('robots policy rejects accidental OAI-SearchBot block', () => {
  const robots = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no, use=reference',
    'Allow: /',
    'User-agent: GPTBot',
    'Disallow: /',
    'User-agent: OAI-SearchBot',
    'Disallow: /',
    'Sitemap: https://lowcountrydigitalworks.com/sitemap.xml',
  ].join('\n');
  assert.throws(() => assertRobots(robots), /must not block OAI-SearchBot/);
});

test('sitemap accepts exact canonical locations and rejects Secure Share exposure', () => {
  const required = [
    'https://lowcountrydigitalworks.com/connect/',
    'https://lowcountrydigitalworks.com/guides/',
    'https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/',
    'https://lowcountrydigitalworks.com/guides/website-ownership-handoff/',
    'https://lowcountrydigitalworks.com/services/business-systems-automation/',
    'https://lowcountrydigitalworks.com/work/gas-engine/',
  ];

  const sitemap = locations =>
    '<urlset>' + locations.map(url => '<url><loc>' + url + '</loc></url>').join('') + '</urlset>';

  assert.doesNotThrow(() => assertSitemap(sitemap(required)));
  assert.throws(
    () => assertSitemap(sitemap([...required, 'https://lowcountrydigitalworks.com/share/'])),
    /Secure Share/,
  );
});

test('sitemap rejects external origins even when an LDW URL appears as a substring', () => {
  const required = [
    'https://lowcountrydigitalworks.com/connect/',
    'https://lowcountrydigitalworks.com/guides/',
    'https://lowcountrydigitalworks.com/guides/website-maintenance-after-launch/',
    'https://lowcountrydigitalworks.com/guides/website-ownership-handoff/',
    'https://lowcountrydigitalworks.com/services/business-systems-automation/',
    'https://lowcountrydigitalworks.com/work/gas-engine/',
  ];
  const malicious =
    'https://example.com/?next=https://lowcountrydigitalworks.com/share/';
  const xml =
    '<urlset>' +
    [...required, malicious].map(url => '<url><loc>' + url + '</loc></url>').join('') +
    '</urlset>';

  assert.throws(() => assertSitemap(xml), /canonical production origin/);
});

test('www behavior accepts either apex redirect or canonicalized 200', () => {
  assert.equal(
    assertWwwBehavior({
      status: 301,
      location: PRODUCTION_ORIGIN + '/',
      body: '',
    }),
    'redirect',
  );

  assert.equal(
    assertWwwBehavior({
      status: 200,
      location: null,
      body: '<html><head><link rel="canonical" href="' + PRODUCTION_ORIGIN + '/"></head><body></body></html>',
    }),
    'canonical-200',
  );
});

test('www behavior rejects redirect to an unrelated host', () => {
  assert.throws(
    () => assertWwwBehavior({ status: 302, location: 'https://example.com/', body: '' }),
    /www redirect must target canonical apex origin/,
  );
});


test('ordinary production fetches use manual redirects and never auto-follow an external Location', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url: url.href, redirect: options.redirect });
    return new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/escape' },
    });
  };

  const response = await fetchWithRetry(
    new URL('/services/', PRODUCTION_ORIGIN),
    { fetchImpl: fakeFetch },
  );

  assert.equal(response.status, 302);
  assert.deepEqual(calls, [
    {
      url: 'https://lowcountrydigitalworks.com/services/',
      redirect: 'manual',
    },
  ]);
});

test('production fetch rejects Secure Share transition before any network request', async () => {
  let networkCalls = 0;
  const fakeFetch = async () => {
    networkCalls += 1;
    return new Response('unexpected', { status: 200 });
  };

  await assert.rejects(
    () => fetchWithRetry(
      new URL('/share/continue', PRODUCTION_ORIGIN),
      { fetchImpl: fakeFetch },
    ),
    /must never request \/share\/continue/,
  );

  assert.equal(networkCalls, 0);
});

test('production fetch rejects direct external origins before any network request', async () => {
  let networkCalls = 0;
  const fakeFetch = async () => {
    networkCalls += 1;
    return new Response('unexpected', { status: 200 });
  };

  await assert.rejects(
    () => fetchWithRetry('https://example.com/escape', { fetchImpl: fakeFetch }),
    /escaped approved origin/,
  );

  assert.equal(networkCalls, 0);
});


test('unexpected status reports only a sanitized path and allowlisted response metadata', () => {
  const response = new Response('PRIVATE_RESPONSE_BODY', {
    status: 403,
    headers: {
      'cf-ray': 'abc123def4567890-LAX',
      'cf-mitigated': 'challenge',
      server: 'cloudflare',
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '30',
      authorization: 'Bearer PRIVATE_AUTH',
      'set-cookie': 'session=PRIVATE_COOKIE',
      'x-private-header': 'PRIVATE_HEADER',
    },
  });
  const requestUrl = new URL('/?token=PRIVATE_QUERY#PRIVATE_FRAGMENT', PRODUCTION_ORIGIN);
  let message = '';
  try {
    assertExpectedStatus(response, 200, requestUrl, 'home must return HTTP 200');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assert.match(message, /path=\//);
  assert.match(message, /cf-ray=abc123def4567890-LAX/);
  assert.match(message, /cf-mitigated=challenge/);
  assert.match(message, /server=cloudflare/);
  assert.match(message, /content-type=text\/html; charset=utf-8/);
  assert.match(message, /retry-after=30/);
  for (const privateValue of ['PRIVATE_RESPONSE_BODY', 'PRIVATE_AUTH', 'PRIVATE_COOKIE', 'PRIVATE_HEADER', 'PRIVATE_QUERY', 'PRIVATE_FRAGMENT']) {
    assert.ok(!message.includes(privateValue), 'diagnostics leaked ' + privateValue);
  }
  assert.equal(response.bodyUsed, false, 'diagnostics must not read the response body');
});

test('unexpected status diagnostics reject structurally unsafe allowlisted header values', () => {
  const response = new Response(null, {
    status: 403,
    headers: {
      'cf-ray': 'synthetic-canary',
      'cf-mitigated': 'challenge=synthetic-canary',
      server: 'edge; cf-ray=spoofed',
      'content-type': 'Bearer synthetic-canary',
      'retry-after': '30; server=spoofed',
    },
  });
  const diagnostics = formatResponseDiagnostics(
    response,
    new URL('/private?token=PRIVATE_QUERY', PRODUCTION_ORIGIN),
  );
  assert.equal(diagnostics, 'path=/private');
  for (const unsafeValue of ['synthetic-canary', 'cf-ray=spoofed', 'server=spoofed', 'PRIVATE_QUERY']) {
    assert.ok(!diagnostics.includes(unsafeValue), 'diagnostics leaked or forged ' + unsafeValue);
  }
});

test('unexpected status omits missing and malformed allowlisted header values', () => {
  const response = new Response(null, {
    status: 403,
    headers: { 'cf-ray': 'bad%value' },
  });
  assert.equal(formatResponseDiagnostics(response, new URL('/private?secret=x', PRODUCTION_ORIGIN)), 'path=/private');
});

test('unexpected status diagnostics reject a request target outside the allowed production origin', () => {
  const response = new Response(null, { status: 403 });
  assert.throws(
    () => formatResponseDiagnostics(response, 'https://example.com/private'),
    /escaped approved origin/,
  );
});

test('production smoke rejects the Website Care preview marker, markup and loader', () => {
  assertNoCarePreview('<html><body><section class="section"><h2>Services</h2></section></body></html>', '/services/');
  assert.throws(() => assertNoCarePreview('<section id="care-options" data-care-options-preview>'), /preview marker/);
  assert.throws(() => assertNoCarePreview('<script src="/r5/care-carousel.js"></script>'), /preview markup/);
  assert.throws(() => assertNoCarePreview('<div class="care-tier care-tier--rec">'), /preview markup/);
  assert.throws(() => assertNoCarePreview('<section aria-labelledby="care-concept-bridge-heading">'), /preview markup/);
});

test('analytics loader smoke (L3/M1): exactly the production hosts and a clean route allowlist', () => {
  const ok = 'var HOSTS = ["lowcountrydigitalworks.com","www.lowcountrydigitalworks.com"];\n  var ROUTES = ["/","/connect/","/services/websites/"];';
  assert.deepEqual(assertAnalyticsLoader(ok), { hosts: 2, routes: 3 });
  assert.throws(() => assertAnalyticsLoader(ok.replace('"www.lowcountrydigitalworks.com"]', '"www.lowcountrydigitalworks.com","evil.pages.dev"]')), /exactly the production hosts/);
  assert.throws(() => assertAnalyticsLoader(ok.replace('"www.lowcountrydigitalworks.com"]', '"www.lowcountrydigitalworks.com","127.0.0.1"]')), /exactly the production hosts/);
  assert.throws(() => assertAnalyticsLoader(ok.replace('"lowcountrydigitalworks.com",', '')), /exactly the production hosts/);
  assert.throws(() => assertAnalyticsLoader('var ROUTES = ["/"];'), /HOSTS list not found/);
  assert.throws(() => assertAnalyticsLoader(ok.replace(/var ROUTES = [^;]*;/, '')), /ROUTES allowlist not found/);
  assert.throws(() => assertAnalyticsLoader(ok.replace('["/","/connect/","/services/websites/"]', '[]')), /must list the built pages/);
  for (const bad of ['/share/', '/other/', '/404/', '/Contact/', '/contact/foo@bar.com/']) {
    assert.throws(() => assertAnalyticsLoader(ok.replace('"/connect/"', JSON.stringify(bad))), /private, 404 or malformed/, bad);
  }
});

test('analytics smoke assertions: OFF forbids every analytics origin, ON requires them, neither allows unsafe-* or frame-src', () => {
  const base = "default-src 'self'; frame-ancestors 'none'; script-src 'self'; connect-src 'self'; img-src 'self' data:";
  const on = "default-src 'self'; frame-ancestors 'none'; script-src 'self' https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.clarity.ms https://c.bing.com; img-src 'self' data:";
  assert.doesNotThrow(() => assertAnalyticsCsp(base, false));
  assert.doesNotThrow(() => assertAnalyticsCsp(on, true));
  assert.throws(() => assertAnalyticsCsp(on, false), /analytics OFF/);
  assert.throws(() => assertAnalyticsCsp(base, true), /analytics ON/);
  for (const origin of ANALYTICS_CSP_ORIGINS) assert.throws(() => assertAnalyticsCsp(base + ' ' + origin, false), /analytics OFF/);
  assert.throws(() => assertAnalyticsCsp(on + " 'unsafe-eval'", true), /unsafe/);
  assert.throws(() => assertAnalyticsCsp(on + ' ; frame-src https://www.googletagmanager.com', true), /frame-src/);
  assert.doesNotThrow(() => assertAnalyticsHtml('<head></head>', false));
  assert.doesNotThrow(() => assertAnalyticsHtml('<script src="/ldw-analytics.js" defer></script>', true));
  assert.throws(() => assertAnalyticsHtml('<script src="/ldw-analytics.js"></script>', false));
  assert.throws(() => assertAnalyticsHtml('<head></head>', true));
});
