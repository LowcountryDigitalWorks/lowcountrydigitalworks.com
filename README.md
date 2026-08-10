# Lowcountry Digital Works Website

Public source repository for the Lowcountry Digital Works website at [lowcountrydigitalworks.com](https://lowcountrydigitalworks.com).

## Status

The repository contains a lightweight static bootstrap configured for Cloudflare Workers Static Assets. A Cloudflare deployment of this repository and the Release 0.2 pull-request commit was previously confirmed successful, but as of 2026-08-10 the expected Worker/application is no longer visible in the Lowcountry Digital Works Cloudflare account and the live platform state requires read-only re-verification before further deployment or DNS work. Zoho Mail remains the email provider and must not be disrupted during website or DNS work.

The permanent visual identity is maintained by a separate brand-design workstream. Until approved production assets are merged, the site uses a temporary text wordmark and centralized placeholder colors.

## Ownership

- Business: **Lowcountry Digital Works**
- GitHub organization: **`LowcountryDigitalWorks`**
- Primary business GitHub identity: **`Eddie-LowcountryDigitalWorks`**
- Primary business email: **`eddie@lowcountrydigitalworks.com`**
- Registrar: **Porkbun**
- Email provider: **Zoho Mail**
- Intended website platform: **Cloudflare Workers Static Assets**

Company-owned repositories and infrastructure should remain organization-owned. Individual accounts receive named, role-based access rather than owning company assets.

## Architecture

The launch architecture is intentionally static-first:

- static HTML and CSS;
- Cloudflare Workers Static Assets;
- no database, CMS, authentication service, analytics, or server-side rendering;
- minimal client-side JavaScript only when a specific need justifies it;
- future Worker endpoints added only for approved dynamic capabilities;
- planned migration to Astro when reusable layouts and content structure provide a clear maintenance benefit.

See [docs/architecture.md](docs/architecture.md) and the [architecture decisions](docs/decisions/).

## Local validation

The current quality baseline has no third-party runtime dependencies.

```bash
python scripts/validate_repository.py
```

The validator checks repository structure, HTML metadata and landmarks, internal links and anchors, Cloudflare configuration, security headers, sitemap/robots consistency, and obvious secret patterns.

## Documentation

Start with [docs/README.md](docs/README.md).

Key documents include:

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [DNS and email preservation](docs/dns-email-preservation.md)
- [Rollback and recovery](docs/rollback-recovery.md)
- [Testing](docs/testing.md)
- [Release process](docs/release-process.md)
- [Organization operating model](docs/governance/organization-model.md)
- [Repository standards](docs/governance/repository-standards.md)

## Change control

Meaningful changes should use a branch and pull request. Pull requests should:

1. explain the purpose and scope;
2. identify user, security, privacy, infrastructure, and cost impact;
3. include applicable validation results;
4. document rollback for consequential changes;
5. avoid combining unrelated work.

DNS, email, domain, billing, payment, account-access, and destructive changes require a current-state inventory, proposed-state record, rollback plan, and Eddie's explicit approval.

## Security and privacy

Do not commit credentials, MFA material, recovery information, private keys, API tokens, payment data, customer data, PHI, or client secrets.

The launch site uses no analytics, nonessential cookies, contact-form processor, payment processor, or server-side customer-data storage.

See [SECURITY.md](SECURITY.md).

## License

No open-source license has been granted. See [LICENSE.md](LICENSE.md).
