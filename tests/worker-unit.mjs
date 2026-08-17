import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { addNonceToCsp, createNonce } from '../worker.js';

const BASELINE_CSP =
  "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; upgrade-insecure-requests";

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
