#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const APPROVED = Object.freeze({
  package: "http-cache-semantics",
  advisory: "GHSA-ch52-4w7c-c8xp",
  advisoryUrl: "https://github.com/advisories/GHSA-ch52-4w7c-c8xp",
  node: "node_modules/http-cache-semantics",
  parentPackage: "astro",
  parentNode: "node_modules/astro",
  expiresAfter: "2026-10-17",
  issue: "https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/issues/52",
});

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function fail(message) {
  console.error(`DEPENDENCY AUDIT: FAIL — ${message}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
if (today > APPROVED.expiresAfter) {
  fail(`approved exception expired after ${APPROVED.expiresAfter}; review ${APPROVED.issue}`);
}

const audit = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (audit.error) fail(`npm audit could not run: ${audit.error.message}`);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(audit.stdout);
  console.error(audit.stderr);
  fail("npm audit did not return parseable JSON");
}

const vulnerabilities = report.vulnerabilities ?? {};
const blocking = Object.entries(vulnerabilities).filter(([, vuln]) =>
  (severityRank[vuln.severity] ?? 99) >= severityRank.high
);

if (blocking.length === 0) {
  console.log("DEPENDENCY AUDIT: PASS — no HIGH or CRITICAL vulnerabilities.");
  process.exit(0);
}

const allowedNames = new Set([APPROVED.package, APPROVED.parentPackage]);

for (const [name, vuln] of blocking) {
  if ((severityRank[vuln.severity] ?? 99) >= severityRank.critical) {
    fail(`CRITICAL vulnerability remains in ${name}`);
  }

  if (!allowedNames.has(name)) {
    fail(`unapproved HIGH vulnerability remains in ${name}`);
  }

  if (name === APPROVED.package) {
    const advisoryMatches = Array.isArray(vuln.via) &&
      vuln.via.length === 1 &&
      typeof vuln.via[0] === "object" &&
      vuln.via[0] !== null &&
      vuln.via[0].severity === "high" &&
      vuln.via[0].url === APPROVED.advisoryUrl;

    const nodeMatches = Array.isArray(vuln.nodes) &&
      vuln.nodes.length === 1 &&
      vuln.nodes[0] === APPROVED.node;

    if (!advisoryMatches || !nodeMatches || vuln.isDirect === true) {
      fail(`approved advisory identity/path changed for ${name}`);
    }
  }

  if (name === APPROVED.parentPackage) {
    const parentMatches = Array.isArray(vuln.via) &&
      vuln.via.length === 1 &&
      vuln.via[0] === APPROVED.package;

    const nodeMatches = Array.isArray(vuln.nodes) &&
      vuln.nodes.length === 1 &&
      vuln.nodes[0] === APPROVED.parentNode;

    if (!parentMatches || !nodeMatches) {
      fail(`Astro vulnerability chain is no longer solely the approved transitive advisory`);
    }
  }
}

console.warn(
  `DEPENDENCY AUDIT: PASS WITH BOUNDED EXCEPTION — ${APPROVED.advisory} in ${APPROVED.package} is build-time-only for this static deployment; approved through ${APPROVED.expiresAfter}. See ${APPROVED.issue}`
);
console.warn("All CRITICAL findings and every other HIGH finding remain fail-closed.");
