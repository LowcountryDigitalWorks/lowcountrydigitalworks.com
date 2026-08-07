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

Meaningful changes use pull requests. Squash merge is preferred for a focused, readable history. A release pull request should include validation results, preview URL when available, cost impact, infrastructure impact, and rollback.

## Tags and releases

Create Git tags and GitHub releases once the custom domain is active and the release automation is documented. Until then, `CHANGELOG.md`, pull requests, and Cloudflare deployment history provide the release record.
