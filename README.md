# Lowcountry Digital Works Website

Public source repository for the Lowcountry Digital Works website at [lowcountrydigitalworks.com](https://lowcountrydigitalworks.com).

## Status

Release 0.4 builds on the permanent Astro/Tidal Framework foundation with richer public content, restrained visual polish, and a repository-controlled content layer for routine copy edits. The deployment target remains Cloudflare Workers Static Assets.

Cloudflare account access and the existing Worker context were re-verified on 2026-08-10 before production launch. No duplicate Worker or replacement DNS infrastructure was created. Zoho Mail remains the email provider and must not be disrupted by website changes.

## Ownership

- Business: **Lowcountry Digital Works**
- GitHub organization: **`LowcountryDigitalWorks`**
- Primary business GitHub identity: **`Eddie-LowcountryDigitalWorks`**
- Primary business email: **`eddie@lowcountrydigitalworks.com`**
- Registrar: **Porkbun**
- Email provider: **Zoho Mail**
- Website platform: **Cloudflare Workers Static Assets**

Company-owned repositories and infrastructure remain organization-owned. Individual accounts receive named, role-based access rather than owning company assets.

## Architecture

- Astro static output to `dist/`;
- Cloudflare Workers Static Assets;
- repository-controlled public copy under `src/data/`;
- no React or browser application framework;
- no database, CMS, authentication, analytics, or server-side customer-data processing;
- no public contact form;
- minimal client-side JavaScript;
- production brand assets under `brand/`;
- approved UX/design guidance under `design/`.

See [docs/architecture.md](docs/architecture.md).

## Editing website content

Routine business copy is separated from page structure. Edit the JSON files under `src/data/` through a branch and pull request, then use the normal CI and Cloudflare branch preview before merge.

See [docs/content-editing.md](docs/content-editing.md).

Pages CMS is only a future candidate for a friendlier editing UI. It is not currently installed or authorized because its GitHub App permissions and protected-main workflow must be reviewed separately first.

## Development

Requires Node.js 22+ and Python 3.12 for the repository validator.

```bash
npm install
npm run build
python scripts/validate_repository.py
npx playwright install chromium
npm run test:e2e
```

Once the initial lockfile strategy is finalized in the repository, normal clean installs should use the documented authoritative install command.

## Brand and UX authority

Raw production brand values come from `brand/colors.json` and `brand/css/brand-tokens.css`. Semantic UI tokens, spacing, layout, and application-theme guidance are under `design/`. Production logos are never altered with translucent/watermark opacity treatments.

## Change control

`main` is protected by the `LDW main governance baseline` ruleset. Meaningful changes use pull requests, the required `validate` check, resolved review conversations, and squash merge.

DNS, email, domain, billing, account-access, production-launch, and destructive changes retain separate approval gates.

## Security and privacy

Do not commit credentials, MFA material, recovery information, private keys, API tokens, payment data, customer data, PHI, or client secrets. The public site has no analytics, nonessential cookies, contact-form processor, payment processor, or customer account system.

See [SECURITY.md](SECURITY.md).

## License

No open-source license has been granted. See [LICENSE.md](LICENSE.md).
