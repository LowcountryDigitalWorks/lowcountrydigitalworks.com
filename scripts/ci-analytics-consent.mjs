// Hosted test-only analytics build; never deploys or uploads generated assets.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const buildDir = fileURLToPath(new URL('../dist/', import.meta.url));
const command = (name) => process.platform === 'win32' ? `${name}.cmd` : name;

function runCommand(name, args, env) {
  const result = spawnSync(command(name), args, { cwd: root, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`Analytics consent CI failed: ${name} ${args[0]} (${result.error?.message ?? result.status})`);
  }
}

export function runConsentProof({
  run = runCommand,
  clean = () => rmSync(buildDir, { recursive: true, force: true }),
  baseEnv = process.env,
} = {}) {
  const off = {
    ...baseEnv,
    CARE_OPTIONS_PREVIEW: '0',
    WORKERS_CI: '0',
    WORKERS_CI_BRANCH: '',
    ANALYTICS_ENABLED: '0',
    ANALYTICS_TEST_BUILD: '0',
    ANALYTICS_TEST_EXTRA_HOSTS: '',
    ANALYTICS_NETWORK_LOG: '',
    ANALYTICS_EVIDENCE_DIR: '',
  };
  const testOnly = {
    ...off,
    ANALYTICS_ENABLED: '1',
    ANALYTICS_TEST_BUILD: '1',
    ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1',
  };
  try {
    run('npm', ['run', 'build'], testOnly);
    run('npx', ['--no-install', 'playwright', 'test', 'tests/analytics-consent.spec.mjs',
      '--project=chromium-desktop', '--project=chromium-mobile'], testOnly);
  } finally {
    // Even a failed test must remove the test-only build and restore the OFF
    // build before the runner returns. Fail closed if restoration fails.
    try {
      clean();
      run('npm', ['run', 'build'], off);
      run('npm', ['run', 'test:clarity-privacy'], off);
    } catch (error) {
      clean();
      throw error;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runConsentProof();
}
