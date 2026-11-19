// Website Care plans preview gate: one shared fail-closed AND-gate (src/lib/care-gate.mjs) must switch the markup, the glass CSS and the
// carousel JS (and the Services bridge link) together. Only CARE_OPTIONS_PREVIEW=1 + WORKERS_CI=1 + the exact preview branch renders anything.
// The exact Cloudflare preview branch may auto-supply the first flag; explicit 0 remains OFF.
//   node --test tests/care-gate.unit.mjs        (runs 7 real `astro build`s into temp dirs; does not touch dist/)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CARE_PREVIEW_BRANCH, careOptionsPreviewEnabled } from '../src/lib/care-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('gate function: only flag=1 AND CI=1 AND the exact branch is ON', () => {
  const on = { CARE_OPTIONS_PREVIEW: '1', WORKERS_CI: '1', WORKERS_CI_BRANCH: CARE_PREVIEW_BRANCH };
  assert.equal(careOptionsPreviewEnabled(on), true);
  assert.equal(careOptionsPreviewEnabled({}), false);
  for (const drop of Object.keys(on)) assert.equal(careOptionsPreviewEnabled({ ...on, [drop]: undefined }), false, 'missing ' + drop);
  for (const bad of [
    { CARE_OPTIONS_PREVIEW: '0' }, { CARE_OPTIONS_PREVIEW: 'true' }, { CARE_OPTIONS_PREVIEW: '' }, { CARE_OPTIONS_PREVIEW: ' 1' },
    { WORKERS_CI: '0' }, { WORKERS_CI: 'true' },
    { WORKERS_CI_BRANCH: 'main' }, { WORKERS_CI_BRANCH: CARE_PREVIEW_BRANCH + '-x' }, { WORKERS_CI_BRANCH: 'x' + CARE_PREVIEW_BRANCH }, { WORKERS_CI_BRANCH: CARE_PREVIEW_BRANCH.toUpperCase() },
  ]) assert.equal(careOptionsPreviewEnabled({ ...on, ...bad }), false, JSON.stringify(bad));
});

function cleanEnv() {
  const env = { ...process.env };
  for (const k of ['CARE_OPTIONS_PREVIEW', 'WORKERS_CI', 'WORKERS_CI_BRANCH']) delete env[k];
  return env;
}

function build(extraEnv) {
  const out = mkdtempSync(path.join(tmpdir(), 'care-gate-'));
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', out], { cwd: root, env: { ...cleanEnv(), ...extraEnv }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return out;
}

function inspect(dir) {
  const read = (p) => readFileSync(path.join(dir, p), 'utf8');
  const care = read('services/website-care/index.html');
  const services = read('services/index.html');
  const css = readdirSync(path.join(dir, '_astro')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(path.join(dir, '_astro', f), 'utf8')).join('\n');
  return {
    markup: care.includes('data-care-options-preview') && care.includes('id="care-options"'),
    prices: /\$229|\$499/.test(care),
    bridge: services.includes('care-concept-bridge'),
    css: /care-tier|care-track/.test(css),
    glassCss: /backdrop-filter:blur\(16px\)/.test(css),
    jsFile: existsSync(path.join(dir, 'r5/care-carousel.js')),
    jsRef: care.includes('care-carousel.js'),
  };
}

const ALL_OFF = { markup: false, prices: false, bridge: false, css: false, glassCss: false, jsFile: false, jsRef: false };
const ALL_ON = { markup: true, prices: true, bridge: true, css: true, glassCss: true, jsFile: true, jsRef: true };
const BRANCH = CARE_PREVIEW_BRANCH;

const contexts = [
  ['unset (production / default)', {}, ALL_OFF],
  ['flag only (CARE_OPTIONS_PREVIEW=1)', { CARE_OPTIONS_PREVIEW: '1' }, ALL_OFF],
  ['flag + CI (no branch)', { CARE_OPTIONS_PREVIEW: '1', WORKERS_CI: '1' }, ALL_OFF],
  ['flag + CI + unrelated branch (main)', { CARE_OPTIONS_PREVIEW: '1', WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }, ALL_OFF],
  ['CI + branch without the flag', { WORKERS_CI: '1', WORKERS_CI_BRANCH: BRANCH }, ALL_OFF],
  ['flag + CI + exact preview branch', { CARE_OPTIONS_PREVIEW: '1', WORKERS_CI: '1', WORKERS_CI_BRANCH: BRANCH }, ALL_ON],
];

for (const [name, env, expected] of contexts) {
  test('build context: ' + name + ' -> markup, prices, bridge link, CSS and JS are ' + (expected.markup ? 'ALL present' : 'ALL absent'), () => {
    const dir = build(env);
    try { assert.deepEqual(inspect(dir), expected); } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('a .env file with CARE_OPTIONS_PREVIEW=1 cannot switch anything on (no import.meta.env fallback)', () => {
  const envFile = path.join(root, '.env');
  assert.equal(existsSync(envFile), false, 'refusing to overwrite an existing .env');
  writeFileSync(envFile, 'CARE_OPTIONS_PREVIEW=1\nWORKERS_CI=1\nWORKERS_CI_BRANCH=' + BRANCH + '\n');
  let dir;
  try { dir = build({}); assert.deepEqual(inspect(dir), ALL_OFF); } finally { rmSync(envFile, { force: true }); if (dir) rmSync(dir, { recursive: true, force: true }); }
});
