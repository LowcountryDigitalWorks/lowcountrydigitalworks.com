# Website Architecture

## Goals

Fast, accessible, secure, low-cost, portable, and straightforward to maintain. Infrastructure is added only for a concrete requirement.

## Release 0.5 architecture

- Source owner: `LowcountryDigitalWorks` GitHub organization
- Repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`
- Framework: Astro, static output
- Build output: `dist/`
- Hosting target: Cloudflare Workers Static Assets
- Worker project name: `lowcountrydigitalworks`
- Runtime entrypoint: dependency-free CSP nonce middleware in `worker.js`
- Production branch: `main`
- Public business content: repository-controlled JSON under `src/data/`
- Selected work and technology content: `src/data/work.json`
- Page structure/presentation: Astro under `src/pages/`, shared components, and `src/styles/`
- Technology marks: same-origin static SVG files under `public/technology/`
- Database: none
- Server-side application backend: none; selected HTML responses pass through the bounded nonce middleware
- Analytics/nonessential cookies: none
- Contact processing: none; email links only
- Payment processing: none
- CMS/authentication/customer portal: none

Astro is used as a maintainability/build layer, not as a browser application framework. Current pages require no client-side application JavaScript.

Workers Static Assets remains the delivery foundation. For the seven public page routes and direct `/404.html` requests, the Worker first calls `env.ASSETS.fetch(request)`. It changes only an actual HTML response with the expected repository-owned CSP, adding one fresh per-response nonce source to `script-src`. Missing or ambiguous CSP input is returned unchanged. Redirects and non-HTML responses are returned unchanged.

Selective `run_worker_first` patterns cover `/`, `/404.html`, and the trailing-slash page families under `/about/`, `/approach/`, `/contact/`, `/privacy/`, `/services/`, and `/work/`. Content-hashed `/_astro/*` files, fonts, images, SVGs, favicons, technology marks, `robots.txt`, and `sitemap.xml` do not match these patterns and remain direct Static Assets requests.

Routine copy changes should normally update `src/data/*.json` rather than page markup. The protected-main pull-request, validation, preview, and squash-merge workflow still applies to content changes. See `docs/content-editing.md`.

## Work and technology presentation

Release 0.5 adds a public Work page and a Home-page work/technology summary. It deliberately distinguishes live work from products in active development so the website does not imply completed client engagements that do not exist.

Technology marks are stored locally and have no third-party runtime dependency. They are descriptive identifiers only and do not imply sponsorship, partnership, certification, or endorsement. See `docs/technology-marks.md`.

## Brand and design

Production Brand Package v2 under `brand/` is authoritative for raw brand colors and logo/icon masters. `design/` holds the reconciled semantic UX system. The production logo must not be altered with opacity/transparency.

Release 0.5 extends content density and presentation within the established Tidal Framework system; it does not reopen the mark, palette, typography direction, or production brand package.

## Optional content editing UI

Pages CMS is being evaluated only as an optional editing layer over the GitHub-backed content files. It is not currently installed or authorized and is not part of the production runtime. Any GitHub App installation requires separate permissions review and explicit approval, including confirmation that protected-main pull-request governance remains intact.

## Dynamic capabilities

The nonce middleware is not an application backend and must remain removable and self-contained. Any future Worker endpoint for forms, payments, authentication, portals, or other data processing requires a separate architecture decision covering data flow, privacy, security, retention, vendor cost, failure handling, and rollback.
