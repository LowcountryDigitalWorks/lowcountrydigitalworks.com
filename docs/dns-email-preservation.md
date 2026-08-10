# DNS and Email Preservation

## Governing rules

- Porkbun remains the registrar.
- Cloudflare is the intended authoritative DNS provider and website platform.
- Zoho Mail remains the email provider for `eddie@lowcountrydigitalworks.com`.
- Cloudflare Email Routing must not be enabled.
- Nameserver and DNS changes require a recorded current state, proposed state, rollback path, and explicit approval.

## Required records

The authoritative DNS zone must preserve:

- all Zoho MX records and priorities;
- the Zoho SPF policy;
- the Zoho DKIM selector and public key;
- DMARC when present or deliberately introduced;
- Zoho ownership verification;
- Google verification records;
- any still-required certificate-validation records;
- approved website and redirect records.

Email-related records must remain DNS-only where Cloudflare offers a proxy choice.

## 2026-08-07 migration status

- Porkbun nameservers were replaced with the Cloudflare nameservers assigned to the zone.
- DNSSEC was off and the registry showed no DS records before the change.
- Cloudflare was waiting for nameserver propagation.
- Imported Zoho MX, SPF, verification, and DKIM records were preserved.
- Porkbun parking and forwarding records remain temporary until the Cloudflare zone becomes active and the Worker custom domain is attached.

## Validation after activation

Validate:

1. apex website over HTTPS;
2. `www` redirect behavior;
3. inbound mail to Zoho;
4. outbound mail from Zoho to an external provider;
5. SPF and DKIM authentication results;
6. DMARC status;
7. absence of Cloudflare Email Routing;
8. removal of obsolete Porkbun parking and wildcard records only after replacement paths work.
