import assert from 'node:assert/strict';
import test from 'node:test';

import { addNonceToCsp, validateSecureShareDestination } from '../worker.js';

const SAFE_HOST = 'share.lowcountrydigitalworks.com';
const SAFE_URL = 'https://' + SAFE_HOST + '/public-sharing/test-only-destination';
const TEST_NONCE = 'QUJDREVGR0hJSktMTU5PUA==';

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function randomAscii(next, maxLength = 96) {
  const length = next() % (maxLength + 1);
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(32 + (next() % 95));
  }
  return value;
}

test('Secure Share rejects common URL-confusion and credential mutations', () => {
  const rejected = [
    '',
    'not a url',
    'http://' + SAFE_HOST + '/public-sharing/test',
    'ftp://' + SAFE_HOST + '/public-sharing/test',
    'https://evil.example/public-sharing/test',
    'https://' + SAFE_HOST + '.evil.example/public-sharing/test',
    'https://sub.' + SAFE_HOST + '/public-sharing/test',
    'https://user@' + SAFE_HOST + '/public-sharing/test',
    'https://user:pass@' + SAFE_HOST + '/public-sharing/test',
    'https://' + SAFE_HOST + ':8443/public-sharing/test',
    'https://evil.example/?next=https://' + SAFE_HOST + '/public-sharing/test',
    '//' + SAFE_HOST + '/public-sharing/test',
    'javascript:alert(1)',
    'data:text/html,hello',
  ];

  for (const candidate of rejected) {
    assert.equal(
      validateSecureShareDestination(candidate),
      null,
      'expected rejection for ' + JSON.stringify(candidate),
    );
  }

  assert.equal(validateSecureShareDestination(SAFE_URL), SAFE_URL);
});

test('deterministic URL fuzzing never widens the Secure Share origin boundary', () => {
  const next = xorshift32(0x4c445731);

  for (let index = 0; index < 750; index += 1) {
    const candidate = randomAscii(next);
    let result;
    assert.doesNotThrow(() => {
      result = validateSecureShareDestination(candidate);
    });

    if (result !== null) {
      const parsed = new URL(result);
      assert.equal(parsed.protocol, 'https:');
      assert.equal(parsed.hostname, SAFE_HOST);
      assert.equal(parsed.username, '');
      assert.equal(parsed.password, '');
      assert.equal(parsed.port, '');
    }
  }
});

test('CSP mutation stays fail-closed under malformed-policy fuzz corpus', () => {
  const next = xorshift32(0x43535031);
  const fixedPolicies = [
    '',
    "default-src 'self'",
    'script-src',
    "script-src 'self'; script-src 'none'",
    "script-src 'self' 'nonce-existing'",
    "default-src 'self'; script-src 'self'; object-src 'none'",
  ];

  for (const policy of fixedPolicies) {
    assert.doesNotThrow(() => addNonceToCsp(policy, TEST_NONCE));
  }

  for (let index = 0; index < 500; index += 1) {
    const policy = randomAscii(next, 160);
    let result;
    assert.doesNotThrow(() => {
      result = addNonceToCsp(policy, TEST_NONCE);
    });

    if (result !== null) {
      assert.ok(result.includes("'nonce-" + TEST_NONCE + "'"));
      assert.equal((result.match(/nonce-/g) ?? []).length, 1);
    }
  }
});
