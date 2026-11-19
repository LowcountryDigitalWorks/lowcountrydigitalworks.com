import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { addNonceToCsp, createNonce, validateSecureShareDestination } from '../worker.js';
import { normalizeProspectDisplayOrigin, inspectRequestedReportEmailIntent, ProspectIntakeError } from '../src/lib/prospect-intake-contract.mjs';

const BASELINE_CSP =
  "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; upgrade-insecure-requests";
const SECURE_SHARE_ORIGIN = 'https://share.lowcountrydigitalworks.com';
const TEST_SECURE_SHARE_DESTINATION = `${SECURE_SHARE_ORIGIN}/public-sharing/test-only-destination`;

function htmlResponse(headers = {}) {
  return new Response('<!doctype html><title>Test</title>', {
    headers: {
      'Cache-Control': 'public, max-age=60',
      'Content-Security-Policy': BASELINE_CSP,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function secureShareEnv(...args) {
  const env = {
    ASSETS: {
      fetch() {
        throw new Error('Secure Share transition must not fetch a static asset');
      },
    },
  };

  if (args.length === 0) {
    env.SECURE_SHARE_DESTINATION_URL = TEST_SECURE_SHARE_DESTINATION;
  } else if (args[0] !== undefined) {
    env.SECURE_SHARE_DESTINATION_URL = args[0];
  }

  return env;
}

test('nonce generation uses 128 bits and is fresh', () => {
  const nonces = new Set(Array.from({ length: 32 }, createNonce));

  assert.equal(nonces.size, 32);
  for (const nonce of nonces) {
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
    assert.equal(Buffer.from(nonce, 'base64').byteLength, 16);
  }
});

test('CSP mutation changes only script-src', () => {
  const nonce = createNonce();
  const changed = addNonceToCsp(BASELINE_CSP, nonce);

  assert.equal(changed, BASELINE_CSP.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`));
  assert.doesNotMatch(changed, /unsafe-inline|unsafe-eval/i);
});

test('CSP mutation fails closed for unsafe inputs', () => {
  assert.equal(addNonceToCsp(null, createNonce()), null);
  assert.equal(addNonceToCsp("default-src 'self'", createNonce()), null);
  assert.equal(addNonceToCsp("script-src 'self'; script-src 'none'", createNonce()), null);
  assert.equal(addNonceToCsp("script-src 'self' 'nonce-existing'", createNonce()), null);
  assert.equal(addNonceToCsp(BASELINE_CSP, "invalid nonce'"), null);
});

test('HTML responses preserve body, status, caching, and unrelated headers', async () => {
  let fetchCount = 0;
  const original = htmlResponse();
  const response = await worker.fetch(new Request('https://example.com/services/'), {
    ASSETS: {
      fetch() {
        fetchCount += 1;
        return original;
      },
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(response.status, original.status);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), '<!doctype html><title>Test</title>');
  assert.match(response.headers.get('Content-Security-Policy'), /script-src 'self' 'nonce-[A-Za-z0-9+/]{22}=='/);
});

test('independent HTML responses receive independent nonces', async () => {
  const env = { ASSETS: { fetch: () => htmlResponse() } };
  const request = new Request('https://example.com/');
  const first = await worker.fetch(request, env);
  const second = await worker.fetch(request, env);
  const noncePattern = /'nonce-([^']+)'/;

  assert.notEqual(
    first.headers.get('Content-Security-Policy').match(noncePattern)[1],
    second.headers.get('Content-Security-Policy').match(noncePattern)[1],
  );
});

test('non-HTML and anomalous HTML responses are returned unchanged', async () => {
  const css = new Response('body {}', { headers: { 'Content-Type': 'text/css' } });
  const noCsp = htmlResponse({ 'Content-Security-Policy': '' });

  assert.strictEqual(
    await worker.fetch(new Request('https://example.com/_astro/site.css'), {
      ASSETS: { fetch: () => css },
    }),
    css,
  );
  assert.strictEqual(
    await worker.fetch(new Request('https://example.com/missing-csp/'), {
      ASSETS: { fetch: () => noCsp },
    }),
    noCsp,
  );
});

test('Secure Share accepts only the approved HTTPS hostname', () => {
  assert.equal(validateSecureShareDestination(TEST_SECURE_SHARE_DESTINATION), TEST_SECURE_SHARE_DESTINATION);
  assert.equal(validateSecureShareDestination(undefined), null);
  assert.equal(validateSecureShareDestination('not a URL'), null);
  assert.equal(validateSecureShareDestination('http://share.lowcountrydigitalworks.com/test'), null);
  assert.equal(validateSecureShareDestination('https://example.com/test'), null);
  assert.equal(validateSecureShareDestination('https://share.lowcountrydigitalworks.com.evil.example/test'), null);
  assert.equal(validateSecureShareDestination('https://user:pass@share.lowcountrydigitalworks.com/test'), null);
  assert.equal(validateSecureShareDestination('https://share.lowcountrydigitalworks.com:8443/test'), null);
});

test('Secure Share transition redirects only to the configured destination', async () => {
  const response = await worker.fetch(
    new Request('https://lowcountrydigitalworks.com/share/continue'),
    secureShareEnv(),
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), TEST_SECURE_SHARE_DESTINATION);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, noarchive');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(await response.text(), '');
});

test('caller-supplied redirect parameters cannot override Secure Share', async () => {
  const response = await worker.fetch(
    new Request('https://lowcountrydigitalworks.com/share/continue?url=https://example.com/&next=https://example.org/'),
    secureShareEnv(),
  );

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), TEST_SECURE_SHARE_DESTINATION);
  assert.doesNotMatch(response.headers.get('Location'), /example\.(com|org)/);
});

test('Secure Share fails closed when its configured destination is missing or invalid', async (t) => {
  const invalidDestinations = [
    undefined,
    '',
    'not a URL',
    'http://share.lowcountrydigitalworks.com/test',
    'https://example.com/test',
    'https://share.lowcountrydigitalworks.com.evil.example/test',
    'https://user:pass@share.lowcountrydigitalworks.com/test',
    'https://share.lowcountrydigitalworks.com:8443/test',
  ];

  for (const destination of invalidDestinations) {
    await t.test(String(destination), async () => {
      const response = await worker.fetch(
        new Request('https://lowcountrydigitalworks.com/share/continue'),
        secureShareEnv(destination),
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Location'), null);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, noarchive');
      assert.equal(
        await response.text(),
        'Secure Share is temporarily unavailable. Please contact Lowcountry Digital Works.',
      );
    });
  }
});

test('Secure Share supports HEAD and rejects unsupported methods', async () => {
  const head = await worker.fetch(
    new Request('https://lowcountrydigitalworks.com/share/continue', { method: 'HEAD' }),
    secureShareEnv(),
  );
  assert.equal(head.status, 302);
  assert.equal(head.headers.get('Location'), TEST_SECURE_SHARE_DESTINATION);
  assert.equal(await head.text(), '');

  const post = await worker.fetch(
    new Request('https://lowcountrydigitalworks.com/share/continue', { method: 'POST' }),
    secureShareEnv(),
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD');
  assert.equal(post.headers.get('Location'), null);
  assert.equal(post.headers.get('Cache-Control'), 'no-store');
});


test('owned prospect URL intake normalizes only displayable public-looking HTTPS homepage origins', () => {
  const cases = [
    ['example.org', 'https://example.org'],
    ['www.example.org', 'https://www.example.org'],
    [' https://EXAMPLE.ORG/ ', 'https://example.org'],
    ['HTTPS://ExAmPlE.CoM', 'https://example.com'],
    ['sub.site.co.uk', 'https://sub.site.co.uk'],
  ];
  for (const [input, expected] of cases) {
    const result = normalizeProspectDisplayOrigin(input);
    assert.equal(result.kind, 'ldw.prospect-display-target.v0');
    assert.equal(result.displayOrigin, expected);
    assert.equal(result.hostname, new URL(expected).hostname);
    assert.equal(result.scanAuthorized, false);
    assert.equal(result.networkAuthorized, false);
    assert.equal(Object.isFrozen(result), true);
  }
});

test('owned prospect URL intake rejects arbitrary fetch targets and URL parser confusion', () => {
  const cases = [
    '', ' ', '/example.org', '.example.org', 'localhost', 'otherhost',
    'http://example.org', 'ftp://example.org', 'file:///etc/passwd',
    'gopher://example.org', 'https:example.org', '//example.org',
    'https://example.org:443', 'https://example.org:8443',
    'https://name:pass@example.org', 'https://name@example.org',
    'https://example.org/path', 'example.org/path', 'https://example.org//',
    'https://example.org/?utm=1', 'https://example.org/#x',
    'example.org?url=https://evil.org', 'example.org#frag',
    'https://example.org\\@evil.org', 'https://example.org%2f.evil.org',
    'https://[::1]', 'https://[fe80::1]', 'https://127.0.0.1',
    'https://169.254.169.254', 'https://0x7f000001',
    'https://2130706433', 'https://0177.0.0.1',
    'https://metadata.google.internal', 'http://localhost',
    'example.localhost', 'example.internal', 'example.local',
    'example.invalid', 'example.test', 'example.example',
    'example.onion', 'example.arpa', 'example.123',
    'example..org', '-evil.example.org', 'bad_.example.org',
    'xn--fa-hia.example.org', 'münich.example.org',
    'example.org\nBcc: somebody@example.org',
    'https://example.org\thttp://evil.org',
    'https://example.org'.padEnd(400, 'x'),
  ];
  for (const value of cases) {
    assert.throws(() => normalizeProspectDisplayOrigin(value), ProspectIntakeError,
      'Expected fail-closed display-only URL syntax for ' + JSON.stringify(value));
  }
});

test('owned prospect intake has no network or email authority in its output', () => {
  const value = normalizeProspectDisplayOrigin('https://example.org');
  assert.deepEqual(Object.keys(value).sort(),
    ['displayOrigin', 'hostname', 'kind', 'networkAuthorized', 'scanAuthorized'].sort());
  assert.equal('fetchUrl' in value, false);
  assert.equal('permissionToCrawl' in value, false);
  assert.equal('scanSucceeded' in value, false);
});

test('requested email-report intent is format-only, separately opts into marketing and does not retain an address', () => {
  const email = 'Person+site.audit@Example.org';
  const base = inspectRequestedReportEmailIntent({ email, reportRequested: true });
  assert.deepEqual(base, {
    kind: 'ldw.prospect-report-email-intent.v0',
    reportRequested: true,
    emailFormat: 'valid',
    marketingOptIn: false,
    emailRetained: false,
    emailDeliveryAuthorized: false,
  });
  const optional = inspectRequestedReportEmailIntent({
    email, reportRequested: true, marketingOptIn: true,
  });
  assert.equal(optional.marketingOptIn, true);
  assert.equal(optional.emailDeliveryAuthorized, false);
  assert.equal(JSON.stringify(optional).includes(email), false);
  assert.equal(Object.isFrozen(base), true);
});

test('requested email-report intent fails closed on header injection, bad domains and unauthorized fields', () => {
  const cases = [
    undefined, null, [], '', 1,
    { email: 'ok@example.org', reportRequested: false },
    { email: 'ok@example.org', reportRequested: true, marketingOptIn: 'yes' },
    { email: 'ok@example.org', reportRequested: true, mailingList: true },
    { email: 'ok@example.org', reportRequested: true, marketingOptIn: null },
    { email: 'a\nBcc:evil@example.org', reportRequested: true },
    { email: 'a@example.org\r\nTo: evil@example.org', reportRequested: true },
    { email: 'a@example.org@example.net', reportRequested: true },
    { email: 'a..b@example.org', reportRequested: true },
    { email: '.ab@example.org', reportRequested: true },
    { email: 'ab.@example.org', reportRequested: true },
    { email: 'ab@localhost', reportRequested: true },
    { email: 'ab@10.0.0.1', reportRequested: true },
    { email: 'ab@example.local', reportRequested: true },
    { email: 'ab@example.test', reportRequested: true },
    { email: 'ab@xn--fa-hia.org', reportRequested: true },
    { email: 'ab@münich.org', reportRequested: true },
    { email: 'ab@example.org'.repeat(40), reportRequested: true },
    { email: 'a <a@example.org>', reportRequested: true },
    { email: '"a b"@example.org', reportRequested: true },
  ];
  for (const input of cases) {
    assert.throws(() => inspectRequestedReportEmailIntent(input), ProspectIntakeError);
  }
});
