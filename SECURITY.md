# Security Policy

## Reporting a concern

Report suspected website or repository security concerns privately to:

`eddie@lowcountrydigitalworks.com`

Do not open a public issue containing credentials, exploit details, private customer information, or sensitive infrastructure data.

## Scope

This repository currently contains a static public website and Cloudflare deployment configuration. It must not contain secrets, private keys, API tokens, payment information, customer data, PHI, recovery codes, or password-vault material.

## Dependency security

LDW's portfolio dependency/vulnerability policy is maintained in:

`LowcountryDigitalWorks/business-operations/docs/security/DEPENDENCY_AND_VULNERABILITY_MANAGEMENT.md`

Repository implementation rules:
- direct packages are classified by actual production/runtime, build/development, or test/CI/deployment use;
- this site currently deploys static assets plus a Cloudflare Worker with no npm runtime imports;
- Astro and the font package are build/development inputs;
- Playwright, axe, and Wrangler are test/CI/deployment tooling;
- CI audits the production/runtime dependency view separately from the full dependency tree;
- HIGH/CRITICAL production/runtime findings block by default;
- CRITICAL findings anywhere block by default;
- build/dev HIGH findings remain blocking until explicitly reviewed and dispositioned through an exact, visible, expiring acceptance tied to a canonical security finding;
- scanner/vendor severity is preserved separately from LDW residual-risk analysis;
- malformed or drifted audit evidence fails closed.

An accepted mitigation or build-only disposition does not close the underlying vulnerability. Remediation and post-fix verification remain required under the canonical finding process.

## Supported version

Only the current production branch and deployment are supported. Historical commits are retained for audit and rollback but are not separately maintained.

## Response expectations

Reports will be reviewed as business availability permits. Lowcountry Digital Works does not claim 24/7 monitoring or guaranteed response times.
