# Public Website UX

## Current information architecture

- Home
- Services
- Work
- Approach
- About
- Connect
- Contact (retained as a fuller explanatory contact route)
- Privacy / Website Use

The primary navigation uses Services / Work / Approach / About / Connect. The logo returns Home.

## Primary UX goal

A visitor should quickly understand that LDW builds and improves practical digital systems and emphasizes maintainability, client ownership, named access, portability, and clear handoff.

## Recommended homepage flow

1. Header
2. Hero
3. Core service summary
4. Ownership / handoff principle
5. How LDW helps / additional services
6. How LDW works: Assess → Build → Handoff
7. Local roots / About context
8. Contact CTA
9. Footer

## Hero direction

Recommended message territory:
- practical digital systems
- maintainable systems
- systems that work for the business
- clarity, portability, ownership

Avoid making "secure" the main headline personality; security should be a quality of the work, not a visual or positioning pivot into a cybersecurity-company identity.

Recommended eyebrow direction:
**PRACTICAL. MAINTAINABLE. YOURS.**

Final marketing copy remains owned by the website/content workflow.

## Services

Initial service families:
- Websites
- Custom Applications
- Workflow Automation
- Technical Consulting
- Platform & Account Transitions
- Maintenance & Improvement

On the homepage, do not squeeze all six into narrow cards. Prefer:
- four concise hero/service cards, plus supporting services below; or
- three primary service cards plus a "View all services" action.

The Services page may use a spacious 3 × 2 grid at desktop sizes.

## Ownership message

The following idea is a distinctive LDW principle and should be prominent:

**Your business should own its digital assets.**

Supporting concepts:
- client-owned accounts
- named role-based access
- portable repositories and platforms
- clear handoff and recovery documentation

Do not make claims about certifications, clients, staff, years in business, or capabilities that are not established.

## Layout

- max shell width: 1200px
- readable copy width: ~680–760px
- wider content sections: ~960–1080px
- gutters: 16px mobile / 24px tablet / 32px desktop
- section spacing: 48–64px mobile / 80–96px desktop
- breakpoint guides: 576 / 768 / 1024 / 1280px

Break based on content, not device labels.

## Public Work selection

The existence of an LDW repository does **not** automatically make it public marketing content.

A repository belongs in the public Work showcase only when:
- it supports the current customer/service story;
- its maturity can be stated truthfully and simply;
- public-safe evidence exists or the lack of visual evidence is made explicit;
- publication does not imply a customer deployment, regulated-production claim, commercial availability, or customer endorsement that has not been approved.

Current WEB-UX-002 repository audit:
- **Document Control** — public Work evidence: YES; active development with synthetic/test-only boundaries.
- **Secure Exchange** — public Work evidence: YES; active development with synthetic/local boundaries and no regulated-production claim.
- **G.A.S. Engine** — public Work evidence: YES; internal service-enabling infrastructure only, not customer SaaS.
- **LDW website** — do not use as a public Work showcase item; self-referential homepage screenshots weaken the portfolio presentation. The site remains internal proof of the website-delivery method, not a case-study tile.
- **East Coast Foam** — candidate future website Work item only after authorized production cutover and explicit customer/publicity approval.
- **Website Quality Toolkit** — use as supporting Website Care/Search-quality evidence, not standalone SaaS marketing.
- **Reputation** — do not surface as a product while the repository remains dormant with no functional runtime.
- **Royal Cruise Tracker / Royal Cruise Tracker Core** — useful R&D, but not part of the current small-business service story.
- **Agent Trading Lab** — experimental measurement infrastructure; not a customer investment/trading product and not part of current public service positioning.
- **SAST / DAST comparative proofs** — engineering/security evidence, not current standalone customer products or a substitute for a separately scoped security service.
- **East Coast Foam** — do not publish as a client case study without explicit customer/publicity authorization.

## Work detail pages

Public Work pages should explain more than a project name and status. When the owning product source supports the claim, a page should make clear:

- what the project is;
- what problem it addresses and why that problem matters;
- where the approach can fit;
- how the accepted architecture/workflow operates at a high level;
- what evidence exists;
- current maturity and explicit non-goals/boundaries;
- the related LDW service, when one exists;
- useful project-specific questions and answers.

Use real public-safe screenshots, diagrams, or interface evidence when they come from the actual project. Never manufacture customer evidence or present mockups as production results.

## FAQs

Visible FAQs are appropriate when they answer real pre-engagement or project-understanding questions.

- keep answers specific and bounded;
- do not build keyword-stuffed FAQ farms;
- do not add FAQ schema unless the visible page content supports it and the schema remains appropriate;
- use native disclosure controls so the content works without client-side JavaScript.

## Connect and contact terminology

Use human-facing terminology such as **Contact card** and **Save to contacts**. The underlying `.vcf` / vCard format is an implementation detail.

Contact and social icons should supplement visible labels. They never replace accessible text.

## Footer
- navy surface
- white inverse mark using the production v2 asset
- concise navigation
- primary business email
- privacy / website-use link
- restrained local iconography for contact/social recognition where useful
- no clutter


## Cookies and tracking

The public LDW website should not display a cookie banner simply because banners are common.

Current rule:
- repository-controlled public-site code should not intentionally set nonessential cookies or use local/session browser storage for behavioral analytics, advertising, or tracking;
- no consent banner is needed while there is no nonessential cookie/storage purpose to consent to;
- hosting/security metadata needed to deliver and protect the site is treated separately from marketing/behavioral tracking;
- privacy-preserving, cookieless, aggregate measurement should be preferred when it satisfies the business need;
- adding analytics, advertising pixels, third-party embeds, personalization, or another cookie/storage-using feature requires a pre-deployment review of provider, purpose, data flow, retention, consent/opt-out requirements, and privacy-notice changes;
- if consent becomes necessary, use a clear category-based mechanism with nonessential categories off by default, an easy revocation path, no dark patterns, and no loading of nonessential technologies before consent where consent is required.

This is a product/architecture rule, not legal advice. A dedicated privacy/compliance review should occur before LDW introduces advertising technology, cross-site tracking, or materially expands public-site data collection.
