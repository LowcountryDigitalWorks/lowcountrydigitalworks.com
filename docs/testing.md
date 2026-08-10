# Testing and Quality Baseline

## Current checks

Run:

```bash
python scripts/validate_repository.py
```

The validator checks:

- required repository and deployment files;
- HTML language, title, viewport, description, landmarks, and heading structure;
- duplicate IDs;
- internal file links and anchor targets;
- favicon, robots, and sitemap consistency;
- Cloudflare Worker name and asset directory;
- required security headers;
- obvious credential and private-key patterns.

GitHub Actions runs the same validation for pull requests and pushes to `main`.

## Manual release checks

- keyboard navigation and visible focus;
- mobile and desktop layouts;
- reduced-motion behavior;
- email links;
- internal navigation;
- custom 404 response;
- browser console;
- Cloudflare preview and production deployment status.

## Planned checks

When the site moves to Astro and gains multiple pages:

- formatting and framework build checks;
- HTML validation;
- Playwright smoke tests;
- axe-core accessibility tests;
- responsive screenshots;
- link checking;
- dependency review;
- deployment-preview validation;
- performance budgets.

Shared test tooling should be extracted to an organization repository only after it proves reusable across more than one site.
