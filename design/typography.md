# Typography

## Primary stack

```css
font-family: "Manrope Variable", "Manrope", "Source Sans 3", Inter, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Manrope is the primary website and interface family. Source Sans 3 is an approved supporting family for text-heavy documents or interfaces if needed.

The website delivers Manrope through the pinned `@fontsource-variable/manrope` package at build time. Astro/Vite bundles the resulting font resources with the site, so production does not require Google Fonts, a CDN, a third-party font request, or a broader Content Security Policy. Preserve the existing fallback stack for resilience.

The fixed outlined logo wordmark remains independent vector geometry and must not be regenerated from the runtime website font.

## Technical / mono

```css
font-family: "IBM Plex Mono", "Cascadia Code", Consolas, "Liberation Mono", monospace;
```

Use only where technical data benefits from monospace presentation.

## Type scale

| Role | Size | Weight | Line height | Letter spacing |
|---|---:|---:|---:|---:|
| Display | 56px | 700 | 1.08 | -0.02em |
| H1 | 44px | 700 | 1.12 | -0.02em |
| H2 | 34px | 700 | 1.18 | -0.015em |
| Card H2 | 23–28px responsive | 700 | 1.18 | -0.025em |
| H3 | 26px | 650 | 1.25 | -0.01em |
| H4 | 20px | 650 | 1.30 | 0 |
| Body large | 18px | 400 | 1.60 | 0 |
| Body | 16px | 400 | 1.60 | 0 |
| Small body | 14px | 400 | 1.50 | 0 |
| Navigation | 15px | 600 | 1.30 | 0 |
| Button | 15px | 650 | 1.20 | 0 |
| Label | 14px | 600 | 1.35 | 0 |
| Caption | 12px | 500 | 1.45 | 0 |

Use responsive `clamp()` sizing for large website headings. Do not make hero headlines huge merely to fill the viewport. Card headings intentionally use a smaller scale than page and section headings so multi-column service/about grids remain scannable at wide desktop sizes.
