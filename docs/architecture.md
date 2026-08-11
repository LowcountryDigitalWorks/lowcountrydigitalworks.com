# Website Architecture

## Goals

Fast, accessible, secure, low-cost, portable, and straightforward to maintain. Infrastructure is added only for a concrete requirement.

## Release 0.4 architecture

- Source owner: `LowcountryDigitalWorks` GitHub organization
- Repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`
- Framework: Astro, static output
- Build output: `dist/`
- Hosting target: Cloudflare Workers Static Assets
- Worker project name: `lowcountrydigitalworks`
- Production branch: `main`
- Public business content: repository-controlled JSON under `src/data/`
- Page structure/presentation: Astro under `src/pages/`, shared components, and `src/styles/`
- Database: none
- Server-side application code: none
- Analytics/nonessential cookies: none
- Contact processing: none; email links only
- Payment processing: none
- CMS/authentication/customer portal: none

Astro is used as a maintainability/build layer, not as a browser application framework. Current pages require no client-side application JavaScript.

Routine copy changes should normally update `src/data/*.json` rather than page markup. The protected-main pull-request, validation, preview, and squash-merge workflow still applies to content changes. See `docs/content-editing.md`.

## Brand and design

Production Brand Package v2 under `brand/` is authoritative for raw brand colors and logo/icon masters. `design/` holds the reconciled semantic UX system. The production logo must not be altered with opacity/transparency.

Release 0.4 adds content-density and presentation polish within that established system; it does not reopen the Tidal Framework mark, palette, typography direction, or production brand package.

## Optional content editing UI

Pages CMS is being evaluated only as an optional editing layer over the GitHub-backed content files. It is not currently installed or authorized and is not part of the production runtime. Any GitHub App installation requires separate permissions review and explicit approval, including confirmation that protected-main pull-request governance remains intact.

## Dynamic capabilities

Any future Worker endpoint for forms, payments, authentication, portals, or other data processing requires a separate architecture decision covering data flow, privacy, security, retention, vendor cost, failure handling, and rollback.
