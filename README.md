# Lowcountry Digital Works

Public source repository for the Lowcountry Digital Works website at
[lowcountrydigitalworks.com](https://lowcountrydigitalworks.com).

## Ownership

This repository is owned by the `LowcountryDigitalWorks` GitHub organization.

Primary business representative:

- Eddie Gugino
- eddie@lowcountrydigitalworks.com

Company-owned repositories and infrastructure should remain organization-owned.
Individual accounts receive named, role-based access rather than owning company assets.

## Current status

The website is in its initial planning and infrastructure phase.

No production website, Cloudflare deployment, custom-domain connection, contact-form
processor, payment integration, analytics system, or customer portal has been established
from this repository yet.

## Architecture direction

The initial website is expected to use:

- Astro with static output;
- accessible semantic HTML and centralized CSS design tokens;
- Cloudflare Workers Static Assets for deployment;
- minimal client-side JavaScript;
- no database, CMS, server-side rendering, or paid service without a documented requirement;
- optional Worker endpoints added later only where justified.

The architecture should support future contact, hosted-payment, webhook, and customer-portal
integrations without requiring the static website to be replaced.

## Repository principles

- Keep the website fast, accessible, secure, portable, and maintainable.
- Use branches and pull requests for meaningful changes after this bootstrap commit.
- Keep business documentation under version control.
- Do not commit secrets, credentials, tokens, private keys, customer data, or payment data.
- Do not add unnecessary recurring services or dependencies.
- Keep claims about the business truthful and appropriately modest.

## Infrastructure safeguards

Porkbun remains the domain registrar.

Zoho Mail remains the email provider for `eddie@lowcountrydigitalworks.com`.

Do not change nameservers, DNS records, email routing, MX, SPF, DKIM, DMARC, domain
registration, Cloudflare configuration, or billing without:

1. inspecting and recording the current state;
2. documenting the proposed state;
3. documenting rollback;
4. obtaining Eddie's explicit approval.

Cloudflare Email Routing must not be enabled.

## Documentation plan

As the project progresses, this repository will document:

- website architecture;
- content and accessibility standards;
- deployment and preview procedures;
- testing and quality controls;
- Cloudflare configuration;
- DNS and Zoho email preservation;
- account ownership and access;
- rollback and recovery;
- maintenance and releases;
- approved brand assets.

## License

No license has been selected yet. All rights are reserved unless a license is added
explicitly in a future approved change.
