// WEB-CLARITY-GUARD-001: negative source/built-asset proof only.
// This does NOT establish comprehensive browser/network privacy compliance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_FILES = 2000;
const MAX_TEXT_BYTES = 8 * 1024 * 1024;
const extensions = new Set(['.html', '.js', '.mjs', '.astro', '.ts', '.tsx', '.css', '.json']);

const markers = [
  ['clarity-host', /(?:^|[^a-z])(?:www\.)?clarity\.ms\b/i],
  ['clarity-session-cookie', /\b_cl(?:ck|sk)\b/i],
  ['clarity-global-call', /\b(?:window|globalThis)\.clarity\s*\(/i],
  ['clarity-npm-sdk', /@microsoft\/clarity\b/i],
  ['clarity-sdk-init', /\bClarity\s*\.\s*(?:init|start|set|event|identify|consent)\s*\(/i],
  ['clarity-loader', /["']clarity["']\s*,\s*["']script["']/i],
  ['clarity-consent-call', /\bclarity\s*\(\s*["'](?:consent|consentv2|identify|event|set|start)\b/i],
];

export function prohibitedClarityMarkers(text) {
  if (typeof text !== 'string') throw new TypeError('source text required');
  return markers.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function filesUnder(relative) {
  const base = path.join(root, relative);
  assert.ok(fs.existsSync(base) && fs.statSync(base).isDirectory(), 'required directory missing: ' + relative);
  const discovered = [];
  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      const stat = fs.lstatSync(full);
      assert.equal(stat.isSymbolicLink(), false, 'source/built asset symlinks not admitted');
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile() && extensions.has(path.extname(entry.name))) {
        assert.ok(stat.size <= MAX_TEXT_BYTES, 'unusually large source/built asset');
        discovered.push(full);
        assert.ok(discovered.length <= MAX_FILES, 'unexpectedly large source/built file tree');
      }
    }
  };
  visit(base);
  return discovered;
}

function verifyNoClarityInFiles(files) {
  assert.ok(files.length > 0, 'source/build must contain eligible files');
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll(path.sep, '/');
    const hits = prohibitedClarityMarkers(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(hits, [], 'unapproved Clarity runtime marker in ' + rel + ': ' + hits.join(', '));
  }
}

test('Clarity marker detector is not vacuous and never emits source contents', () => {
  assert.deepEqual(prohibitedClarityMarkers('https://www.clarity.ms/tag/REDACTED'), ['clarity-host']);
  assert.deepEqual(prohibitedClarityMarkers('window.clarity("consentv2", { analytics_storage: "denied" })'), ['clarity-global-call', 'clarity-consent-call']);
  assert.deepEqual(prohibitedClarityMarkers('cookie="_clck=REDACTED"'), ['clarity-session-cookie']);
  assert.deepEqual(prohibitedClarityMarkers('cookie="_clsk=REDACTED"'), ['clarity-session-cookie']);
  assert.deepEqual(prohibitedClarityMarkers("import Clarity from '@microsoft/clarity'"), ['clarity-npm-sdk']);
  assert.deepEqual(prohibitedClarityMarkers('Clarity.init("REDACTED")'), ['clarity-sdk-init']);
  assert.deepEqual(prohibitedClarityMarkers('Clarity.start("REDACTED")'), ['clarity-sdk-init']);
  assert.deepEqual(prohibitedClarityMarkers('ordinary first-party page without vendor trackers'), []);
  assert.throws(() => prohibitedClarityMarkers(null), TypeError);
});

test('privacy statement remains truthful and default CSP remains restrictive', () => {
  const notice = fs.readFileSync(path.join(root, 'src/pages/privacy.astro'), 'utf8');
  assert.match(notice, /does not intentionally use advertising trackers, behavioral analytics, nonessential cookies/i);
  assert.match(notice, /review the data flow and applicable consent requirements before deployment/i);
  const headers = fs.readFileSync(path.join(root, 'public/_headers'), 'utf8');
  const policy = headers.split('\n').find((line) => /^\s+Content-Security-Policy:/.test(line));
  assert.ok(policy, 'expected public CSP');
  assert.match(policy, /(?:^|;)\s*script-src 'self'(?:;|$)/);
  assert.match(policy, /(?:^|;)\s*connect-src 'self'(?:;|$)/);
  assert.doesNotMatch(policy, /unsafe-inline|clarity\.ms|\*\.(?:com|ms)/i);
});

test('repository-controlled public source contains no unreviewed Clarity instrumentation', () => {
  verifyNoClarityInFiles([...filesUnder('src'), ...filesUnder('public'), path.join(root, 'worker.js')]);
});

test('actual built static HTML and JavaScript contain no Clarity loader or beacon', () => {
  // Must run after npm run build. Missing output is a failing test, not a skip.
  const built = filesUnder('dist');
  assert.ok(built.some((file) => file.endsWith('.html')), 'missing static HTML in build');
  // This Astro build currently emits static HTML without a JavaScript bundle.
  // Any future .js files are still scanned; absence of JS is the safer baseline.
  verifyNoClarityInFiles(built);
});
