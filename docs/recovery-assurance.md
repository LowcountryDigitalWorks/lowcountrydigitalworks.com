# Website recovery assurance

Status: Website Care recovery proof under `LowcountryDigitalWorks/business-operations#572` and repository issue #67.

Recovery class: `STATIC_GIT_MANAGED`

Overall assurance: **PARTIAL**

- Source / clean-build recovery: **VERIFIED by repository CI when the recovery-readiness contract passes on the exact candidate**.
- Repository-driven redeploy path: **VERIFIED as the accepted documented deployment method**.
- Production-only Secure Share secret recovery: **UNVERIFIED** until the separately controlled secret-recovery location/process is confirmed without exposing the secret value.

This record describes how to recover the website. It does not authorize a production rollback, Cloudflare account change, secret change, DNS change, or bypass of normal release gates.

## What must be recoverable

The public website is primarily reproducible from versioned source. The durable source set is:

- repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`;
- production source branch: `main`;
- committed `package-lock.json` for deterministic dependency resolution;
- Astro source and static assets;
- `worker.js` for the small Cloudflare Worker boundary;
- `wrangler.jsonc` for source-controlled Worker/static-assets configuration;
- repository deployment and validation documentation.

The site has no application database or CMS state that must be restored to reproduce the ordinary public pages.

One production-only runtime value is intentionally outside Git: the Cloudflare Worker Secret named `SECURE_SHARE_DESTINATION_URL`. The secret value must never be copied into this document, GitHub issues, CI logs, screenshots, chat, or repository files.

## Accepted build and deployment relationship

Current accepted repository contract:

1. clean checkout of an accepted `main` commit;
2. `npm ci` from the committed lockfile;
3. `npm run build` creates `dist/`;
4. normal repository validation/tests pass;
5. Cloudflare Workers Builds uses production branch `main`;
6. production deployment uses `npx wrangler deploy` for Worker project `lowcountrydigitalworks`;
7. non-production branches may receive Cloudflare preview/version builds through the existing provider-controlled build relationship.

`docs/deployment.md` remains the detailed deployment authority. This recovery record must not silently diverge from it.

## Recovery modes

### Bad application/source release

Preferred source recovery:

1. identify the last accepted known-good commit from Git history and release/PR evidence;
2. create a normal revert/correction from current `main` without rewriting protected history;
3. run the complete current validation/security/review gates;
4. merge only under the normal website release authority;
5. allow the accepted Cloudflare production deployment path to deploy the corrected `main`;
6. perform post-deploy production smoke and applicable critical-journey/security verification.

Do not force-push `main` or bypass review merely because the change is called a rollback.

### Deployment/version problem with source still good

The baseline recovery path is **redeploy the accepted source through the normal documented Cloudflare deployment relationship**.

Cloudflare may expose provider-native deployment/version rollback controls, but Web Care does not depend on an unverified dashboard feature for this recovery proof. A provider-native rollback may be used only after current live capability, target version, authority, validation, and rollback-of-the-rollback are confirmed.

### Repository/source loss on one workstation

A local workstation is not authoritative. Recover from the GitHub repository/history using the accepted commit/ref, then perform a clean lockfile install and build. No hidden local source is required for ordinary public pages.

### Secure Share runtime-secret loss

Repository/source recovery alone cannot reconstruct the production value of `SECURE_SHARE_DESTINATION_URL` by design.

To promote overall recovery assurance from PARTIAL to VERIFIED, an authorized owner must confirm—without placing the secret value in GitHub—that:

- a current approved recovery source/path for the secret exists;
- the recovery owner is known;
- access/recovery does not depend solely on one unavailable person/device;
- the value can be re-entered through the accepted protected Cloudflare secret-entry path;
- post-recovery `/share/` and `/share/continue` validation can be performed under the normal consequential configuration gate.

Until then, loss of that secret can leave the ordinary public website recoverable while the Secure Share transition remains fail-closed/unavailable.

## Known-good reference

Do not hard-code one forever-known-good commit in this document. The current accepted production reference is resolved at incident/recovery time from protected `main`, accepted PR/release evidence, and production verification.

A candidate becomes a recovery reference only after its normal tests, security checks, review, merge/deploy authority, and post-deploy checks have been satisfied.

## Recovery validation evidence

Normal CI should continuously prove the non-destructive parts of recovery readiness:

- committed lockfile exists;
- expected build script remains present;
- `worker.js` and `wrangler.jsonc` remain present;
- Worker/static-assets identity remains the accepted source-controlled relationship;
- `npm ci` succeeds;
- `npm run build` succeeds and produces `dist/index.html`;
- deployment documentation still declares production branch `main` and the accepted build/deploy commands;
- this record continues to expose any external secret-recovery dependency rather than reporting false green.

The recovery-readiness check is assurance evidence, not permission to deploy.

## Incident and authority boundary

Website Care recovery assurance is not a 24x7 incident-response promise and does not authorize destructive testing.

Stop/escalate under existing authority for:

- suspected compromise or malicious account takeover;
- Cloudflare/GitHub account recovery or MFA changes;
- DNS/domain/email changes;
- production secret creation/change/deletion;
- destructive rollback or data loss;
- billing/terms/account-owner changes;
- any customer/private/regulated data boundary.

## Current proof disposition

The static/Git-managed recovery class is suitable for Web Care when clean CI confirms the source/build contract and this runbook remains current.

Current overall result remains **PARTIAL**, not VERIFIED, because the production-only Secure Share secret-recovery path has not been independently confirmed in this repository-safe proof.

No additional backup SaaS, database backup, or manual monthly download is justified for this architecture merely to create a checklist item.
