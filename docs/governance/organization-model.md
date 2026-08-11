# GitHub Organization Operating Model

## Purpose

The `LowcountryDigitalWorks` organization is the authoritative GitHub owner for company source code, public technical documentation, reusable automation, and approved internal repositories.

## Current repository map

### Public

- `lowcountrydigitalworks.com` — public website source and site-specific documentation
- `.github` — organization profile, public contribution guidance, public security policy, shared issue templates, and approved workflow templates
- `website-quality-toolkit` — placeholder repository; populate only after reusable testing utilities are proven across multiple sites
- `document-control` — active product repository governed by its separate authoritative product thread
- `secure-exchange` — product repository governed by its separate authoritative product thread

### Private

- `business-operations` — non-public business operations, account inventory, internal continuity, vendor/cost records, approved templates, and private procedures
- temporary client repositories only when client ownership is not yet available and a documented transfer plan exists

Product repositories remain separate from website/infrastructure implementation even when they share organization-wide governance, ownership, security, and cost standards.

## Applied public-repository baseline

The five public repositories use the `LDW main governance baseline` on `main`: pull requests are required, zero human approvals are required for the current owner-operated model, review conversations must be resolved, linear history is required, force pushes and protected-branch deletion are blocked, squash merge is the normal merge method, and merged branches are deleted automatically. The website additionally requires its stable `validate` status check.

Secret scanning, secret-scanning push protection, and Dependabot vulnerability alerts are enabled on the public repositories. Paid GitHub security products are not required for the current baseline.

`business-operations` remains private on GitHub Free. It uses repository-controlled validation and documented process rather than making the repository public merely to obtain free branch enforcement.

## Roles

- `Eddie-LowcountryDigitalWorks` is the primary business identity.
- Recovery access is retained only where justified and is inventoried privately.
- Shared credentials are not used.

Organization-wide 2FA enforcement remains a future checkpoint until all retained recovery identities have verified MFA/recovery readiness.
