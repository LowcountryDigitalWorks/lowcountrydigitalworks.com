# Website content editing

Lowcountry Digital Works keeps public business copy in simple repository-controlled JSON files under `src/data/`.

## Editable content files

- `src/data/home.json` — Home-page hero, priorities, common starting points, ownership, process, expectations, local context, and contact call-to-action.
- `src/data/services.json` — top-level service-family navigation, starting points, and platform/cost guidance.
- `src/data/service-details.json` — focused service-detail copy for Websites, Website Care, Business Systems & Automation, Digital Ownership & Platform Administration, and Technology Consulting.
- `src/data/work.json` — selected work/project status, purpose, evidence, boundaries, detail-route slugs, technology names/descriptions, and the Work-page architecture principle.
- `src/data/approach.json` — Assess/Build/Handoff copy, planning questions, operating principles, and handoff guidance.
- `src/data/about.json` — About-page positioning, principles, lean-business explanation, and fit statement.
- `src/data/contact.json` — Contact guidance, founder display name/role, public email, public business phone display/dial value, verified Facebook/X profile URLs, safety notes, and next-step explanation.

`src/pages/services/[slug].astro` and `src/pages/work/[slug].astro` generate the focused detail routes from repository-controlled data. `src/pages/connect.astro` owns the stable QR/contact destination, while `public/eddie-gugino-lowcountry-digital-works.vcf` is the portable public contact card.

The Astro files under `src/pages/` own page structure and presentation. Routine copy edits should normally change the JSON content files rather than the Astro layout files.

For `contact.json`, remember that the email address and phone number are intentionally published on the public website. Keep the human-readable phone value and E.164-style dial value aligned whenever the number changes.

For founder content, do not publish a synthetic owner image. Until Eddie selects the final public photo and approves the exact biography, the branch may carry an explicit development-only photo placeholder; production approval remains blocked on that owner asset/copy gate.

For `work.json`, keep project status truthful. A product still being designed or implemented should remain labeled **Active Development** rather than being presented as completed client work. Do not add clients, testimonials, partnerships, certifications, or deployment claims unless they are authoritative and approved for public use.

For ownership/access and vendor-transition service copy, describe the work as consulting, implementation, transition, and documentation that Lowcountry Digital Works can perform using existing account-management and secure-access practices. Do not present an LDW password vault, access-management dashboard, or **Secure Secrets** product as existing. Do not imply that Lowcountry Digital Works needs or retains client master passwords or recovery codes, guarantees account recovery, adjudicates legal ownership, or provides compliance certification.

Technology marks under `public/technology/` are structural assets rather than routine copy. See `docs/technology-marks.md` before adding or replacing one.

## Simplest safe edit from GitHub

1. Open the appropriate file under `src/data/` in GitHub.
2. Choose **Edit this file**.
3. Make the copy change without changing JSON field names or structure unless the page code is being changed at the same time.
4. Commit the change to a new branch rather than directly to protected `main`.
5. Open a pull request to `main`.
6. Confirm the required `validate` workflow and Cloudflare branch preview succeed.
7. Review the preview visually before merge.
8. Squash-merge the pull request when the exact tested head is approved.

This preserves branch protection, preview deployment, accessibility/browser validation, and rollback through Git history.

## Pages CMS evaluation

Pages CMS is a plausible optional editing UI because it can edit structured files in a GitHub-backed static site without replacing Astro or adding a separate content database to the website.

It is **not installed or authorized yet**. Installing its GitHub App changes repository permissions and therefore requires a separate access/permissions review and Eddie's explicit approval. Before adoption, verify that the editing workflow preserves the LDW protected-main pull-request requirement rather than introducing direct production writes.

Until that review is complete, GitHub's web editor plus the `src/data/` content layer is the authoritative low-complexity editing path.
