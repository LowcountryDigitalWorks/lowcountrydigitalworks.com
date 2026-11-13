import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lowcountrydigitalworks.com',
  output: 'static',
  vite: {
    build: {
      // Keep @fontsource woff2 as same-origin files; do not inline as data: URLs blocked by font-src 'self'.
      assetsInlineLimit: 0,
    },
  },
});
