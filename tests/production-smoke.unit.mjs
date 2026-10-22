import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ALLOWED_DIAGNOSTIC_HEADERS,
  MIN_HSTS_MAX_AGE,
  PRODUCTION_ORIGIN,
  assertResponseStatus,
  assertRobots,
  assertSecurityHeaders,
  assertSitemap,
  assertWwwBehavior,
  extractEdgeDiagnostics,
  extractSafePathname,
  formatEdgeDiagnostics,
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
  const result = assertSecurityHeaders(acceptedHeaders());
  assert.equal(result.maxAge, MIN_HSTS_MAX_AGE);
});

test('security headers fail closed when HSTS max-age regresses', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=2592000')),
    /HSTS max-age regressed below accepted 6-month Cloudflare baseline/,
  );
});

test('security headers fail closed if includeSubDomains or preload appears without approval', () => {
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; includeSubDomains')),
    /includeSubDomains must remain off/,
  );
  assert.throws(
    () => assertSecurityHeaders(acceptedHeaders('max-age=' + MIN_HSTS_MAX_AGE + '; preload')),
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

test('ordinary expected response status assertions pass without throwing', () => {
  const okResponse = new Response('ok', { status: 200 });
  assert.doesNotThrow(() => assertResponseStatus(okResponse, 200, '/services/'));
});

test('unexpected status includes status, pathname, and allowed diagnostic headers when supplied', () => {
  const headers = new Headers({
    'cf-ray': '8f123456789',
    'cf-mitigated': 'challenge',
    server: 'cloudflare',
    'content-type': 'text/html; charset=UTF-8',
    'retry-after': '60',
  });
  const response = new Response('Forbidden', { status: 403, headers });

  assert.throws(
    () => assertResponseStatus(response, 200, '/services/'),
    err => {
      assert.match(err.message, /expected HTTP 200, received HTTP 403/);
      assert.match(err.message, /status=403/);
      assert.match(err.message, /path=\/services\//);
      assert.match(err.message, /cf-ray=8f123456789/);
      assert.match(err.message, /cf-mitigated=challenge/);
      assert.match(err.message, /server=cloudflare/);
      assert.match(err.message, /content-type=text\/html; charset=UTF-8/);
      assert.match(err.message, /retry-after=60/);
      return true;
    },
  );
});

test('missing diagnostic headers are omitted safely without failure', () => {
  const response = { status: 403, headers: new Headers() };
  const formatted = formatEdgeDiagnostics(response, '/about/');

  assert.equal(formatted, 'status=403, path=/about/');
  assert.doesNotMatch(formatted, /undefined|null/);
});

test('header names not on the explicit allowlist are not emitted', () => {
  const headers = new Headers({
    'cf-ray': '7a999999',
    'x-custom-secret': 'sensitive_header_value',
    'x-powered-by': 'express',
    'cache-control': 'no-cache',
  });
  const response = new Response('Blocked', { status: 403, headers });
  const formatted = formatEdgeDiagnostics(response, '/work/');

  assert.match(formatted, /cf-ray=7a999999/);
  assert.doesNotMatch(formatted, /x-custom-secret|sensitive_header_value|x-powered-by|express|cache-control/);
});

test('set-cookie, authorization-like headers, and response body never appear in diagnostics', () => {
  const headers = new Headers({
    'set-cookie': 'session_token=secret_cookie_val; Secure; HttpOnly',
    authorization: 'Bearer secret_auth_token',
    'www-authenticate': 'Basic realm="Secret Area"',
    cookie: 'user=admin',
    'cf-ray': 'ray_id_100',
  });
  const responseBody = '<html>secret response body text</html>';
  const response = new Response(responseBody, { status: 403, headers });

  const formatted = formatEdgeDiagnostics(response, '/privacy/');
  assert.match(formatted, /cf-ray=ray_id_100/);
  assert.doesNotMatch(formatted, /set-cookie|session_token|secret_cookie_val|authorization|Bearer|secret_auth_token|www-authenticate|Basic|cookie|user=admin/i);

  assert.throws(
    () => assertResponseStatus(response, 200, '/privacy/'),
    err => {
      assert.doesNotMatch(err.message, /set-cookie|session_token|secret_cookie_val|authorization|Bearer|secret_auth_token|www-authenticate|cookie|secret response body text/i);
      return true;
    },
  );
});

test('no request target can escape the accepted production-origin safety boundary', () => {
  assert.throws(
    () => extractSafePathname('https://evil.com/phishing'),
    /escaped approved origin/,
  );

  assert.throws(
    () => extractSafePathname('/share/continue'),
    /must never request \/share\/continue/,
  );

  const queryTarget = 'https://lowcountrydigitalworks.com/connect/?secret_token=top_secret_123#fragment';
  const safePath = extractSafePathname(queryTarget);
  assert.equal(safePath, '/connect/');
  assert.doesNotMatch(safePath, /secret_token|top_secret_123|fragment/);
});

test('www behavior includes edge diagnostics when status is unexpected', () => {
  const headers = new Headers({
    'cf-ray': 'www_ray_456',
    server: 'cloudflare',
  });

  assert.throws(
    () => assertWwwBehavior({ status: 403, headers }),
    err => {
      assert.match(err.message, /www must either redirect to apex or serve a canonicalized 200 response/);
      assert.match(err.message, /status=403/);
      assert.match(err.message, /cf-ray=www_ray_456/);
      assert.match(err.message, /server=cloudflare/);
      return true;
    },
  );
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
