# ADR 0001: Cloudflare Workers Static Assets

- Status: Accepted
- Date: 2026-08-07

## Decision

Deploy the website through Cloudflare Workers Static Assets rather than starting a new Cloudflare Pages project.

## Rationale

Workers Static Assets supports the current static site and provides a direct path to narrowly scoped Worker endpoints later. It keeps the custom domain, deployment platform, and future dynamic capabilities within one low-cost architecture.

## Consequences

- The site can remain entirely static at launch.
- Static asset requests do not require a traditional server application.
- Dynamic Worker code is added only through a reviewed requirement.
- Repository-controlled Wrangler configuration is authoritative.
