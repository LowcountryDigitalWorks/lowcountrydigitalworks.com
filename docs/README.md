# Documentation

This directory is the public, repository-controlled source of truth for the Lowcountry Digital Works website and its non-sensitive operating decisions.

## Website and infrastructure

- [Architecture](architecture.md)
- [Deployment](deployment.md)
- [DNS and email preservation](dns-email-preservation.md)
- [Rollback and recovery](rollback-recovery.md)
- [Testing](testing.md)
- [Release process](release-process.md)
- [Accessibility](accessibility.md)
- [Content guidelines](content-guidelines.md)
- [Account ownership](account-ownership.md)

## Governance

- [Organization operating model](governance/organization-model.md)
- [Repository standards](governance/repository-standards.md)
- [Draft organization profile](governance/organization-profile-draft.md)

## Architecture decisions

- [0001 — Cloudflare Workers Static Assets](decisions/0001-cloudflare-workers-static-assets.md)
- [0002 — Static-first architecture](decisions/0002-static-first-architecture.md)
- [0003 — Analytics deferred](decisions/0003-analytics-deferred.md)
- [0004 — Contact processing deferred](decisions/0004-contact-processing-deferred.md)
- [0005 — Payment integration deferred](decisions/0005-payment-integration-deferred.md)

## Documentation boundaries

This public repository must not contain secrets, private recovery procedures, billing records, customer information, contract details, or confidential internal operations. Those records should be version controlled in a separate private organization-owned operations repository.
