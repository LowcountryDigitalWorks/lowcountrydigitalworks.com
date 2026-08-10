# Contributing

Lowcountry Digital Works is currently a small owner-operated business. Contributions are managed through named GitHub access and repository-controlled change review.

## Workflow

1. Start from current `main`.
2. Create a focused branch such as `docs/...`, `feature/...`, `fix/...`, or `release/...`.
3. Keep unrelated changes out of the branch.
4. Run `python scripts/validate_repository.py`.
5. Open a pull request using the repository template.
6. Resolve review conversations and failed checks before merge.
7. Use squash merge unless the pull request documents a reason for another method.

## Change requirements

Every meaningful pull request should identify:

- purpose and scope;
- user-visible impact;
- security and privacy impact;
- accessibility impact;
- infrastructure or DNS impact;
- new recurring or one-time cost;
- checks run and results;
- rollback approach.

## Protected areas

Do not change domain registration, nameservers, DNS, Zoho email records, Cloudflare production configuration, payment systems, billing, or access roles without the required inventory, rollback plan, and explicit approval.

## Content standards

Do not invent clients, testimonials, employees, certifications, addresses, partnerships, revenue, years in business, or unsupported capabilities. Keep copy specific, understandable, and appropriately modest.
