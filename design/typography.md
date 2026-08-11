# Typography

## Primary stack

```css
font-family: "Manrope", "Source Sans 3", Inter, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Manrope is the primary website and interface family. Source Sans 3 is an approved supporting family for text-heavy documents or interfaces if needed.

Use locally bundled font files only when licensing and repository policy explicitly allow it. Otherwise prefer a reliable web-font or system-fallback strategy approved by the implementation owner.

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
| H3 | 26px | 650 | 1.25 | -0.01em |
| H4 | 20px | 650 | 1.30 | 0 |
| Body large | 18px | 400 | 1.60 | 0 |
| Body | 16px | 400 | 1.60 | 0 |
| Small body | 14px | 400 | 1.50 | 0 |
| Navigation | 15px | 600 | 1.30 | 0 |
| Button | 15px | 650 | 1.20 | 0 |
| Label | 14px | 600 | 1.35 | 0 |
| Caption | 12px | 500 | 1.45 | 0 |

Use responsive `clamp()` sizing for large website headings. Do not make hero headlines huge merely to fill the viewport.
