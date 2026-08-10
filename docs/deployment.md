# Deployment

## Production

The intended production platform is Cloudflare Workers Static Assets using the Worker project name `lowcountrydigitalworks` and repository production branch `main`.

A deployment of the website bootstrap and a deployment of Release 0.2 commit `4d7d5f5c8844c642217d13f171c90fe2a313b2a3` were previously confirmed successful through the GitHub/Cloudflare integration. As of 2026-08-10, the expected Worker/application is no longer visible in the Lowcountry Digital Works Cloudflare account. Treat the current Cloudflare platform state as unverified until the account and Worker configuration are inspected read-only. Do not recreate or change infrastructure from assumption.

Repository bootstrap configuration:

- build command: none
- deploy command: `npx wrangler deploy`
- asset directory: `./public`
- last-known Worker preview: `https://lowcountrydigitalworks.eddie-78a.workers.dev/`
- non-production branch builds: previously enabled

## Deployment workflow

1. Create a focused branch from current `main`.
2. Make and validate changes.
3. Open a pull request.
4. Review the diff and applicable preview deployment when the Cloudflare integration is verified available.
5. Resolve failed checks and review conversations.
6. Merge through the repository's approved merge method.
7. Confirm Cloudflare's production build succeeded when deployment infrastructure is available.
8. Validate the production URL and critical links.
9. Record notable changes in `CHANGELOG.md`.

## Configuration ownership

The repository owns deployable configuration such as `wrangler.jsonc`. Cloudflare dashboard settings should be documented here when they cannot be represented safely in source control.

Do not store Cloudflare account IDs, API tokens, secrets, or recovery data in the public repository.
