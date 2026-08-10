# Rollback and Recovery

## Website-code rollback

Preferred approach:

1. identify the last known-good production commit;
2. revert the introducing pull request through a new pull request;
3. validate the revert;
4. merge and confirm Cloudflare redeployment.

For an urgent production issue, Cloudflare deployment rollback may restore a previous successful deployment while the repository revert is prepared. The repository must still be reconciled so source control remains authoritative.

## DNS rollback

Before any DNS change, preserve an exact zone inventory and nameserver state in the approved private operations record.

The pre-migration Porkbun authoritative nameservers recorded on 2026-08-07 were:

- `curitiba.ns.porkbun.com`
- `fortaleza.ns.porkbun.com`
- `maceio.ns.porkbun.com`
- `salvador.ns.porkbun.com`

Restoring nameservers alone is not sufficient unless Porkbun still contains the complete known-good DNS zone. Email records must be verified before any rollback is considered complete.

## Access recovery

Use named organization owners, MFA, and platform-supported recovery methods. Never store passwords, MFA codes, passkeys, recovery codes, private keys, or vault exports in the repository.
