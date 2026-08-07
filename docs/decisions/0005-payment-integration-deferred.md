# ADR 0005: Payment Integration Deferred

- Status: Accepted
- Date: 2026-08-07

## Decision

Do not add payment processing until invoicing, deposits, recurring billing, ACH, card acceptance, taxes, receipts, accounting integration, and customer-portal needs are defined.

## Guardrails

- The website will not collect raw card data.
- Prefer a hosted provider checkout or billing portal.
- Worker endpoints may create short-lived sessions or validate signed webhooks only when justified.
- Provider selection requires cost, security, privacy, ownership, export, and failure-mode review.
