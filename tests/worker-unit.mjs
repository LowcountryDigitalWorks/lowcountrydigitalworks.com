import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { addNonceToCsp, createNonce, validateSecureShareDestination } from '../worker.js';

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
