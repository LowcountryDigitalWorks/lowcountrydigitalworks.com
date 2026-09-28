# Website Architecture

## Goals

Fast, accessible, secure, low-cost, portable, and straightforward to maintain. Infrastructure is added only for a concrete requirement.

## Current architecture

- Source owner: `LowcountryDigitalWorks` GitHub organization
- Repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`
- Framework: Astro, static output
- Build output: `dist/`
- Hosting target: Cloudflare Workers Static Assets
- Worker project name: `lowcountrydigitalworks`
- Runtime entrypoint: dependency-free middleware in `worker.js`
- Production branch: `main`
- Public business content: repository-controlled JSON under `src/data/`
- Selected work and technology content: `src/data/work.json`
- Page structure/presentation: Astro under `src/pages/`, shared components, and `src/styles/`
- Technology marks: same-origin static SVG files under `public/technology/`
- Database: none
- Server-side application backend: none; selected HTML responses pass through bounded Worker middleware and Secure Share adds one fixed redirect transition
- Analytics/nonessential cookies: none
- Contact processing: none; email links only
- Payment processing: none
- CMS/authentication/customer portal: none

Astro is used as a maintainability/build layer, not as a browser application framework. Current pages require no client-side application JavaScript.

Workers Static Assets remains the delivery foundation. For public page routes, the Worker first calls `env.ASSETS.fetch(request)`. It changes only an actual HTML response with the expected repository-owned CSP, adding one fresh per-response nonce source to `script-src`. Missing or ambiguous CSP input is returned unchanged. Redirects and non-HTML responses are returned unchanged.

Selective `run_worker_first` patterns cover the current static marketing HTML routes, including `/connect/`, the five service-detail routes, the four Work detail routes, the existing top-level marketing routes, `/share/`, and `/share/continue`. The custom 404, content-hashed `/_astro/*` files, fonts, images, SVGs, favicons, technology marks, vCard, `robots.txt`, and `sitemap.xml` remain direct Static Assets requests.

## Secure Share

Release 0.6 adds the canonical LDW Secure Share entry point at `/share/` while preserving the static-site architecture.

The public `/share/` page is an LDW-branded operational warning/information page. It is omitted from ordinary marketing navigation and the sitemap and uses `noindex,noarchive`. These indexing controls reduce discovery noise; they are not a security boundary.

The page CTA points only to the same-origin Worker route `/share/continue`. That route never accepts a caller-provided destination. The Worker reads only the runtime `SECURE_SHARE_DESTINATION_URL` binding, validates HTTPS and the exact approved `share.lowcountrydigitalworks.com` hostname, rejects credential-bearing or nonstandard-port URLs, and then returns a temporary redirect. Missing or invalid configuration fails closed with a generic 503 response.

The tokenized Secure Share destination is not stored in Git, Astro source, generated HTML, browser JavaScript, tests, or public documentation. Production uses a Cloudflare Worker Secret so destination rotation does not require changing public website source. The redirect sends the browser to the existing portal; LDW does not proxy or store the submitted secret/file content in this website architecture.

Routine copy changes should normally update `src/data/*.json` rather than page markup. The protected-main pull-request, validation, preview, and squash-merge workflow still applies to content changes. See `docs/content-editing.md`.

## Public information architecture

WEB-UX-001 extends the static route set without changing the runtime architecture:

- `/connect/` is the stable QR/business-card contact destination;
- five focused `/services/<slug>/` pages provide useful service depth without thin location/keyword pages;
- four `/work/<slug>/` pages provide truthful status, evidence, and boundary context;
- `/contact/` remains a direct-contact route;
- `/share/` remains operationally separate from ordinary marketing navigation.

Structured data uses schema.org microdata attached to visible content rather than an inline JSON-LD script. This preserves the current strict CSP without adding runtime HTML rewriting merely for metadata.

## Work and technology presentation

The Work presentation deliberately distinguishes live work, products in active development, and G.A.S. as internal service-enabling evidence infrastructure so the website does not imply completed client engagements or customer SaaS that do not exist.

Technology marks are stored locally and have no third-party runtime dependency. They are descriptive identifiers only and do not imply sponsorship, partnership, certification, or endorsement. See `docs/technology-marks.md`.

## Brand and design

Production Brand Package v2 under `brand/` is authoritative for raw brand colors and logo/icon masters. `design/` holds the reconciled semantic UX system. The production logo must not be altered with opacity/transparency.

Release 0.6 keeps Secure Share within the established Tidal Framework system; it does not reopen the mark, palette, typography direction, or production brand package.

## Optional content editing UI

Pages CMS is being evaluated only as an optional editing layer over the GitHub-backed content files. It is not currently installed or authorized and is not part of the production runtime. Any GitHub App installation requires separate permissions review and explicit approval, including confirmation that protected-main pull-request governance remains intact.

## Dynamic capabilities

The Worker remains deliberately small and is not a general application backend. Its bounded dynamic responsibilities are CSP nonce compatibility for selected HTML and the fixed Secure Share transition. Any future Worker endpoint for forms, payments, authentication, portals, arbitrary redirects, or other data processing requires a separate architecture decision covering data flow, privacy, security, retention, vendor cost, failure handling, and rollback.
