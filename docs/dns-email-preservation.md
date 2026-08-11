# DNS and Email Preservation

## Governing rules

- Porkbun remains the registrar.
- Cloudflare is the authoritative DNS provider and website platform when configured for the domain.
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
- Google verification records when applicable and still required;
- any still-required certificate-validation records;
- approved website and redirect records.

Email-related records must remain DNS-only where Cloudflare offers a proxy choice.

## Migration record

- Porkbun remains the registrar.
- Cloudflare nameservers were assigned during the 2026-08-07 migration.
- Zoho mail-related records were preserved during migration.
- On 2026-08-10, Cloudflare account access and the existing Worker context were re-verified; no duplicate Worker was created.
- The non-Gmail Google services identity is pending recreation/recovery separately and must not change Zoho mail routing.

## Validation for consequential DNS changes

Validate:

1. apex website over HTTPS;
2. `www` redirect behavior;
3. inbound mail to Zoho;
4. outbound mail from Zoho to an external provider;
5. SPF and DKIM authentication results;
6. DMARC status;
7. absence of Cloudflare Email Routing;
8. removal of obsolete parking/forwarding records only after replacement paths work.
