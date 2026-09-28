# Website content editing

Lowcountry Digital Works keeps routine public business copy in repository-controlled JSON under `src/data/`.

## Editable content files

- `src/data/site.json` — canonical public business identity, founder name/title, phone/email, and authenticated social-profile URLs.
- `src/data/home.json` — Home hero, service pathways, ownership principle, process, founder summary, and final CTA.
- `src/data/services.json` — five public service families, problems, examples, boundaries, and starting points. Dynamic service-detail routes are generated from each service `slug`.
- `src/data/work.json` — selected-work status, purpose, evidence, boundaries, related services, and technology context. Dynamic project-detail routes are generated from each project `slug`.
- `src/data/approach.json` — delivery approach and planning guidance.
- `src/data/about.json` — founder/about copy, principles, operating model, and fit statement.
- `src/data/contact.json` — contact guidance, public email/phone values, safety notes, and next-step copy.

The Astro files under `src/pages/` own page structure and presentation. Routine copy edits should normally change JSON rather than layout code.

## Truth and approval boundaries

- Keep project status explicit. Active Development and Internal Infrastructure must not be presented as completed customer deployments.
- G.A.S. Engine remains internal service-enabling evidence/measurement infrastructure, not customer SaaS.
- Founder photography and detailed biography/credential wording require owner review before production.
- Social URLs in `site.json` should be changed only after authenticated verification.
- Managed Search + AI Visibility maturity/pricing remains controlled by its own service-validation gate.
- Do not add clients, testimonials, certifications, partnerships, deployment claims, rankings, revenue outcomes, or years of experience unless authoritative and approved for public use.
- Ownership/access work is consulting/implementation. Do not imply LDW retains customer master passwords/recovery codes, guarantees recovery, or provides compliance certification.

## Public assets

- `public/work/` contains public-safe evidence images used by Work pages.
- `public/technology/` contains locally served technology marks.
- `public/lowcountry-digital-works.vcf` is the portable contact card linked from `/connect/`.

Do not place customer records, secrets, PHI/CUI, private screenshots, credentials, or recovery material in public assets.

## Simplest safe edit from GitHub

1. Start from current `main`.
2. Edit the appropriate repository-controlled data or asset on a focused branch.
3. Keep JSON field names/structure aligned with the consuming page code.
4. Open a pull request to protected `main`.
5. Confirm the required validation and branch preview.
6. Review desktop/mobile presentation and accessibility.
7. Obtain any required content or production approval.
8. Squash-merge only the exact reviewed head.

## CMS boundary

No CMS is currently installed or authorized. GitHub plus the structured content layer remains the authoritative low-complexity editing path. A future editing UI must preserve protected-main review and justify any permissions, runtime, database, or recurring cost before adoption.
