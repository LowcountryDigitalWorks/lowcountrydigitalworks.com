# Testing and Quality Baseline

## Required CI check

The protected-branch status check remains the single stable job named `validate`. Release 0.3 expands that job rather than inventing multiple required check names.

It runs:

1. dependency installation;
2. Astro production build;
3. repository/static-output validation;
4. Chromium installation;
5. Playwright desktop/mobile smoke tests;
6. axe-core critical/serious accessibility checks;
7. internal-link and responsive overflow checks;
8. high-severity npm audit.

## Manual release checks

- production header/footer logo proportions;
- favicon at 16/24/32px;
- keyboard navigation and visible focus;
- mobile and desktop layout;
- reduced-motion behavior;
- email links;
- custom 404;
- social preview;
- Cloudflare branch preview and production deployment state.

Shared test tooling remains site-specific until reuse across multiple real websites is demonstrated.
