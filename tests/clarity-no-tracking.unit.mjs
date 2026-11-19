// WEB-CLARITY-GUARD-001: negative source/built-asset proof only.
// This does NOT establish comprehensive browser/network privacy compliance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ANALYTICS_HOSTS, CLARITY_ID, CSP_ADDITIONS, GA4_ID, GTM_ID, analyticsRouteAllowed, extendCsp } from '../src/lib/analytics-config.mjs';

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

// Analytics kit: the ONLY files allowed to name the approved tracker hosts/IDs. Everything else stays under the negative guard.
// ANALYTICS_ENABLED=1 builds emit dist/ldw-analytics.js (a copy of the source loader with the hostnames filled in).
const APPROVED_ANALYTICS_FILES = new Set(['src/lib/analytics-config.mjs', 'src/analytics/ldw-analytics.js', 'dist/ldw-analytics.js']);
const ANALYTICS_ON = process.env.ANALYTICS_ENABLED === '1';

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
    if (APPROVED_ANALYTICS_FILES.has(rel)) continue; // exact paths only; their content is pinned by the analytics tests below
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

// ---- Analytics kit (GA4 + GTM + Clarity). The assertions above stay as they are for the default (OFF) build; these are the parallel ON-build assertions. ----
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const publicCsp = () => read('public/_headers').split('\n').find((line) => /^\s+Content-Security-Policy:/.test(line)).replace(/^\s+Content-Security-Policy:\s*/, '');
const builtCsp = () => read('dist/_headers').split('\n').find((line) => /^\s+Content-Security-Policy:/.test(line)).replace(/^\s+Content-Security-Policy:\s*/, '');
const OLD_PRIVACY = /does not intentionally use advertising trackers, behavioral analytics, nonessential cookies/i;

test('analytics approved files only name the approved IDs and origins (pinned)', () => {
  const approved = new Set(['https://www.googletagmanager.com', 'https://www.clarity.ms', 'https://scripts.clarity.ms', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.google.com', 'https://*.clarity.ms', 'https://c.bing.com']);
  for (const file of ['src/analytics/ldw-analytics.js', 'src/lib/analytics-config.mjs']) {
    const text = read(file);
    for (const url of text.match(/https:\/\/[A-Za-z0-9.*_-]+/g) ?? []) assert.ok(approved.has(url), file + ' names an unapproved origin: ' + url);
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n');
    assert.ok(!/unsafe-eval|unsafe-inline|document\.write|\beval\(|new Function|<iframe|noscript/i.test(code), file + ' (code, comments stripped) contains a forbidden construct');
  }
  const loader = read('src/analytics/ldw-analytics.js');
  assert.match(loader, new RegExp("GA4_ID = '" + GA4_ID + "'")); assert.match(loader, new RegExp("GTM_ID = '" + GTM_ID + "'")); assert.match(loader, new RegExp("CLARITY_ID = '" + CLARITY_ID + "'"));
  assert.equal([...loader.matchAll(/G-[A-Z0-9]{6,}/g)].length, 1); assert.equal([...loader.matchAll(/GTM-[A-Z0-9]+/g)].length, 1);
  assert.ok(loader.includes('/*__ANALYTICS_HOSTS__*/[]'), 'source loader keeps its host placeholder (hosts are baked at build)');
  for (const [directive, origins] of Object.entries(CSP_ADDITIONS)) for (const o of origins) assert.ok(approved.has(o), directive + ' ' + o);
  assert.deepEqual(Object.keys(CSP_ADDITIONS).sort(), ['connect-src', 'img-src', 'script-src'], 'no frame-src / style-src / default-src additions');
});

test('source public/_headers CSP is never changed by the analytics kit', () => {
  const csp = publicCsp();
  assert.doesNotMatch(csp, /googletagmanager|google-analytics|clarity|bing/i);
  assert.doesNotMatch(csp, /frame-src|unsafe-/);
});

test('build mode matches ANALYTICS_ENABLED (OFF default; ON only for an ANALYTICS_ENABLED=1 build)', () => {
  assert.equal(fs.existsSync(path.join(root, 'dist/ldw-analytics.js')), ANALYTICS_ON, 'dist loader presence must match ANALYTICS_ENABLED (run the tests with the same value used for the build)');
});

test('OFF build: no loader, byte-identical _headers, no script reference, old privacy sentence kept', { skip: ANALYTICS_ON }, () => {
  assert.equal(read('dist/_headers'), read('public/_headers'));
  assert.equal(fs.existsSync(path.join(root, 'dist/ldw-analytics.js')), false);
  for (const file of filesUnder('dist').filter((f) => f.endsWith('.html'))) assert.ok(!fs.readFileSync(file, 'utf8').includes('ldw-analytics'), file);
  assert.match(read('dist/privacy/index.html'), OLD_PRIVACY);
  assert.doesNotMatch(read('dist/privacy/index.html'), /uses analytics and site-experience tools/);
});

test('ON build: loader emitted with only the production hosts, CSP extended exactly, privacy disclosure placeholder swapped in', { skip: !ANALYTICS_ON }, () => {
  const loader = read('dist/ldw-analytics.js');
  const hosts = JSON.parse(loader.match(/var HOSTS = (\[[^\]]*\]);/)[1]);
  const extra = String(process.env.ANALYTICS_TEST_EXTRA_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  assert.deepEqual(hosts, [...ANALYTICS_HOSTS, ...extra]);
  if (extra.length === 0) assert.deepEqual(hosts, ['lowcountrydigitalworks.com', 'www.lowcountrydigitalworks.com']);
  const csp = builtCsp();
  assert.equal(csp, extendCsp(publicCsp()));
  assert.doesNotMatch(csp, /unsafe-|frame-src|\*\.(?:com|ms)\b|https:(?:;|\s|$)/);
  assert.match(csp, /(?:^|;)\s*script-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/www\.clarity\.ms https:\/\/scripts\.clarity\.ms(?:;|$)/);
  assert.match(csp, /default-src 'self'/); assert.match(csp, /style-src 'self'(?:;|$)/); assert.match(csp, /frame-ancestors 'none'/);
  const privacy = read('dist/privacy/index.html');
  assert.doesNotMatch(privacy, OLD_PRIVACY, 'a live site with analytics cannot keep the no-analytics sentence');
  assert.match(privacy, /uses analytics and site-experience tools/);
  assert.doesNotMatch(privacy.replace(/<[^>]+>/g, ' '), /placeholder|for eddie|\[Eddie|not legal advice|replace before release/i, 'no placeholder or review text may be visible on the page');
  for (const name of ['Google Analytics', 'Google Tag Manager', 'Microsoft Clarity']) assert.ok(privacy.includes(name), name);
  const htmls = filesUnder('dist').filter((f) => f.endsWith('.html'));
  for (const file of htmls) {
    const html = fs.readFileSync(file, 'utf8');
    const route = '/' + path.relative('dist', file).replace(/\\/g, '/').replace(/(?:^|\/)index\.html$/, '').replace(/\.html$/, '');
    assert.equal((html.match(/<script\b[^>]*\bsrc="\/ldw-analytics\.js"[^>]*>/g) ?? []).length, analyticsRouteAllowed(route === '/' ? '/' : route + '/') ? 1 : 0, file);
    assert.equal((html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/g) ?? []).length, 0, 'no inline scripts: ' + file);
    assert.doesNotMatch(html, /<iframe|<noscript|googletagmanager\.com\/ns\.html/i, file);
  }
});
