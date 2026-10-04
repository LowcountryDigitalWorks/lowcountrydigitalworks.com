import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateAuditPolicy,
  validateAcceptanceConfig,
  validateAuditReport,
} from '../scripts/dependency-audit-policy.mjs';

const ADVISORY_URL = 'https://github.com/advisories/GHSA-ch52-4w7c-c8xp';

function auditReport(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const vulnerability of Object.values(vulnerabilities)) {
    counts[vulnerability.severity] += 1;
  }

  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: {
      vulnerabilities: {
        ...counts,
        total: Object.keys(vulnerabilities).length,
      },
      dependencies: {
        prod: 0,
        dev: 0,
        optional: 0,
        peer: 0,
        peerOptional: 0,
        total: 0,
      },
    },
  };
}

function acceptedHighReport() {
  return auditReport({
    'http-cache-semantics': {
      name: 'http-cache-semantics',
      severity: 'high',
      isDirect: false,
      via: [
        {
          source: 999999,
          name: 'http-cache-semantics',
          dependency: 'http-cache-semantics',
          title: 'max-stale handling can disclose cross-user cached responses',
          url: ADVISORY_URL,
          severity: 'high',
          range: '<=4.2.0',
        },
      ],
      effects: ['astro'],
      range: '<=4.2.0',
      nodes: ['node_modules/http-cache-semantics'],
      fixAvailable: false,
    },
    astro: {
      name: 'astro',
      severity: 'high',
      isDirect: true,
      via: ['http-cache-semantics'],
      effects: [],
      range: '>=7.1.0',
      nodes: ['node_modules/astro'],
      fixAvailable: false,
    },
  });
}

function acceptedConfig() {
  return {
    schemaVersion: 1,
    acceptances: [
      {
        id: 'WEB-SEC-2026-001',
        finding: 'GHSA-ch52-4w7c-c8xp',
        scope: 'build-dev',
        sourceSeverity: 'high',
        issue: 'https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/issues/52',
        approvedOn: '2026-10-03',
        expiresAfter: '2026-10-17',
        residualRisk: 'low',
        rationale: 'test fixture',
        packages: {
          'http-cache-semantics': {
            nodes: ['node_modules/http-cache-semantics'],
            isDirect: false,
            advisoryUrl: ADVISORY_URL,
          },
          astro: {
            nodes: ['node_modules/astro'],
            isDirect: true,
            viaPackages: ['http-cache-semantics'],
          },
        },
      },
    ],
  };
}

test('clean runtime and full-tree reports pass without an acceptance', () => {
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: auditReport(),
    config: { schemaVersion: 1, acceptances: [] },
    today: '2026-10-03',
  });
  assert.equal(result.ok, true);
});

test('exact reviewed build/dev HIGH chain passes with visible bounded acceptance', () => {
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: acceptedHighReport(),
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, true);
  assert.match(result.message, /PASS WITH REVIEWED BUILD\/DEV HIGH ACCEPTANCE/);
});

test('missing vulnerabilities object fails closed', () => {
  const report = auditReport();
  delete report.vulnerabilities;
  assert.throws(() => validateAuditReport(report, 'fixture'), /missing\/invalid vulnerabilities object/);
});

test('npm audit error payload fails closed', () => {
  const report = auditReport();
  report.error = { code: 'EAUDIT' };
  assert.throws(() => validateAuditReport(report, 'fixture'), /error payload/);
});

test('missing or invalid metadata fails closed', () => {
  const report = auditReport();
  delete report.metadata;
  assert.throws(() => validateAuditReport(report, 'fixture'), /metadata\.vulnerabilities/);
});

test('missing auditReportVersion fails closed', () => {
  const report = auditReport();
  delete report.auditReportVersion;
  assert.throws(() => validateAuditReport(report, 'fixture'), /unsupported npm audit report version/);
});

test('unsupported auditReportVersion fails closed', () => {
  const report = auditReport();
  report.auditReportVersion = 3;
  assert.throws(() => validateAuditReport(report, 'fixture'), /unsupported npm audit report version/);
});

test('HIGH metadata count drift fails closed', () => {
  const report = acceptedHighReport();
  report.metadata.vulnerabilities.high = 1;
  assert.throws(() => validateAuditReport(report, 'fixture'), /HIGH metadata does not reconcile/);
});

test('LOW and MODERATE metadata count drift fail closed', () => {
  const low = auditReport({
    helper: {
      name: 'helper',
      severity: 'low',
      isDirect: false,
      via: [],
      effects: [],
      range: '*',
      nodes: ['node_modules/helper'],
      fixAvailable: false,
    },
  });
  low.metadata.vulnerabilities.low = 0;
  assert.throws(() => validateAuditReport(low, 'fixture'), /LOW metadata does not reconcile/);

  const moderate = auditReport({
    helper: {
      name: 'helper',
      severity: 'moderate',
      isDirect: false,
      via: [],
      effects: [],
      range: '*',
      nodes: ['node_modules/helper'],
      fixAvailable: false,
    },
  });
  moderate.metadata.vulnerabilities.moderate = 0;
  assert.throws(() => validateAuditReport(moderate, 'fixture'), /MODERATE metadata does not reconcile/);
});

test('TOTAL metadata count drift fails closed', () => {
  const report = acceptedHighReport();
  report.metadata.vulnerabilities.total = 1;
  assert.throws(() => validateAuditReport(report, 'fixture'), /TOTAL metadata does not reconcile/);
});

test('vulnerability map key/name disagreement fails closed', () => {
  const report = acceptedHighReport();
  report.vulnerabilities['http-cache-semantics'].name = 'different-package';
  assert.throws(() => validateAuditReport(report, 'fixture'), /map key\/name mismatch/);
});

test('runtime HIGH blocks even when the same finding has a build/dev acceptance', () => {
  const result = evaluateAuditPolicy({
    runtimeReport: acceptedHighReport(),
    fullReport: acceptedHighReport(),
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /production\/runtime/);
});

test('full-tree CRITICAL blocks', () => {
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: auditReport({
      dangerous: {
        name: 'dangerous',
        severity: 'critical',
        isDirect: false,
        via: [],
        effects: [],
        range: '*',
        nodes: ['node_modules/dangerous'],
        fixAvailable: false,
      },
    }),
    config: { schemaVersion: 1, acceptances: [] },
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /CRITICAL/);
});

test('unrelated build/dev HIGH blocks until reviewed and dispositioned', () => {
  const report = acceptedHighReport();
  report.vulnerabilities.other = {
    name: 'other',
    severity: 'high',
    isDirect: false,
    via: [{ url: 'https://example.invalid/advisory', severity: 'high' }],
    effects: [],
    range: '*',
    nodes: ['node_modules/other'],
    fixAvailable: false,
  };
  report.metadata.vulnerabilities.high += 1;
  report.metadata.vulnerabilities.total += 1;

  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: report,
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /unapproved/);
});

test('advisory identity drift blocks', () => {
  const report = acceptedHighReport();
  report.vulnerabilities['http-cache-semantics'].via[0].url = 'https://example.invalid/different';
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: report,
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /drifted|unapproved/);
});

test('package node/path drift blocks', () => {
  const report = acceptedHighReport();
  report.vulnerabilities['http-cache-semantics'].nodes = ['node_modules/changed'];
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: report,
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
});

test('directness drift blocks', () => {
  const report = acceptedHighReport();
  report.vulnerabilities['http-cache-semantics'].isDirect = true;
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: report,
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
});

test('Astro parent-chain drift blocks', () => {
  const report = acceptedHighReport();
  report.vulnerabilities.astro.via = ['something-else'];
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: report,
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
});

test('acceptance is valid through its expiry date and blocks the next day', () => {
  const onExpiry = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: acceptedHighReport(),
    config: acceptedConfig(),
    today: '2026-10-17',
  });
  assert.equal(onExpiry.ok, true);

  const afterExpiry = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: acceptedHighReport(),
    config: acceptedConfig(),
    today: '2026-10-18',
  });
  assert.equal(afterExpiry.ok, false);
  assert.match(afterExpiry.message, /expired/);
});

test('acceptance cannot activate before its approval date', () => {
  const config = acceptedConfig();
  config.acceptances[0].approvedOn = '2026-10-05';
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: acceptedHighReport(),
    config,
    today: '2026-10-04',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /not active before/);
});

test('non-date and impossible expiry values fail closed', () => {
  const nonDate = acceptedConfig();
  nonDate.acceptances[0].expiresAfter = 'never';
  assert.throws(() => validateAcceptanceConfig(nonDate), /incomplete|outside/);

  const impossible = acceptedConfig();
  impossible.acceptances[0].expiresAfter = '2026-02-30';
  assert.throws(() => validateAcceptanceConfig(impossible), /incomplete|outside/);
});

test('expiry before approval fails closed', () => {
  const config = acceptedConfig();
  config.acceptances[0].approvedOn = '2026-10-10';
  config.acceptances[0].expiresAfter = '2026-10-09';
  assert.throws(() => validateAcceptanceConfig(config), /expires before/);
});

test('missing or empty rationale fails closed', () => {
  const missing = acceptedConfig();
  delete missing.acceptances[0].rationale;
  assert.throws(() => validateAcceptanceConfig(missing), /incomplete|outside/);

  const empty = acceptedConfig();
  empty.acceptances[0].rationale = '   ';
  assert.throws(() => validateAcceptanceConfig(empty), /incomplete|outside/);
});

test('residual risk must use controlled vocabulary', () => {
  const config = acceptedConfig();
  config.acceptances[0].residualRisk = 'whatever';
  assert.throws(() => validateAcceptanceConfig(config), /incomplete|outside/);
});

test('finding must match the bound GitHub advisory URL', () => {
  const config = acceptedConfig();
  config.acceptances[0].finding = 'GHSA-aaaa-bbbb-cccc';
  assert.throws(() => validateAcceptanceConfig(config), /finding\/advisory URL mismatch/);
});

test('malformed canonical issue reference fails closed', () => {
  const config = acceptedConfig();
  config.acceptances[0].issue = 'https://example.invalid/issues/52';
  assert.throws(() => validateAcceptanceConfig(config), /incomplete|outside/);
});

test('package specs require one exact matching mode and well-formed nodes', () => {
  const bothModes = acceptedConfig();
  bothModes.acceptances[0].packages['http-cache-semantics'].viaPackages = ['astro'];
  assert.throws(() => validateAcceptanceConfig(bothModes), /exactly one/);

  const badNodes = acceptedConfig();
  badNodes.acceptances[0].packages.astro.nodes = [];
  assert.throws(() => validateAcceptanceConfig(badNodes), /nodes must be/);
});

test('stale acceptance blocks after the finding disappears so the exception is removed', () => {
  const result = evaluateAuditPolicy({
    runtimeReport: auditReport(),
    fullReport: auditReport(),
    config: acceptedConfig(),
    today: '2026-10-03',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /stale/);
});

test('unsupported acceptance schema fails closed', () => {
  assert.throws(
    () => validateAcceptanceConfig({ schemaVersion: 2, acceptances: [] }),
    /unsupported schema/,
  );
});
