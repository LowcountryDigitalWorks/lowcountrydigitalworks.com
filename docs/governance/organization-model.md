# GitHub Organization Operating Model

## Purpose

The `LowcountryDigitalWorks` organization is the authoritative GitHub owner for company source code, public technical documentation, reusable automation, and approved internal repositories.

## Current repository map

### Public

- `lowcountrydigitalworks.com` — public website source and site-specific documentation
- `.github` — organization profile, public contribution guidance, public security policy, shared issue templates, and approved workflow templates
- `website-quality-toolkit` — placeholder repository; populate only after reusable testing utilities are proven across multiple sites

### Private

- `business-operations` — non-public business operations, account inventory, internal continuity, vendor/cost records, approved templates, and private procedures
- temporary client repositories only when client ownership is not yet available and a documented transfer plan exists

## Roles

During establishment, multiple named owner accounts may be retained to reduce lockout risk. The target state is:

- `Eddie-LowcountryDigitalWorks` as primary business owner;
- one justified recovery owner;
- other identities as members or outside collaborators with repository-specific access;
- no shared credentials.

## Settings target

- require two-factor authentication for organization members;
- restrict repository creation initially to owners;
- disable repository deletion and visibility changes for non-owners;
- use branch protection or rulesets for important repositories;
- block force pushes and protected-branch deletion;
- require pull requests and passing checks for meaningful changes;
- grant GitHub Apps access only to required repositories;
- enable dependency and secret alerts where available;
- review owners, members, outside collaborators, and installed apps periodically.

A one-person business should not require a second human approval for every ordinary pull request. Passing checks, resolved conversations, documented impact, and explicit approval for consequential changes provide a practical control baseline.
