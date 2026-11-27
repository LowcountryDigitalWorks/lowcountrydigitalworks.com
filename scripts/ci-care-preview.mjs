// Source-only hosted validation of the exact-branch Care-ON preview.
// Deliberately never changes Cloudflare provider settings or deploys assets.
import { spawnSync } from 'node:child_process';
import { CARE_PREVIEW_BRANCH } from '../src/lib/care-gate.mjs';

const env = {
  ...process.env,
  CARE_OPTIONS_PREVIEW: '1',
  WORKERS_CI: '1',
  WORKERS_CI_BRANCH: CARE_PREVIEW_BRANCH,
  ANALYTICS_ENABLED: '0',
};
const cmd = (name) => process.platform === 'win32' ? name + '.cmd' : name;
const steps = [
  ['npm', ['run', 'build']],
  ['npx', ['playwright', 'test', 'tests/r5-care-addendum.spec.mjs', 'tests/care-contrast.spec.mjs', '--project=chromium-desktop', '--project=chromium-mobile']],
];
for (const [name, args] of steps) {
  const result = spawnSync(cmd(name), args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('Care preview hosted validation failed:', name, args[0], result.error?.message ?? result.status);
    process.exit(1);
  }
}
