# Deployment

## Target

Cloudflare Workers Static Assets remains the platform, using Worker project name `lowcountrydigitalworks` and repository production branch `main`. Astro builds static output to `dist/`, which `wrangler.jsonc` deploys.

## Repository-controlled configuration

- build: `npm run build`
- output: `dist/`
- deploy command: `npx wrangler deploy`
- Worker name: `lowcountrydigitalworks`

## Cloudflare Workers Builds

Cloudflare Workers Builds runs an optional build command followed by the deploy command. Framework output such as Astro therefore requires the Worker build configuration to run `npm run build` before `npx wrangler deploy`. Cloudflare documents this under Worker **Settings > Build**.

Cloudflare account access and the existing Worker context were re-verified on 2026-08-10 before Release 0.3 production launch. Do not create a duplicate Worker to work around an authentication/session issue.

If a Release 0.3 preview build fails because the build command is not configured, record the existing Build setting, set the Build command to `npm run build`, keep the Deploy command `npx wrangler deploy`, and use the prior Build setting as rollback. This is a Cloudflare configuration change and must remain documented.

## Deployment workflow

1. Create a focused branch from current `main`.
2. Validate build, repository rules, browser/accessibility tests, and dependency audit.
3. Open a pull request.
4. Review the Cloudflare branch build/preview result.
5. Resolve check failures and review conversations.
6. Obtain the production-launch approval checkpoint.
7. Squash merge through the protected branch ruleset.
8. Confirm the production build and validate the production URL, 404, navigation, metadata, and critical links.
9. Record release state.

Do not store Cloudflare account IDs, API tokens, secrets, or recovery data in the public repository.
