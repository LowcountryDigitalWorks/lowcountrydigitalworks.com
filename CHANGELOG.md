# Changelog

All notable repository and website changes are recorded here.

## [Unreleased]

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
