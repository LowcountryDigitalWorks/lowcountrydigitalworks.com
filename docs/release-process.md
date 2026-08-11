# Release Process

## Versioning

Use semantic-style versions for meaningful public releases:

- major: incompatible architecture or public-contract change;
- minor: new site capability or significant content/design release;
- patch: corrective release without a new public capability.

The early bootstrap and governance releases use `0.x` versions while the public site is being established.

## Branches

Recommended prefixes:

- `release/`
- `feature/`
- `fix/`
- `docs/`
- `chore/`

## Pull requests

Meaningful changes use pull requests. Squash merge is the normal merge method under the applied public-repository governance baseline. A release pull request should include validation results, preview/deployment state when available, cost impact, infrastructure impact, and rollback.

## Tags and releases

Create Git tags and GitHub releases once the custom-domain path and release automation are documented. Until then, `CHANGELOG.md`, pull requests, and Cloudflare deployment history provide the release record.

## Production launch gate

A release may be technically merge-ready while still requiring explicit production-launch or infrastructure approval. Do not treat a passing pull request as permission to change protected Cloudflare/DNS/email/account settings.
