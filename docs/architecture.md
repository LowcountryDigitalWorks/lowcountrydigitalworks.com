# Website Architecture

## Goals

Fast, accessible, secure, low-cost, portable, and straightforward to maintain. Infrastructure is added only for a concrete requirement.

## Release 0.3 architecture

- Source owner: `LowcountryDigitalWorks` GitHub organization
- Repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`
- Framework: Astro, static output
- Build output: `dist/`
- Hosting target: Cloudflare Workers Static Assets
- Worker project name: `lowcountrydigitalworks`
- Production branch: `main`
- Database: none
- Server-side application code: none
- Analytics/nonessential cookies: none
- Contact processing: none; email links only
- Payment processing: none
- CMS/authentication/customer portal: none

Astro is used as a maintainability/build layer, not as a browser application framework. Current pages require no client-side application JavaScript.

## Brand and design

Production Brand Package v2 under `brand/` is authoritative for raw brand colors and logo/icon masters. `design/` holds the reconciled semantic UX system. The production logo must not be altered with opacity/transparency.

## Dynamic capabilities

Any future Worker endpoint for forms, payments, authentication, portals, or other data processing requires a separate architecture decision covering data flow, privacy, security, retention, vendor cost, failure handling, and rollback.
