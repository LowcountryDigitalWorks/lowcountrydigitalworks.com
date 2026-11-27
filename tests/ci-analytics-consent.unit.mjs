import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runConsentProof } from '../scripts/ci-analytics-consent.mjs';

function fixture({ fail = -1 } = {}) {
  const calls = [];
  let runs = 0;
  const options = {
    baseEnv: {
      CARE_OPTIONS_PREVIEW: '1', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main',
      ANALYTICS_ENABLED: '1', ANALYTICS_TEST_BUILD: '1',
      ANALYTICS_TEST_EXTRA_HOSTS: 'example.test', ANALYTICS_NETWORK_LOG: 'old.log',
      ANALYTICS_EVIDENCE_DIR: 'old-evidence',
    },
    run(name, args, env) {
      calls.push({ name, args, env: { ...env } });
      if (runs++ === fail) throw new Error('simulated failure');
    },
    clean() { calls.push({ clean: true }); },
  };
  return { calls, options };
}

test('consent proof isolates localhost test build and restores privacy-negative OFF build', () => {
  const { calls, options } = fixture();
  runConsentProof(options);
  assert.deepEqual(calls.map(c => c.clean ? 'clean' : [c.name, ...c.args].join(' ')), [
    'npm run build',
    'npx --no-install playwright test tests/analytics-consent.spec.mjs --project=chromium-desktop --project=chromium-mobile',
    'clean', 'npm run build', 'npm run test:clarity-privacy',
  ]);
  for (const c of calls.filter(c => !c.clean)) {
    assert.equal(c.env.CARE_OPTIONS_PREVIEW, '0');
    assert.equal(c.env.WORKERS_CI, '0');
    assert.equal(c.env.WORKERS_CI_BRANCH, '');
    assert.equal(c.env.ANALYTICS_NETWORK_LOG, '');
    assert.equal(c.env.ANALYTICS_EVIDENCE_DIR, '');
  }
  for (const c of calls.slice(0, 2)) {
    assert.equal(c.env.ANALYTICS_ENABLED, '1');
    assert.equal(c.env.ANALYTICS_TEST_BUILD, '1');
    assert.equal(c.env.ANALYTICS_TEST_EXTRA_HOSTS, '127.0.0.1');
  }
  for (const c of calls.slice(3)) {
    assert.equal(c.env.ANALYTICS_ENABLED, '0');
    assert.equal(c.env.ANALYTICS_TEST_BUILD, '0');
    assert.equal(c.env.ANALYTICS_TEST_EXTRA_HOSTS, '');
  }
});

test('failed consent browser proof restores OFF build and still rejects', () => {
  const { calls, options } = fixture({ fail: 1 });
  assert.throws(() => runConsentProof(options), /simulated failure/);
  assert.equal(calls[2].clean, true);
  assert.equal(calls[3].env.ANALYTICS_ENABLED, '0');
  assert.equal(calls[4].args[1], 'test:clarity-privacy');
});

test('failed test-only build never runs consent against stale assets', () => {
  const { calls, options } = fixture({ fail: 0 });
  assert.throws(() => runConsentProof(options), /simulated failure/);
  assert.equal(calls[1].clean, true);
  assert.equal(calls[2].env.ANALYTICS_ENABLED, '0');
  assert.ok(!calls.some(c => c.name === 'npx'));
});

test('failed restoration clears output and rejects', () => {
  const { calls, options } = fixture({ fail: 2 });
  assert.throws(() => runConsentProof(options), /simulated failure/);
  assert.equal(calls[2].clean, true);
  assert.equal(calls.at(-1).clean, true);
  assert.ok(!calls.some(c => c.args?.[1] === 'test:clarity-privacy'));
});
