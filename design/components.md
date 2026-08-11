# Component Guidance

Include components only when genuinely needed.

## Website header
- roughly 68px desktop height
- logo left
- Home / Services / Approach / About / Contact navigation
- restrained contact CTA
- white or Soft White surface
- thin lower border
- sticky behavior is acceptable if unobtrusive

## Mobile navigation
- logo + accessible menu button
- straightforward vertical menu
- no decorative drawer effects
- focus stays inside open menu when implemented as a modal/drawer

## Hero
- concise positioning statement
- one supporting paragraph
- primary CTA + secondary CTA
- no autoplay video
- no fake customer screenshots
- no generic AI-generated people
- no altered/translucent production-logo texture; any future background pattern requires its own approved asset

## Buttons
Primary:
- Cypress Teal background
- white text
- 10px radius
- minimum ~44px height

Secondary:
- transparent/white background
- navy text and border

Inline links:
- preserve visible underline or equivalent persistent differentiation

## Cards
- 1px neutral border
- white or warm surface
- 10–16px radius
- 24–32px padding
- no shadow by default
- service cards should not contain excessive marketing copy

## Alerts / statuses
Always combine semantic color with text/iconography. Status meaning must survive grayscale and color-vision differences.

## Forms
No public contact form at initial launch unless separately approved. If forms are later added, use standard labeled controls and avoid floating-label-only patterns.

## Tables
Applications may use denser tables. Preserve legible spacing, sticky headers only when useful, horizontal overflow where needed, and visible row/column context.

## Application sidebar
- ~240–272px expanded where persistent sidebar is appropriate
- clear active state
- icons support labels; they do not replace labels
- collapse only if the product benefits from it

## Application top bar
- ~56–64px
- workspace/title context
- global search only when real product requirements justify it
- user/settings/status actions aligned consistently

## Tabs
Use for peer views within a local context, not primary global navigation.

## Inputs / selects / toggles
- labels above or clearly associated
- visible focus
- disabled states remain legible
- toggles only for immediate binary state changes, not for submit-required preferences

## Empty / loading / error states
- describe what happened
- state what the user can do next
- avoid decorative illustration unless it adds meaning
- loading indicators must not imply progress that cannot be measured
