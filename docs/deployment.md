# Deployment

## Production

Cloudflare Workers Builds deploys the repository's `main` branch to the Worker project `lowcountrydigitalworks`.

Current bootstrap configuration:

- build command: none
- deploy command: `npx wrangler deploy`
- asset directory: `./public`
- Worker preview: `https://lowcountrydigitalworks.eddie-78a.workers.dev/`
- non-production branch builds: enabled

## Deployment workflow

1. Create a focused branch from current `main`.
2. Make and validate changes.
3. Open a pull request.
4. Review the diff and applicable preview deployment.
5. Resolve failed checks and review conversations.
6. Merge through the repository's approved merge method.
7. Confirm Cloudflare's production build succeeded.
8. Validate the production URL and critical links.
9. Record notable changes in `CHANGELOG.md`.

## Configuration ownership

The repository owns deployable configuration such as `wrangler.jsonc`. Cloudflare dashboard settings should be documented here when they cannot be represented safely in source control.

Do not store Cloudflare account IDs, API tokens, secrets, or recovery data in the public repository.
