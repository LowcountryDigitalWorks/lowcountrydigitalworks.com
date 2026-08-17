# Deployment

## Target

Cloudflare Workers Static Assets remains the platform, using Worker project name `lowcountrydigitalworks` and repository production branch `main`. Astro builds static output to `dist/`, which `wrangler.jsonc` deploys.

Release 0.5.4 adds a plain JavaScript Worker entrypoint only for CSP nonce compatibility on selected HTML routes. The Worker retrieves the existing build through the `ASSETS` binding; Astro output remains static and there is no SSR adapter or application framework runtime.

## Repository-controlled configuration

- build: `npm run build`
- output: `dist/`
- production deploy command: `npx wrangler deploy`
- Worker name: `lowcountrydigitalworks`
- Worker entrypoint: `worker.js`
- Static Assets binding: `ASSETS`

## Selective Worker invocation

`assets.run_worker_first` is limited to:

- `/`
- `/about/*`
- `/approach/*`
- `/contact/*`
- `/privacy/*`
- `/services/*`
- `/work/*`

Those page requests consume Worker invocations and make one internal `ASSETS.fetch()` call. The custom 404 and ordinary static files—including `/_astro/*`, font files, images and SVGs, favicons, technology marks, `robots.txt`, and `sitemap.xml`—do not match and remain direct Static Assets requests. For this small marketing site, the expected invocation footprint is page traffic only. The Workers Free plan currently permits 100,000 Worker requests per day; direct static asset requests are free and unlimited. No paid Workers plan or new recurring subscription is required.

## Cloudflare Workers Builds

Release 0.3 established the following verified dashboard-controlled build configuration:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Version command: `npm run build && npx wrangler versions upload`
- Root directory: `/`
- Production branch: `main`
- Builds for non-production branches: enabled

The composite Version command is intentional. During the Release 0.3 rollout, Cloudflare's non-production trigger reported `Build command: None` even though the project-level Build command was saved. Running the Astro build directly in the Version command guarantees that `dist/` exists before a preview version is uploaded. Production continues to use the normal Build command followed by `npx wrangler deploy`.

Rollback for the preview-specific workaround is to restore the Version command to `npx wrangler versions upload` after verifying that Cloudflare's non-production trigger independently executes `npm run build`.

Cloudflare account access and the existing Worker context were re-verified before Release 0.3 production launch. No duplicate Worker was created and no DNS or email-routing change was required.

## Analytics and CSP

The public site intentionally does not use analytics or tracking. The repository CSP therefore does not permit Cloudflare Web Analytics/RUM, Google Fonts, or other third-party script/style/font origins.

Cloudflare Web Analytics/RUM automatic injection should remain disabled unless analytics is separately approved. If `static.cloudflareinsights.com/beacon.min.js` appears in the browser console, disable the Web Analytics/RUM automatic setup in Cloudflare rather than weakening the repository CSP to allow the beacon.

The site source uses local/system font fallbacks and does not require Google Fonts to render correctly.

## Deployment workflow

1. Create a focused branch from current `main`.
2. Validate build, repository rules, browser/accessibility tests, and dependency audit.
3. Open a pull request.
4. Review the Cloudflare branch build/preview result.
5. Resolve check failures and review conversations.
6. Obtain the production-launch approval checkpoint for consequential releases.
7. Squash merge through the protected branch ruleset.
8. Confirm the production build and validate the production URL, 404, navigation, metadata, and critical links.
9. Record release state.

For Release 0.5.4 rollback, revert its squash commit. That removes `worker.js`, the `main` and `ASSETS` binding additions, and selective `run_worker_first` configuration, returning page delivery to the Release 0.5.3 pure Static Assets model and its static CSP. Do not roll back the separately accepted Minimum TLS 1.2, Always Use HTTPS, or HSTS edge settings.

Do not store Cloudflare account IDs, API tokens, secrets, or recovery data in the public repository.
