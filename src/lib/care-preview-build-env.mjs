// Preview-build opt-in is limited to the exact Cloudflare Workers branch build.
// Never override an explicit CARE_OPTIONS_PREVIEW value (including "0").
// The core care-gate.mjs AND-gate remains fail-closed; this only supplies its
// missing flag for an authenticated build context with the expected branch.
import { CARE_PREVIEW_BRANCH } from './care-gate.mjs';

export function applyCarePreviewBuildOptIn(env = process.env) {
  if (env.CARE_OPTIONS_PREVIEW !== undefined) return false;
  if (env.WORKERS_CI !== '1' || env.WORKERS_CI_BRANCH !== CARE_PREVIEW_BRANCH) return false;
  env.CARE_OPTIONS_PREVIEW = '1';
  return true;
}
