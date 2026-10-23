import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRecoveryReadiness } from '../scripts/recovery-readiness.mjs';

function fixture(overrides = {}) {
  return {
    packageJson: { scripts: { build: 'astro build' } },
    wranglerText: [
      '"name": "lowcountrydigitalworks"',
      '"main": "./worker.js"',
      '"directory": "./dist"',
    ].join('\n'),
    deploymentText: [
      'production branch `main`',
      'build: `npm run build`',
      'production deploy command: `npx wrangler deploy`',
      'SECURE_SHARE_DESTINATION_URL',
    ].join('\n'),
    recoveryText: [
      'Recovery class: `STATIC_GIT_MANAGED`',
      'Production-only Secure Share secret recovery: **UNVERIFIED**',
      'The secret value must never be copied into this document',
      'Current overall result remains **PARTIAL**',
    ].join('\n'),
    lockExists: true,
    workerExists: true,
    distIndexExists: true,
    ...overrides,
  };
}

test('healthy static recovery contract reports PARTIAL while external secret recovery is unverified', () => {
  assert.deepEqual(evaluateRecoveryReadiness(fixture()), {
    overall: 'PARTIAL',
    sourceBuild: 'VERIFIED',
    repositoryRedeploy: 'VERIFIED',
    secureShareSecretRecovery: 'UNVERIFIED',
  });
});

test('recovery contract can become VERIFIED without storing a secret value once external recovery is independently verified', () => {
  const recoveryText = [
    'Recovery class: `STATIC_GIT_MANAGED`',
    'Production-only Secure Share secret recovery: **VERIFIED**',
    'The secret value must never be copied into this document',
  ].join('\n');

  assert.equal(
    evaluateRecoveryReadiness(fixture({ recoveryText })).overall,
    'VERIFIED',
  );
});

test('missing committed lockfile fails closed', () => {
  assert.throws(
    () => evaluateRecoveryReadiness(fixture({ lockExists: false })),
    /package-lock\.json is required/,
  );
});

test('missing clean build output fails closed', () => {
  assert.throws(
    () => evaluateRecoveryReadiness(fixture({ distIndexExists: false })),
    /clean build must produce dist\/index\.html/,
  );
});

test('deployment command drift fails closed', () => {
  const deploymentText = [
    'production branch `main`',
    'build: `npm run build`',
    'production deploy command: `some-other-command`',
    'SECURE_SHARE_DESTINATION_URL',
  ].join('\n');

  assert.throws(
    () => evaluateRecoveryReadiness(fixture({ deploymentText })),
    /accepted deploy command/,
  );
});

test('unverified secret recovery cannot be documented as overall VERIFIED', () => {
  const recoveryText = [
    'Recovery class: `STATIC_GIT_MANAGED`',
    'Production-only Secure Share secret recovery: **UNVERIFIED**',
    'The secret value must never be copied into this document',
    'Current overall result remains **VERIFIED**',
  ].join('\n');

  assert.throws(
    () => evaluateRecoveryReadiness(fixture({ recoveryText })),
    /must not report VERIFIED/,
  );
});
