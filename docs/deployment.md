# Deployment

## Target

Cloudflare Workers Static Assets remains the platform, using Worker project name `lowcountrydigitalworks` and repository production branch `main`. Astro builds static output to `dist/`, which `wrangler.jsonc` deploys.

Release 0.5.4 added a plain JavaScript Worker entrypoint for CSP nonce compatibility on selected HTML routes. Release 0.6.0 keeps that same dependency-free Worker and adds one fixed Secure Share transition at `/share/continue`. Astro output remains static and there is no SSR adapter or application framework runtime.

## Repository-controlled configuration

- build: `npm run build`
- output: `dist/`
- production deploy command: `npx wrangler deploy`
- Worker name: `lowcountrydigitalworks`
- Worker entrypoint: `worker.js`
- Static Assets binding: `ASSETS`
- Secure Share destination binding name: `SECURE_SHARE_DESTINATION_URL` as a Cloudflare Worker Secret in production

The Secure Share secret value must never be committed to this repository, placed in Wrangler plaintext vars, exposed in generated HTML/browser JavaScript, or copied into public documentation. Local `.dev.vars` files are ignored and must contain only disposable test values when needed.

## Selective Worker invocation

`assets.run_worker_first` is limited to:

- `/`
- `/about/`
- `/approach/`
- `/contact/`
- `/privacy/`
- `/services/`
- `/share/`
- `/share/continue`
- `/work/`

The HTML page routes consume Worker invocations and make one internal `ASSETS.fetch()` call so the existing CSP nonce can be added. `/share/continue` is handled directly by the same Worker and does not fetch a static asset. No-slash page forms use direct Static Assets canonical redirects before the final exact HTML path invokes the Worker.

The custom 404, nested paths, and ordinary static files—including `/_astro/*`, font files, images and SVGs, favicons, technology marks, `robots.txt`, and `sitemap.xml`—do not match and remain direct Static Assets requests. For this small site, the expected invocation footprint remains page traffic plus deliberate Secure Share transitions. No paid Workers plan or new recurring subscription is required.

## Secure Share runtime configuration

The public `/share/` page contains only a same-origin CTA to `/share/continue`. The tokenized vendor destination is supplied at runtime through the Worker Secret named `SECURE_SHARE_DESTINATION_URL`.

The transition validates the configured URL before redirecting:

- protocol must be HTTPS;
- hostname must be exactly `share.lowcountrydigitalworks.com`;
- username/password components are rejected;
- nonstandard ports are rejected;
- caller-supplied query parameters do not control the destination.

If the secret is absent or invalid, `/share/continue` fails closed with HTTP 503. The redirect response uses temporary HTTP 302 plus `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex, noarchive`.

The production secret must be managed separately from the public Git workflow. Before adding, changing, or deleting it, inspect the current Worker secret-name state and use the normal consequential configuration gate: CURRENT STATE → PROPOSED STATE → VALIDATION → ROLLBACK → Eddie approval. Never print or record the secret value in GitHub, ChatGPT, ordinary tickets, logs, screenshots, or repository files.

A branch preview intentionally does not require the real production destination. `/share/` should render normally in preview; `/share/continue` may return the expected fail-closed 503 when no preview secret is configured. Unit tests use a fake value to validate the successful redirect path.

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
2. Validate build, repository rules, browser/accessibility tests, Worker unit tests, and dependency audit.
3. Open a pull request.
4. Review the Cloudflare branch build/preview result.
5. Resolve check failures and review conversations.
6. For Secure Share, independently review the candidate before any production secret mutation.
7. Inspect production secret-name state and prepare the exact Secure Share CURRENT/PROPOSED/VALIDATION/ROLLBACK gate.
8. After Eddie approval, set or rotate only `SECURE_SHARE_DESTINATION_URL` using a protected secret-entry path and validate the existing site remains healthy.
9. Squash merge through the protected branch ruleset.
10. Confirm the production build and validate `/share/`, `/share/continue`, existing routes, 404, metadata, CSP/JSD behavior, and critical links.
11. Record release state.

For Release 0.6.0 code rollback, revert its squash commit. If the Secure Share secret remains configured, the reverted 0.5.4 Worker ignores it. If the release is abandoned, remove only that exact secret through a separately approved Cloudflare secret deletion after code rollback. Preserve all unrelated TLS 1.2, Always Use HTTPS, HSTS, JSD, DNS, and email state.

Do not store Cloudflare account IDs, API tokens, secrets, tokenized Secure Share destinations, or recovery data in the public repository.
