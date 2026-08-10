# Lowcountry Digital Works — Brand Usage Guide

Status: **Production package v2 — authoritative correction**

Selected mark: **Image 1 / Tidal Framework LDW monogram**

This package supersedes the earlier incorrectly reconstructed production package from 2026-08-10. Do not use assets from the superseded package.

## Authoritative production masters

The primary source-of-truth assets are:

- `logo/lowcountry-digital-works-mark.svg`
- `logo/lowcountry-digital-works-logo-horizontal.svg`
- `logo/lowcountry-digital-works-logo-stacked.svg`
- `icons/favicon.svg`

All SVG logo masters are true vector artwork. The standalone symbol is a normalized geometric reconstruction of the approved raster reference; it is not an embedded or renamed raster image.

## Selected symbol

The symbol is the approved Tidal Framework monogram:

- navy `LD` structural framework;
- teal `W` / tidal-flow element;
- transparent negative-space separation between the structural and flowing components.

The approved raster reference is retained only in `reference/`.

## Palette

- Estuary Navy — `#102A3A`
- Cypress Teal — `#2F766F`
- Warm Oyster — `#F3EFE6`
- Soft White — `#F7F8F6`
- White — `#FFFFFF`
- Black — `#000000`

Use flat color only in the logo. Do not apply opacity, gradients, glow, shadows, metallic effects, or texture to the production mark.

### Contrast

For accessibility-sensitive text usage:

- Estuary Navy on White: 14.85:1
- Estuary Navy on Warm Oyster: 12.94:1
- Cypress Teal on White: 5.33:1
- Cypress Teal on Warm Oyster: 4.64:1

Use Estuary Navy for primary body text. Cypress Teal is appropriate for the mark, accents, and selected interface text but should not replace navy for long-form body copy.

## Typography

Primary brand/interface family:

`Manrope, "Source Sans 3", Inter, system-ui, sans-serif`

Manrope is the approved lead family. It is available under the SIL Open Font License 1.1. Do not place font binaries in the LDW brand package unless repository policy later explicitly requires and approves that distribution.

The self-contained SVG lockups use outlined vector wordmark geometry generated from the installed Inter family to closely match the approved concept board while avoiding a runtime font dependency. This does **not** change the Manrope-led typography recommendation for the website and applications.

## Clear space

Let **X** equal the width of the navy `L` vertical stroke in the standalone mark.

Maintain at least:

- standalone mark: `1× X` clear space on every side;
- horizontal lockup: `0.75× X`;
- stacked lockup: `0.75× X`.

More clear space is preferred when practical.

## Minimum sizes

### Digital

- standalone mark: 24 px minimum for normal interface use;
- favicon: 16 px is allowed only with `icons/favicon.svg` or its derived raster exports;
- horizontal lockup: 180 px wide minimum;
- stacked lockup: 110 px wide minimum.

### Print

- standalone mark: 8 mm wide minimum;
- horizontal lockup: 32 mm wide minimum;
- stacked lockup: 22 mm wide minimum.

## Light-background use

Preferred:

- full-color navy + teal mark on White, Soft White, or Warm Oyster;
- navy wordmark on light backgrounds.

Avoid low-contrast photography, patterns, or colored surfaces behind the full-color mark.

## Dark-background use

Preferred:

- reversed all-white logo on Estuary Navy or similarly dark solid backgrounds.

Do not use the normal navy component on dark surfaces where it loses contrast.

## Favicon and small-size behavior

`icons/favicon.svg` is an optical small-size master derived from the same Tidal Framework geometry. It slightly enlarges internal clearances so the `LD` does not appear washed out or close up at 16–24 px.

Do not recreate the favicon independently from the raster reference.

## App/avatar use

For square app and social contexts use the supplied light or dark square icon files. Do not place the normal logo in an arbitrary rounded rectangle when the dedicated square icon is available.

## Misuse / avoid

Do not:

- stretch, skew, rotate, or distort the mark;
- rearrange L, D, or W;
- change the approved navy/teal assignment;
- add extra colors;
- add a border or enclosing shape to the normal logo;
- add shadows, bevels, glow, gradients, or transparency;
- reduce the navy `LD` opacity;
- put the logo on busy imagery without a solid clear field;
- use the wordmark without adequate spacing;
- auto-trace or regenerate the mark through an image-generation system.

## Reconstruction note

The approved source was a raster concept board, so its original Bézier control points do not exist in the source material. The production symbol in this package is therefore a **normalized vector reconstruction** made from regularized geometry and compared visually against the approved reference. This is the unavoidable source limitation; no raster is embedded in the production SVG masters.
