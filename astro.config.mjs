import { defineConfig } from 'astro/config';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { careOptionsPreviewEnabled } from './src/lib/care-gate.mjs';
import { applyCarePreviewBuildOptIn } from './src/lib/care-preview-build-env.mjs';
import { addOtherReferrerMeta, analyticsEnabled, analyticsHosts, analyticsRoutes, assertNoStrayTestHosts, extendHeadersFile, otherRoutePages } from './src/lib/analytics-config.mjs';

// Website Care plans preview (#care-options): ONE shared fail-closed gate (src/lib/care-gate.mjs), also used by the page and the Services bridge link.
// Gate OFF (the default and every production/main/unrelated-branch build): the glass/carousel stylesheet is replaced by an empty one,
// public/r5/care-carousel.js is removed from dist, and the default esbuild CSS target is kept, so a production build carries none of it.
// Cloudflare Workers Builds supplies WORKERS_CI and WORKERS_CI_BRANCH but not the
// custom CARE_OPTIONS_PREVIEW flag. Only its exact isolated preview branch may
// receive that default; explicit 0 always wins. Other builds remain OFF.
applyCarePreviewBuildOptIn();
const careOptionsPreview = careOptionsPreviewEnabled();
const careStyles = fileURLToPath(new URL(careOptionsPreview ? './src/styles/r5/care.css' : './src/styles/r5/care.off.css', import.meta.url));


// Analytics (GA4 + GTM + Clarity): default OFF. Only ANALYTICS_ENABLED=1 at build emits dist/ldw-analytics.js and extends the CSP in dist/_headers.
// public/_headers (source) is never modified, so the restrictive default CSP stays the source of truth for every other build.
// A stray test-only host override fails every build that lacks the explicit ANALYTICS_TEST_BUILD=1 marker (release safety, L3).
assertNoStrayTestHosts();
const analytics = analyticsEnabled();

export default defineConfig({
  site: 'https://lowcountrydigitalworks.com',
  output: 'static',
  integrations: [
    {
      name: 'care-options-preview-gate',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          if (!careOptionsPreview) await rm(new URL('r5/care-carousel.js', dir), { force: true });
        },
      },
    },
    {
      name: 'ldw-analytics',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          if (!analytics) return;
          const template = await readFile(fileURLToPath(new URL('./src/analytics/ldw-analytics.js', import.meta.url)), 'utf8');
          const hosts = analyticsHosts();
          if (!template.includes('/*__ANALYTICS_HOSTS__*/[]')) throw new Error('analytics loader template lost its host placeholder');
          if (!template.includes('/*__ANALYTICS_ROUTES__*/[]')) throw new Error('analytics loader template lost its route placeholder');
          // Route allowlist generated from what this build emitted (M1): unknown paths are reported as /other/.
          const htmlFiles = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.html'));
          const routes = analyticsRoutes(htmlFiles);
          // Pages reported as /other/ (404.html, which also serves unknown routes) send only the origin as referrer (r3).
          for (const f of otherRoutePages(htmlFiles, routes)) {
            const url = new URL(f, dir);
            await writeFile(url, addOtherReferrerMeta(await readFile(url, 'utf8')));
          }
          await writeFile(
            new URL('ldw-analytics.js', dir),
            template.replace('/*__ANALYTICS_HOSTS__*/[]', JSON.stringify(hosts)).replace('/*__ANALYTICS_ROUTES__*/[]', JSON.stringify(routes)),
          );
          await writeFile(new URL('ldw-consent.css', dir), await readFile(fileURLToPath(new URL('./src/analytics/ldw-consent.css', import.meta.url)), 'utf8'));
          const headersUrl = new URL('_headers', dir);
          await writeFile(headersUrl, extendHeadersFile(await readFile(headersUrl, 'utf8')));
          if (hosts.length > 2) console.warn(`[ldw-analytics] TEST BUILD: extra hosts baked in (${hosts.slice(2).join(', ')}). Never release this build.`);
        },
      },
    },
  ],
  vite: {
    resolve: { alias: { '~care-styles': careStyles } },
    build: {
      // Keep @fontsource woff2 as same-origin files; do not inline as data: URLs blocked by font-src 'self'.
      assetsInlineLimit: 0,
      // Gate ON only: keep vendor-prefixed declarations (-webkit-backdrop-filter) that the default esbuild target strips.
      // Gate OFF leaves the default target, so production CSS is not changed by the preview.
      ...(careOptionsPreview ? { cssTarget: 'safari15' } : {}),
    },
  },
});
