# ADR 0004: Contact Processing Deferred

- Status: Accepted
- Date: 2026-08-07

## Decision

Use the published business email address and `mailto:` links at launch. Do not operate a server-side contact form yet.

## Rationale

A form requires decisions about spam prevention, delivery provider, data retention, privacy notice, attachments, failure handling, and abuse monitoring. Email provides a clear initial route without introducing those systems prematurely.

## Future direction

A reviewed Worker endpoint may later validate submissions and forward them through an approved provider without unnecessary storage.
