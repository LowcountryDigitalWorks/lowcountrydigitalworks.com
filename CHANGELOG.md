# Changelog

All notable repository and website changes are recorded here.

## [Unreleased]

## [0.5.1] - 2026-08-11

### Added

- Public Lowcountry Digital Works business phone contact: `843-633-3123`.
- Separate **Call** and **Text** actions on the Contact page using standard `tel:` and `sms:` links.
- Business phone display in the site footer.
- Browser regression coverage confirming the email, phone, call/text links, footer phone, and no-public-form boundary.

### Changed

- `src/data/contact.json` is now the single repository-controlled source for both the public email address and business phone contact data.
- Website package version advanced to `0.5.1`.

### Security / privacy / cost

- The phone number is intentionally public business contact information; no private personal number is introduced.
- No contact form, message processor, analytics, tracking, database, authentication, or new runtime service is added.
- No DNS, email-routing, Cloudflare-account, or billing change is introduced.
- New recurring cost: **$0**.

## [0.5.0] - 2026-08-11

### Added

- New public **Work** page with truthful status labels for the live Lowcountry Digital Works website and LDW products in active development.
- Document Control and Secure Exchange selected-work summaries, with Secure Exchange explicitly described as active development whose production infrastructure is not yet provisioned.
- Home-page selected-work and technology sections.
- Locally hosted monochrome technology marks for GitHub, Cloudflare, Astro, TypeScript, and Python.
- `docs/technology-marks.md` documenting icon source, trademark limits, same-origin delivery, and the no-endorsement boundary.
- Browser regression coverage for Work-page status labels and same-origin technology marks.

### Changed

- Primary navigation now includes Work.
- `src/data/work.json` provides repository-controlled editing for selected work and technology descriptions.
- Sitemap, repository validator, content-editing documentation, and architecture documentation now include the Work page and technology assets.
- Website package version advanced to `0.5.0`.

### Security / privacy / cost

- Technology images are served from the LDW origin; no third-party image CDN, analytics, tracker, CMS, database, authentication, or new runtime service is introduced.
- No production Secure Exchange infrastructure or sensitive-data processing is implied or introduced by the public product description.
- New recurring cost: **$0**.

## [0.4.0] - 2026-08-11

### Added

- Repository-controlled editable content files under `src/data/` for Home, Services, Approach, About, and Contact copy.
- Richer Home-page context covering common project starting points, delivery expectations, and the LDW ownership/cost/handoff model.
- Concrete examples beneath each service area plus clearer ways a project can begin.
- Additional About, Approach, and Contact context without inventing clients, staff, history, certifications, or business scale.
- `docs/content-editing.md` with the protected-branch GitHub web-edit workflow and the future Pages CMS evaluation boundary.

### Changed

- Public pages now separate routine business copy from Astro layout code so ordinary content changes do not require editing page structure.
- Visual presentation gains a restrained branded hero treatment, trust/principle chips, accent cards, structured lists, stronger section hierarchy, and responsive callout layouts while preserving the approved Tidal Framework direction.
- Website package version advanced to `0.4.0`.

### Security / cost

- No CMS, database, authentication, analytics, form processor, new runtime service, or paid SaaS is introduced.
- Pages CMS remains an optional future editing UI pending a separate GitHub App permissions and protected-main workflow review.
- New recurring cost: **$0**.

## [0.3.1] - 2026-08-11

### Changed

- **UX-01:** reduced service/about card `h2` sizing to a card-specific 23–28px responsive scale so wide desktop card grids remain scannable without changing page/section heading hierarchy.
- **UX-02:** added privacy-preserving self-hosted Manrope Variable delivery through pinned `@fontsource-variable/manrope` `5.3.0`; no Google Fonts/CDN request or CSP relaxation is introduced.
- Brand typography tokens now prefer the actually delivered `Manrope Variable` family while retaining the approved Manrope/Source Sans 3/Inter/system fallback stack.

### Validation

- Added browser regression coverage confirming Manrope is available from same-origin resources and used as the lead interface font.
- Added desktop regression coverage keeping service-card heading scale at or below 28px.

## [0.3.0] - 2026-08-10

### Added

- Astro static-site foundation with Home, Services, Approach, About, Contact, Privacy / Website Use, and 404 routes.
- Production Brand Package v2 masters, browser/icon exports, social preview, and brand metadata.
- Reconciled UX/design documentation and durable production brand validation.
- Playwright browser, responsive, and axe-core accessibility tests.
- npm dependency management and expanded repository validation.

### Changed

- Cloudflare asset output from the bootstrap `public/` HTML to Astro `dist/`.
- Production logo usage replaces the temporary text wordmark and retires the translucent watermark treatment.
- Raw brand colors now come from the production brand token files.
- Dependabot covers npm as well as GitHub Actions and no longer requests a nonexistent label.
- Cloudflare account/Worker access was re-verified before production launch without recreating infrastructure.

### Remaining infrastructure

- Complete any remaining custom-domain/DNS validation separately under the protected infrastructure change process.
- Recreate/recover the non-Gmail Google services identity separately; Zoho email hosting remains unchanged.

## [0.2.0] - 2026-08-07

### Added

- Repository governance and documentation structure.
- Architecture decision records for hosting, static-first delivery, analytics, contact processing, and payments.
- Pull-request and issue templates.
- CODEOWNERS and Dependabot configuration for GitHub Actions.
- Dependency-free repository validation script and GitHub Actions workflow.
- Sitemap and robots consistency baseline.
- Public organization and repository operating-model drafts.
- Credential-pattern validation compatible with current and stateless GitHub App installation tokens.
- Public ownership documentation that keeps detailed temporary recovery-owner inventory private.

## [0.1.0] - 2026-08-07

### Added

- Initial static business-site bootstrap.
- Cloudflare Workers Static Assets configuration.
- Security headers, robots file, favicon, and custom 404 page.
- Initial Workers deployment at `lowcountrydigitalworks.eddie-78a.workers.dev`.
