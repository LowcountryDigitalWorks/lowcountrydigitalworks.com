# Website content editing

Lowcountry Digital Works keeps public business copy in simple repository-controlled JSON files under `src/data/`.

## Editable content files

- `src/data/home.json` — Home-page hero, priorities, common starting points, ownership, process, expectations, local context, and contact call-to-action.
- `src/data/services.json` — Service descriptions, examples, featured services, starting points, and the platform/cost note.
- `src/data/approach.json` — Assess/Build/Handoff copy, planning questions, operating principles, and handoff guidance.
- `src/data/about.json` — About-page positioning, principles, lean-business explanation, and fit statement.
- `src/data/contact.json` — Contact guidance, helpful first-message details, email address, safety note, and next-step explanation.

The Astro files under `src/pages/` own page structure and presentation. Routine copy edits should normally change the JSON content files rather than the Astro layout files.

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
