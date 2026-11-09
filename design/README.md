# LDW Design Documentation

This directory defines the Lowcountry Digital Works UX and visual-design system.

The system is intentionally small and maintainable. It provides shared visual DNA without forcing every LDW-built product into an identical interface.

## Shared foundations

- Estuary Navy + Cypress Teal identity
- Manrope-led typography
- restrained radius, borders, and shadows
- accessible interaction states
- consistent button, input, navigation, and semantic-state language
- ownership, maintainability, portability, and clear handoff as recurring product principles

## Token contract (Coastal prep)

Phase A render-parity for forthcoming site-wide design-system work is documented in `design/site-token-contract.md` with machine checks in `design/site-token-contract.json` and `scripts/validate_design_token_contract.mjs` (issue **#160**). Phase A does not change production CSS output.

## Intentional differences

### Public website
- lower density
- generous whitespace
- narrative content flow
- primarily light-mode
- minimal scripting
- no decorative dashboard aesthetic

### Applications
- higher information density
- persistent navigation where useful
- tables, forms, states, and workspace patterns
- optional dark mode
- utility over marketing aesthetics
