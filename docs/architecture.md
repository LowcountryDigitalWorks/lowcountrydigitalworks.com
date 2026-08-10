# Website Architecture

## Goals

The website should be fast, accessible, secure, low-cost, portable, and straightforward to maintain. It must support future business needs without introducing unnecessary infrastructure before those needs exist.

## Current architecture

- Source owner: `LowcountryDigitalWorks` GitHub organization
- Repository: `LowcountryDigitalWorks/lowcountrydigitalworks.com`
- Hosting: Cloudflare Workers Static Assets
- Worker project: `lowcountrydigitalworks`
- Production branch: `main`
- Current asset directory: `public/`
- Database: none
- Server-side application code: none
- Analytics and nonessential cookies: none
- Contact processing: none; email links only
- Payment processing: none

## Near-term evolution

The bootstrap may be converted to Astro static output when the permanent multi-page content structure and approved brand system are ready. Astro would generate static files into `dist/`, while the same Cloudflare Worker project and custom domain can remain in place.

## Dynamic capabilities

Future Worker endpoints may be added for narrowly justified needs such as contact-form submission, hosted-payment session creation, signed payment webhooks, or a customer portal. Each capability requires a separate architecture decision covering data flow, privacy, security, retention, vendor cost, failure handling, and rollback.

## Explicit non-goals at launch

- React or another browser application framework
- server-side rendering
- database or durable storage
- CMS
- authentication service
- customer portal
- payment processing
- analytics or advertising trackers
- server-side contact form
