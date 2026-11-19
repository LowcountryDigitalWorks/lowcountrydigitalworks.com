# LDW-owned Site Audit — offline prospect intake contract (Stage 1.5)

**Status:** Source-only preparation under [Website #94](https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/issues/94). NOT a public live scanner, lead-capture form, email service, SEO product, customer deliverable, or production release. Website Delivery retains visual and deployment ownership for [the existing /website-check/ page](https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/issues/166).

## Product decision

LDW will build the URL-to-report acquisition workflow itself, rather than embed SellSEO. SellSEO Agency/Tier 2 is a historical reference and may be refunded by the owner; do not depend on it for scanning, form capture, lead exports or report delivery.

Intended visitor sequence, when separately authorized:

1. Visitor supplies a website URL and requests a **bounded public-site check**. The site is not assumed to belong to the submitter.
2. A useful limited preview shows **which source, timestamp, method and exact public surface** was examined, 1–2 supportable observations, and what is missing or blocked. No automatic global pass/fail, traffic or revenue claims.
3. Email address is required **only for the more complete report the visitor explicitly requests**. Optional marketing consent is independent, unchecked by default, and never a prerequisite to receiving requested transactional material. No phone or name requirement by default.
4. An independently approved delivery service sends one requested report or protected time-limited link, with a natural Discovery CTA, accessible layouts and transparent retention/deletion.

These four stages describe product intent, not functions present on the live site.

## What exists in this candidate

Only a **pure, synchronous, no-dependency contract**, `src/lib/prospect-intake-contract.mjs`, and adversarial unit tests appended to the existing `tests/worker-unit.mjs` so the existing `npm run test:worker` and `npm run validate` pipelines exercise it. Nothing imports this contract into the Website Check page, browser bundle, Worker route or production site.

- `normalizeProspectDisplayOrigin(string)`: accepts bare named DNS hosts or simple HTTPS homepage URLs with optional trailing slash; returns a normalized public-looking display **candidate**, explicitly `scanAuthorized: false` and `networkAuthorized: false`. It rejects schemes other than HTTPS, IP literals, non-ASCII/IDNA pending policy, local/reserved suffixes, ports, userinfo, paths, queries, fragments and control characters. It is deliberately stricter than normal URL entry: an excluded legitimate input should receive an explicit format explanation in a *future* accessible UI.
- `inspectRequestedReportEmailIntent({email, reportRequested, marketingOptIn?})`: validates a conservative ASCII email-format subset and the **separate explicit report intent**, returns no email string and has `emailRetained: false`, `emailDeliveryAuthorized: false`. Only an explicit boolean `marketingOptIn: true` changes opt-in. This check is **not consent capture**, address deliverability, identity verification, storage or actual sending.
- Both functions throw generic non-echoing input errors. They do not create/retain user records, perform DNS/fetch, contact providers or spend credits. They are **not** a security permit.

## Critical future network and authorization work (not implemented)

Syntax screening is **insufficient** to authorize fetching even if input ends in .com/.org. A hostile public domain can DNS-rebind to private/cloud metadata addresses; a public URL can redirect into loopback or IP literals. Before any on-demand check, the owning security/source lane must prove:

- Explicit target authority/robots/third-party terms appropriate to the scanner and purpose, and the difference between ordinary public HEAD/GET inspection versus full WQT crawler or penetration test.
- Runtime DNS resolution and all-address family validation, IP restrictions, rebinding-resistant connection/egress pinning, manual redirect revalidation or disabled redirects, HTTPS TLS host/SNI verification, and true isolated egress; no LDW Worker/Cloudflare dashboard permission inheritance.
- Small, fixed method/URL scope; real streamed content and header size caps, timeouts, limited concurrency/target frequency, daily resource ceilings, no retries or provider credits without approved budget. Respond `unavailable` or `over_capacity` rather than issuing unsafe scans.
- Adversarial testing of private/RFC1918/link-local/IPv6/cloud metadata, encoded numeric IPs, DNS changes, public-to-private redirects, oversized/slow bodies, compressed bombs and hostile markup. Neither a regular URL parser nor this prototype proves those properties.
- One isolated read-only operator-authorized Stage 2 run and source-provenance proof before public Stage 3 execution. Do not expose the WQT registry-based scanner as an anonymous arbitrary-URL service.
- If an abuse challenge is required, Cloudflare Turnstile must validate each request with **server-side Siteverify**, with bounded retry and hostname/action checks; front-end widget alone does not protect the operation.
- Approved minimal retention (24-hour max as a candidate, not accepted storage), unguessable noindex results, log inventory, report email consent/transactional provider credentials and deliverability, existing Client Operations source-of-truth, privacy notice, deletion, and separate affirmative marketing opt-in.
- Independent author-excluded security review, Website Product/Privacy/Owner UX decision and protected gate before any production endpoint, CRM/email write or customer/site scan.

Relevant official guidance: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [MDN SSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/SSRF), [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Product boundaries and release order

The **existing** public `/website-check/` stays intentionally noindex, serves the accepted LDW-owned saved 11 → 1 observation, and advertises no interactive URL scan/email form. The current Website Grok R5 preview is separate and must be visual-owner-approved with desktop/mobile screenshots, current immutable commit and accessibility/CSP tests. This contract must not add a dead "Run audit" CTA or silently alter the page.

WQT owns approved SiteOne/Lighthouse technical sensing and normalized evidence. G.A.S. owns internal evidence interpretation/report composition with strong missingness and source provenance. Neither gets unrestricted third-party network authority from this code. Business Operations / Client Operations own prospect-data practices and authorized report fulfillment. **No SellSEO vendor dependency** is allowed in the future production path.

This source-only branch/PR is authored by GAS ORCH27 but requires the independent Website Product owner and author-excluded source review. No live prospect submit, DNS lookup, email delivery, data persistence, paid infrastructure, deployed scanner or production change. Cost: $0/included.
