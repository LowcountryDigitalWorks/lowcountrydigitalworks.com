# Brand Assets — Quick Reference

Selected identity: **Image 1 / Tidal Framework**

Production Brand Package v2 is authoritative. This website repository carries the production assets required by the website; the complete v2 export package is retained separately as the master delivery package.

## Website use

- Light header: `logo/lowcountry-digital-works-logo-horizontal.svg`
- Dark footer: `logo/lowcountry-digital-works-logo-horizontal-white.svg`
- Standalone symbol: `logo/lowcountry-digital-works-mark.svg`
- Browser favicon: `icons/favicon.svg`
- Favicon fallbacks: `icons/favicon.ico`, `icons/favicon-16.png`, `icons/favicon-24.png`, `icons/favicon-32.png`, `icons/favicon-48.png`, `icons/favicon-64.png`
- Apple touch: `icons/apple-touch-icon.png`
- GitHub/social avatar: `icons/social-avatar-light.svg` or `icons/social-avatar-dark.svg`
- Social preview: `social/social-card-1200x630.png`

## Source of truth

The authoritative production geometry is represented by the vector masters under `logo/` and `icons/favicon.svg`. Raw production color values come from `colors.json` and `css/brand-tokens.css`.

Historical raster concept references are reference-only and must not be used as production masters. Do not modify the production mark with transparency, watermark opacity, gradients, glow, shadows, or independent LD/W opacity values.

See `brand-guidelines.md` and `../design/brand-production-validation.md` for usage and implementation guidance.
