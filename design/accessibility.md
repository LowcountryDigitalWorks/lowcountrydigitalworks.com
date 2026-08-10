# Accessibility Requirements

Target: **WCAG 2.2 AA**

## Required behavior

- Full keyboard operation for all interactive components
- Visible `:focus-visible` indication
- No hover-only information
- No color-only status communication
- Semantic heading order
- Landmark regions
- Buttons for actions; links for navigation
- Form controls with programmatic labels
- Errors adjacent to fields, with a summary for longer forms when appropriate
- Accessible dialog focus management
- Reflow and usability through 400% zoom
- `prefers-reduced-motion` honored
- Links visibly distinguishable from surrounding prose
- Sufficient dark-mode contrast
- Meaningful empty/loading/error states
- Touch targets: prefer at least 44 × 44 CSS px; do not shrink critical controls for visual compactness

## Focus

Use a clearly visible focus outline/ring with sufficient contrast against both light and dark surfaces. Never remove native focus indication without replacing it.

## Motion

The public website should not depend on animation. Decorative transitions should be brief and removed or reduced under `prefers-reduced-motion: reduce`.

## Logo accessibility

Production Brand Package v2 is final. For logo accessibility:
- decorative logo instances should use empty alt text when adjacent brand text already provides the name
- linked header logo should have an accessible name such as "Lowcountry Digital Works home"
- minimum-size and clear-space rules come from Production Brand Package v2
