# ADR 0002: Static-First Architecture

- Status: Accepted
- Date: 2026-08-07

## Decision

Use static HTML/CSS for the infrastructure bootstrap and migrate to Astro static output when reusable layouts and permanent content justify it.

## Rationale

Static delivery minimizes cost, attack surface, dependencies, operational burden, and vendor lock-in. Astro can later improve maintainability without requiring a server runtime or browser framework.

## Consequences

- No database, CMS, server-side rendering, or authentication at launch.
- The first public release remains usable if JavaScript is unavailable.
- Any dynamic feature requires a separate decision and threat review.
