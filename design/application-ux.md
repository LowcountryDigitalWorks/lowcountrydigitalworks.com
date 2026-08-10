# Application UX

LDW-built applications may inherit the brand without copying the marketing website.

## Brand inheritance

Applications may share:
- navy / teal / oyster color language
- Manrope-led typography
- borders/radii
- input/button behavior
- semantic-state colors
- focus treatment
- icon style
- logo/brand identification

Applications should adapt:
- navigation model
- density
- data presentation
- workspace structure
- toolbar behavior
- tables/forms
- responsive patterns

to the actual task.

## Preferred desktop shell

A sidebar + workspace + optional top utility bar is an appropriate default for multi-workspace applications, but it is not mandatory.

Typical dimensions:
- sidebar: 240–272px expanded
- top bar: 56–64px
- content padding: 16–24px for dense apps, more when content permits

## Dark mode

Dark mode should use semantic dark tokens, not simple color inversion.

Key values:
- background `#0B1820`
- surface `#102A3A`
- elevated surface `#173748`
- text `#F7F8F6`
- interactive `#78B7B0`

Normal Cypress Teal is not the default small-text interactive color on navy/dark backgrounds.

## Density

Prefer usability and information density over marketing aesthetics. Do not add decorative brand motifs behind technical tables or forms.

## Dashboard mockups

The reference dashboards in this package demonstrate visual DNA only. They are not a required information architecture and should not be copied into products whose workflows differ.
