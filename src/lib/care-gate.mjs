// ONE gate for the Website Care plans preview (#care-options), its glass CSS, its carousel JS and the Services hub bridge link.
// Imported by astro.config.mjs (CSS alias + dist cleanup), src/pages/services/[slug].astro and src/pages/services.astro.
// Build-time only, fail-closed: ALL THREE must hold. Anything else (unset, "0", "true", wrong branch, local build) is OFF.
//   CARE_OPTIONS_PREVIEW === '1'  AND  WORKERS_CI === '1'  AND  WORKERS_CI_BRANCH === CARE_PREVIEW_BRANCH
// There is deliberately no import.meta.env fallback: a .env file can never switch this on.
export const CARE_PREVIEW_BRANCH = 'feature/web-160-coastal-v2c-preview-phaseb-20261109';

const evaluate = (env) => env.CARE_OPTIONS_PREVIEW === '1' && env.WORKERS_CI === '1' && env.WORKERS_CI_BRANCH === CARE_PREVIEW_BRANCH;

// The process environment is read ONCE, by whichever importer runs first (astro.config.mjs, before Astro loads any .env file into process.env),
// and pinned on globalThis, so the config (CSS + JS) and the pages (markup + bridge link) can never disagree. Passing an explicit env object
// (tests) evaluates that object directly and pins nothing.
const PIN = Symbol.for('ldw.care-options-preview-gate');
export function careOptionsPreviewEnabled(env = process.env) {
  if (env !== process.env) return evaluate(env);
  if (!(PIN in globalThis)) globalThis[PIN] = evaluate(process.env);
  return globalThis[PIN];
}
