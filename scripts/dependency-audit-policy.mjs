#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONFIG_URL = new URL('../config/dependency-risk-acceptances.json', import.meta.url);
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return false;
  }
  return [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

export function validateAuditReport(report, label = 'audit') {
  if (!isPlainObject(report)) {
    throw new Error(`${label}: npm audit result is not an object`);
  }
  if (report.error) {
    throw new Error(`${label}: npm audit returned an error payload`);
  }
  if (!isPlainObject(report.vulnerabilities)) {
    throw new Error(`${label}: missing/invalid vulnerabilities object`);
  }
  if (!isPlainObject(report.metadata) || !isPlainObject(report.metadata.vulnerabilities)) {
    throw new Error(`${label}: missing/invalid metadata.vulnerabilities`);
  }

  for (const severity of SEVERITIES) {
    if (!Number.isInteger(report.metadata.vulnerabilities[severity]) || report.metadata.vulnerabilities[severity] < 0) {
      throw new Error(`${label}: invalid metadata count for ${severity}`);
    }
  }

  const computed = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!isPlainObject(vulnerability) || !SEVERITIES.includes(vulnerability.severity)) {
      throw new Error(`${label}: invalid vulnerability entry for ${name}`);
    }
    computed[vulnerability.severity] += 1;
  }

  if (
    computed.high !== report.metadata.vulnerabilities.high ||
    computed.critical !== report.metadata.vulnerabilities.critical
  ) {
    throw new Error(`${label}: HIGH/CRITICAL metadata does not reconcile with vulnerability entries`);
  }

  return report;
}

export function validateAcceptanceConfig(config) {
  if (!isPlainObject(config) || config.schemaVersion !== 1 || !Array.isArray(config.acceptances)) {
    throw new Error('acceptance config has an unsupported schema');
  }

  const ids = new Set();
  for (const acceptance of config.acceptances) {
    if (!isPlainObject(acceptance) || typeof acceptance.id !== 'string' || acceptance.id.length === 0) {
      throw new Error('acceptance config contains an invalid id');
    }
    if (ids.has(acceptance.id)) {
      throw new Error(`duplicate acceptance id: ${acceptance.id}`);
    }
    ids.add(acceptance.id);

    if (
      acceptance.scope !== 'build-dev' ||
      acceptance.sourceSeverity !== 'high' ||
      typeof acceptance.finding !== 'string' ||
      typeof acceptance.issue !== 'string' ||
      typeof acceptance.approvedOn !== 'string' ||
      typeof acceptance.expiresAfter !== 'string' ||
      typeof acceptance.residualRisk !== 'string' ||
      !isPlainObject(acceptance.packages) ||
      Object.keys(acceptance.packages).length === 0
    ) {
      throw new Error(`acceptance ${acceptance.id} is incomplete or outside the supported build-dev HIGH policy`);
    }
  }

  return config;
}

function blockingEntries(report, severity) {
  return Object.entries(report.vulnerabilities).filter(([, vulnerability]) => vulnerability.severity === severity);
}

function packageMatches(vulnerability, spec) {
  if (!isPlainObject(vulnerability) || vulnerability.severity !== 'high') return false;
  if (vulnerability.isDirect !== spec.isDirect) return false;
  if (!sameStringSet(vulnerability.nodes, spec.nodes)) return false;
  if (!Array.isArray(vulnerability.via)) return false;

  const objectVia = vulnerability.via.filter((value) => isPlainObject(value));
  const packageVia = vulnerability.via.filter((value) => typeof value === 'string');

  if (typeof spec.advisoryUrl === 'string') {
    return (
      objectVia.length === 1 &&
      objectVia[0].url === spec.advisoryUrl &&
      objectVia[0].severity === 'high' &&
      packageVia.length === 0
    );
  }

  if (Array.isArray(spec.viaPackages)) {
    return objectVia.length === 0 && sameStringSet(packageVia, spec.viaPackages);
  }

  return false;
}

export function evaluateAuditPolicy({ runtimeReport, fullReport, config, today }) {
  validateAuditReport(runtimeReport, 'runtime audit');
  validateAuditReport(fullReport, 'full-tree audit');
  validateAcceptanceConfig(config);

  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error('today must be YYYY-MM-DD');
  }

  const runtimeCritical = blockingEntries(runtimeReport, 'critical');
  const runtimeHigh = blockingEntries(runtimeReport, 'high');
  if (runtimeCritical.length > 0 || runtimeHigh.length > 0) {
    return {
      ok: false,
      message: 'production/runtime dependency tree contains HIGH or CRITICAL vulnerabilities',
    };
  }

  const fullCritical = blockingEntries(fullReport, 'critical');
  if (fullCritical.length > 0) {
    return {
      ok: false,
      message: 'full dependency tree contains a CRITICAL vulnerability',
    };
  }

  const fullHigh = blockingEntries(fullReport, 'high');
  if (fullHigh.length === 0) {
    if (config.acceptances.length > 0) {
      return {
        ok: false,
        message: 'dependency-risk acceptance is stale because no HIGH findings remain; remove the acceptance',
      };
    }
    return { ok: true, message: 'no HIGH or CRITICAL vulnerabilities in runtime or full dependency tree' };
  }

  const matchedAcceptanceIds = new Set();

  for (const [name, vulnerability] of fullHigh) {
    const matches = config.acceptances.filter((acceptance) => {
      if (today > acceptance.expiresAfter) return false;
      const packageSpec = acceptance.packages[name];
      return packageSpec && packageMatches(vulnerability, packageSpec);
    });

    if (matches.length !== 1) {
      return {
        ok: false,
        message: `unapproved, expired, or drifted build/dev HIGH vulnerability: ${name}`,
      };
    }

    matchedAcceptanceIds.add(matches[0].id);
  }

  for (const acceptance of config.acceptances) {
    if (today > acceptance.expiresAfter) {
      return {
        ok: false,
        message: `dependency-risk acceptance expired after ${acceptance.expiresAfter}: ${acceptance.id}`,
      };
    }

    if (!matchedAcceptanceIds.has(acceptance.id)) {
      return {
        ok: false,
        message: `dependency-risk acceptance no longer matches the live HIGH findings: ${acceptance.id}`,
      };
    }

    for (const packageName of Object.keys(acceptance.packages)) {
      const live = fullHigh.find(([name]) => name === packageName);
      if (!live || !packageMatches(live[1], acceptance.packages[packageName])) {
        return {
          ok: false,
          message: `accepted package/advisory/path identity drifted: ${packageName}`,
        };
      }
    }
  }

  return {
    ok: true,
    message: `PASS WITH REVIEWED BUILD/DEV HIGH ACCEPTANCE — ${[...matchedAcceptanceIds].join(', ')}`,
  };
}

export function parseAuditOutput(stdout, label) {
  if (typeof stdout !== 'string' || stdout.trim() === '') {
    throw new Error(`${label}: npm audit returned no JSON output`);
  }

  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new Error(`${label}: npm audit did not return parseable JSON`);
  }

  return validateAuditReport(report, label);
}

export function runNpmAudit(extraArgs, label) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['audit', ...extraArgs, '--json'], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw new Error(`${label}: npm audit could not run: ${result.error.message}`);
  }
  if (result.signal) {
    throw new Error(`${label}: npm audit terminated by signal ${result.signal}`);
  }
  if (![0, 1].includes(result.status)) {
    throw new Error(`${label}: npm audit exited unexpectedly with status ${result.status}`);
  }

  return parseAuditOutput(result.stdout, label);
}

function loadConfig() {
  const parsed = JSON.parse(readFileSync(CONFIG_URL, 'utf8'));
  return validateAcceptanceConfig(parsed);
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const runtimeReport = runNpmAudit(['--omit=dev'], 'runtime audit');
  const fullReport = runNpmAudit([], 'full-tree audit');
  const config = loadConfig();
  const result = evaluateAuditPolicy({ runtimeReport, fullReport, config, today });

  if (!result.ok) {
    console.error(`DEPENDENCY AUDIT: FAIL — ${result.message}`);
    process.exitCode = 1;
    return;
  }

  const highCount = fullReport.metadata.vulnerabilities.high;
  if (highCount > 0) {
    console.warn(`DEPENDENCY AUDIT: ${result.message}`);
    for (const acceptance of config.acceptances) {
      console.warn(
        `Accepted finding ${acceptance.finding}; scope=${acceptance.scope}; residual=${acceptance.residualRisk}; expires-after=${acceptance.expiresAfter}; issue=${acceptance.issue}`,
      );
    }
    console.warn('The finding remains open for remediation and post-fix verification.');
  } else {
    console.log(`DEPENDENCY AUDIT: PASS — ${result.message}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`DEPENDENCY AUDIT: FAIL — ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
