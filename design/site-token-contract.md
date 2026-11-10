# Site token contract (Phase A — render parity)

Authority: [issue #160](https://github.com/LowcountryDigitalWorks/lowcountrydigitalworks.com/issues/160).

This contract documents how **three source layers** relate for the public marketing site. Phase A adds machine validation only; it does **not** change built CSS output.

| Layer | File | Role |
|-------|------|------|
| Brand primitives | `brand/css/brand-tokens.css` | Canonical LDW color + font primitives (`--ldw-*`), synced from `brand/colors.json` |
| Application / design system | `design/tokens.css` | Cross-product semantic tokens (`--color-*`, spacing, radii) for apps + future site work |
| Site runtime aliases | `src/styles/global.css` | Short aliases (`--bg`, `--text`, …) used by the Astro marketing stylesheet today |

## Render-parity rules (Phase A)

1. Brand literals in `site-token-contract.json` must match both `brand/colors.json` and `brand/css/brand-tokens.css`.
2. `design/tokens.css` must continue importing brand tokens and keep documented semantic literals/aliases.
3. `src/styles/global.css` must keep documented aliases to brand primitives and documented literal duplicates (`--muted`, `--border`, radii, layout widths).
4. **Intentional drift (frozen):** marketing `--focus` is `#235D8C` in `global.css` while `design/tokens.css` uses `--color-focus: #2F766F`. Do not reconcile in Phase A; address only in an owner-approved preview (Phase B).

## Validation

```bash
node scripts/validate_design_token_contract.mjs
node --test tests/design-token-contract.unit.mjs
```

Parsing uses comment-aware helpers in `scripts/design_token_contract_lib.mjs` (no new npm dependencies): active `@import` statements only, comment-stripped `:root` declarations, and fail-closed detection of conflicting duplicate custom properties.

`scripts/validate_repository.py` invokes the contract validator and unit tests during hosted `validate` CI.

## Phase B+ (not in scope here)

- Optional import of `design/tokens.css` into the site bundle with alias shim
- Coastal visual refresh on noindex preview routes
- `prefers-reduced-transparency` fallbacks for selective frost surfaces
