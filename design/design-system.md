# Lowcountry Digital Works Design System

## Design character

**Lowcountry precision**: trustworthy, practical, modern, approachable, organized, technically capable, and restrained.

Avoid:
- generic AI aesthetics
- neon/cyber styling
- tourism/beach branding
- government/defense-contractor styling
- glassmorphism used decoratively
- oversized empty hero sections
- unnecessary animation
- excessive gradients
- stock-dashboard aesthetics on the marketing site

## Core colors

| Role | Value |
|---|---|
| Estuary Navy | `#102A3A` |
| Cypress Teal | `#2F766F` |
| Warm Oyster | `#F3EFE6` |
| Soft White | `#F7F8F6` |
| White | `#FFFFFF` |
| Black | `#000000` |

## Light-mode functional palette

| Role | Value |
|---|---|
| Background | `#F7F8F6` |
| Surface | `#FFFFFF` |
| Warm surface | `#F3EFE6` |
| Primary text | `#102A3A` |
| Muted text | `#55656D` |
| Border | `#D6DEDA` |
| Interactive | `#2F766F` |
| Interactive hover | `#275F5A` |
| Interactive active | `#204E4A` |
| Focus | `#2F766F` |
| Disabled surface | `#E4E9E6` |
| Disabled text | `#78848A` |

## Semantic colors

| State | Foreground | Background |
|---|---|---|
| Success | `#2E6B4A` | `#E9F4ED` |
| Warning | `#8A5A00` | `#FFF4D6` |
| Error | `#A33A3A` | `#FBEAEA` |
| Information | `#315F7D` | `#E9F1F6` |

## Dark application palette

| Role | Value |
|---|---|
| Background | `#0B1820` |
| Surface | `#102A3A` |
| Elevated surface | `#173748` |
| Primary text | `#F7F8F6` |
| Muted text | `#C4D0D3` |
| Border | `#365363` |
| Interactive | `#78B7B0` |
| Focus | `#8BCBC4` |
| Success | `#7FC69A` |
| Warning | `#E4B85A` |
| Error | `#F09A9A` |
| Information | `#88B8D5` |

## Contrast ratios

WCAG contrast ratios for principal combinations:

| Foreground | Background | Ratio |
|---|---|---:|
| Navy `#102A3A` | White `#FFFFFF` | 14.85:1 |
| Navy | Soft White `#F7F8F6` | 13.94:1 |
| Navy | Warm Oyster `#F3EFE6` | 12.94:1 |
| Cypress Teal `#2F766F` | White | 5.33:1 |
| Cypress Teal | Soft White | 5.00:1 |
| Cypress Teal | Warm Oyster | 4.64:1 |
| Muted `#55656D` | White | 6.05:1 |
| Soft White | Dark background `#0B1820` | 16.91:1 |
| Light teal `#78B7B0` | Dark background | 7.89:1 |

Do **not** use normal Cypress Teal as small text directly on Estuary Navy; that combination is insufficient for normal text. Use the lighter dark-mode teal.

## Spacing scale

`4, 8, 12, 16, 24, 32, 48, 64, 96px`

## Radius

- small: 6px
- medium: 10px
- large: 16px
- pill: 999px, status/badge use only

## Shadow

Default to borders instead of shadows. When elevation is required, use one subtle shadow only. Do not build a multi-level material-style elevation system unless a product actually needs it.

## Decorative brand treatment

Production Brand Package v2 prohibits opacity/transparency changes to the production logo. The earlier translucent LDW watermark treatment is retired and must not be implemented.

If a branded background texture or pattern is useful in a future design, create and approve a separate pattern asset. Do not derive that texture by fading, separating, recoloring, or otherwise altering the production mark.
