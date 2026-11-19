// Analytics kit (GA4 + GTM + Clarity): gate, CSP extension, loader behaviour and hostname guard.
//   node --test tests/analytics.unit.mjs   (runs 8 real `astro build`s into temp dirs; does not touch dist/; never touches the network)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ANALYTICS_EXCLUDED_PREFIXES, ANALYTICS_HOSTS, CSP_ADDITIONS, OTHER_ROUTE, analyticsEnabled, analyticsHosts, analyticsRouteAllowed, analyticsRoutes, assertNoStrayTestHosts, extendCsp, OTHER_REFERRER_META, addOtherReferrerMeta, otherRoutePages } from '../src/lib/analytics-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicHeaders = readFileSync(path.join(root, 'public/_headers'), 'utf8');
const publicCsp = publicHeaders.split('\n').find((l) => /^\s+Content-Security-Policy:/.test(l)).replace(/^\s+Content-Security-Policy:\s*/, '');

test('gate: only ANALYTICS_ENABLED=1 is ON; test hosts ignored unless ON', () => {
  assert.equal(analyticsEnabled({ ANALYTICS_ENABLED: '1' }), true);
  for (const v of [undefined, '', '0', 'true', 'yes', ' 1', '1 ', 'on']) assert.equal(analyticsEnabled({ ANALYTICS_ENABLED: v }), false, String(v));
  assert.deepEqual(analyticsHosts({}), ANALYTICS_HOSTS);
  assert.deepEqual(analyticsHosts({ ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }), ANALYTICS_HOSTS, 'extra hosts need ANALYTICS_ENABLED=1');
  assert.deepEqual(analyticsHosts({ ANALYTICS_ENABLED: '1', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }), ANALYTICS_HOSTS, 'extra hosts also need ANALYTICS_TEST_BUILD=1');
  assert.deepEqual(analyticsHosts({ ANALYTICS_ENABLED: '1', ANALYTICS_TEST_BUILD: '1', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1, localhost' }), [...ANALYTICS_HOSTS, '127.0.0.1', 'localhost']);
});

test('release guard (L3): a stray ANALYTICS_TEST_EXTRA_HOSTS without ANALYTICS_TEST_BUILD=1 throws, in any analytics mode', () => {
  for (const env of [{ ANALYTICS_TEST_EXTRA_HOSTS: 'evil.pages.dev' }, { ANALYTICS_ENABLED: '1', ANALYTICS_TEST_EXTRA_HOSTS: 'evil.pages.dev,127.0.0.1' }, { ANALYTICS_ENABLED: '1', ANALYTICS_TEST_BUILD: '0', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }]) {
    assert.throws(() => assertNoStrayTestHosts(env), /Refusing to build/, JSON.stringify(env));
  }
  for (const env of [{}, { ANALYTICS_ENABLED: '1' }, { ANALYTICS_TEST_EXTRA_HOSTS: ' , ' }, { ANALYTICS_ENABLED: '1', ANALYTICS_TEST_BUILD: '1', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }]) {
    assert.doesNotThrow(() => assertNoStrayTestHosts(env), JSON.stringify(env));
  }
});

test('route allowlist (M1): built index pages only, canonical trailing slash, no 404 page, no private route, no odd shapes', () => {
  assert.deepEqual(
    analyticsRoutes(['index.html', '404.html', 'share/index.html', 'admin/x/index.html', 'services/websites/index.html', 'connect/index.html', 'notes.html', 'sharepoint/index.html']),
    ['/', '/connect/', '/services/websites/', '/sharepoint/'],
  );
  assert.throws(() => analyticsRoutes(['index.html', 'Foo Bar/index.html']), /unexpected route shape/);
  assert.throws(() => analyticsRoutes(['404.html']), /no home page/);
  assert.equal(OTHER_ROUTE, '/other/');
});

test('referrer meta (r3): only pages reported as /other/ get it (404.html, unlisted pages); allowlisted and private pages never; inserted once after charset', () => {
  const files = ['index.html', '404.html', 'share/index.html', 'share/x.html', 'admin/x/index.html', 'connect/index.html', 'notes.html', 'draft/index.html'];
  const routes = ['/', '/connect/'];
  assert.deepEqual(otherRoutePages(files, routes), ['404.html', 'draft/index.html', 'notes.html']);
  assert.equal(OTHER_REFERRER_META, '<meta name="referrer" content="origin">');
  assert.equal(addOtherReferrerMeta('<html><head><meta charset="utf-8"><title>x</title></head></html>'), '<html><head><meta charset="utf-8"><meta name="referrer" content="origin"><title>x</title></head></html>');
  assert.throws(() => addOtherReferrerMeta('<head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head>'), /already declares/);
  assert.throws(() => addOtherReferrerMeta('<p>no head</p>'), /no <head>/);
});

test('CSP extension changes only script-src, connect-src and img-src; no unsafe-*, no frame-src, no bare wildcards', () => {
  const out = extendCsp(publicCsp);
  const parse = (p) => Object.fromEntries(p.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
  const before = parse(publicCsp); const after = parse(out);
  assert.deepEqual(Object.keys(after), Object.keys(before));
  for (const k of Object.keys(before)) {
    if (CSP_ADDITIONS[k]) assert.deepEqual(after[k], [...before[k], ...CSP_ADDITIONS[k]], k);
    else assert.deepEqual(after[k], before[k], k + ' must not change');
  }
  assert.ok(!/unsafe-|frame-src|\*\.(com|ms)\b/.test(out));
  assert.throws(() => extendCsp(out), /already contains/);
  assert.throws(() => extendCsp("default-src 'self'"), /no script-src/);
});

function loaderCode(hosts = ANALYTICS_HOSTS, routes = ['/']) {
  return readFileSync(path.join(root, 'src/analytics/ldw-analytics.js'), 'utf8').replace('/*__ANALYTICS_HOSTS__*/[]', JSON.stringify(hosts)).replace('/*__ANALYTICS_ROUTES__*/[]', JSON.stringify(routes));
}
// A sandbox where ANY touch of window/document/navigator/storage throws: a loader that exits early on a non-production host or an excluded route never reaches them.
function runGuarded(location) {
  const trap = (name) => new Proxy({}, { get() { throw new Error('loader touched ' + name); }, set() { throw new Error('loader touched ' + name); } });
  vm.runInNewContext(loaderCode(), { window: trap('window'), document: trap('document'), navigator: trap('navigator'), location, String, Date, URL, encodeURIComponent });
}

test('loader hostname guard: production hosts only; nothing is touched elsewhere (no banner, no storage, no listeners, no requests)', () => {
  for (const hostname of ['localhost', '127.0.0.1', 'ldw-site.example.workers.dev', 'preview-abc.lowcountrydigitalworks.workers.dev', 'staging.lowcountrydigitalworks.com', 'evil-lowcountrydigitalworks.com', 'lowcountrydigitalworks.com.evil.example', '', 'lowcountrydigitalworks.com.']) {
    assert.doesNotThrow(() => runGuarded({ hostname, pathname: '/' }), hostname);
  }
});

test('loader route guard: /share, /admin and /api (and children) are excluded even on a production host; both lists are identical', () => {
  for (const pathname of ['/share', '/share/', '/share/continue', '/SHARE/x', '/admin', '/admin/x', '/api', '/api/v1']) {
    assert.doesNotThrow(() => runGuarded({ hostname: 'lowcountrydigitalworks.com', pathname }), pathname);
    assert.equal(analyticsRouteAllowed(pathname), false, pathname);
  }
  for (const pathname of ['/', '/connect/', '/discovery/', '/services/websites/', '/sharepoint/', '/administrator/', '/apiary/']) assert.equal(analyticsRouteAllowed(pathname), true, pathname);
  assert.throws(() => runGuarded({ hostname: 'www.lowcountrydigitalworks.com', pathname: '/connect/' }), /loader touched/, 'production host + public route does run');
  const listed = JSON.parse(loaderCode().match(/var EXCLUDED = (\[[^\]]*\]);/)[1].replaceAll("'", '"'));
  assert.deepEqual(listed, ANALYTICS_EXCLUDED_PREFIXES);
});

function cleanEnv() {
  const env = { ...process.env };
  for (const k of ['ANALYTICS_ENABLED', 'ANALYTICS_TEST_BUILD', 'ANALYTICS_TEST_EXTRA_HOSTS']) delete env[k];
  return env;
}
function build(extraEnv, { expectFail = false } = {}) {
  const out = mkdtempSync(path.join(tmpdir(), 'analytics-'));
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', out], { cwd: root, env: { ...cleanEnv(), ...extraEnv }, encoding: 'utf8' });
  if (expectFail) {
    assert.notEqual(r.status, 0, 'build must fail');
    assert.match(r.stderr + r.stdout, /ANALYTICS_TEST_EXTRA_HOSTS is set .* without ANALYTICS_TEST_BUILD=1/);
    assert.equal(existsSync(path.join(out, 'ldw-analytics.js')), false, 'failed build emits no loader');
    return out;
  }
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return out;
}
function htmlFiles(dir) { return readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => path.join(dir, f)); }
function assertOff(dir, label) {
  assert.equal(existsSync(path.join(dir, 'ldw-analytics.js')), false, label + ': loader');
  assert.equal(readFileSync(path.join(dir, '_headers'), 'utf8'), publicHeaders, label + ': _headers byte-identical to source');
  for (const f of htmlFiles(dir)) {
    const html = readFileSync(f, 'utf8');
    assert.ok(!html.includes('ldw-analytics') && !html.includes('data-ldw-'), label + ': ' + f);
    assert.ok(!/googletagmanager|google-analytics|clarity\.ms|G-127KLSQHRB|GTM-WZJ8HHKK|zabyszkk6y/.test(html), label + ': ' + f);
    assert.ok(!html.includes('<meta name="referrer"'), label + ': no referrer meta when OFF ' + f);
  }
  assert.match(readFileSync(path.join(dir, 'privacy/index.html'), 'utf8'), /does not intentionally use advertising trackers, behavioral analytics, nonessential cookies/);
  assert.doesNotMatch(readFileSync(path.join(dir, 'privacy/index.html'), 'utf8'), /uses analytics and site-experience tools/);
}
function assertOn(dir, expectedHosts) {
  const loader = readFileSync(path.join(dir, 'ldw-analytics.js'), 'utf8');
  assert.deepEqual(JSON.parse(loader.match(/var HOSTS = (\[[^\]]*\]);/)[1]), expectedHosts);
  const routes = JSON.parse(loader.match(/var ROUTES = (\[[^\]]*\]);/)[1]);
  assert.deepEqual(routes, analyticsRoutes(htmlFiles(dir).map((f) => path.relative(dir, f))), 'ROUTES = the pages this build emitted');
  assert.ok(routes.includes('/') && routes.includes('/connect/') && routes.includes('/services/websites/'), 'core routes listed');
  assert.ok(!routes.some((r) => r === OTHER_ROUTE || /404|^\/(share|admin|api)(\/|$)/.test(r)), 'no 404, /other/ or private route');
  assert.equal(readFileSync(path.join(dir, '_headers'), 'utf8'), publicHeaders.replace(publicCsp, extendCsp(publicCsp)));
  assert.equal(readFileSync(path.join(dir, 'ldw-consent.css'), 'utf8'), readFileSync(path.join(root, 'src/analytics/ldw-consent.css'), 'utf8'));
  for (const f of htmlFiles(dir)) {
    const html = readFileSync(f, 'utf8');
    const excluded = !analyticsRouteAllowed('/' + path.relative(dir, path.dirname(f)).replaceAll(path.sep, '/') + '/');
    assert.equal((html.match(/<script\b[^>]*\bsrc="\/ldw-analytics\.js"[^>]*>/g) ?? []).length, excluded ? 0 : 1, f);
    assert.equal((html.match(/href="\/ldw-consent\.css"/g) ?? []).length, excluded ? 0 : 1, f);
    assert.equal((html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/g) ?? []).length, 0, 'no inline script ' + f);
    const rel = path.relative(dir, f).replaceAll(path.sep, '/');
    assert.equal((html.match(/<meta name="referrer"[^>]*>/g) ?? []).length, otherRoutePages([rel], routes).length, 'referrer meta only on /other/ pages (r3) ' + f);
  }
  assert.equal((readFileSync(path.join(dir, '404.html'), 'utf8').match(/<meta name="referrer" content="origin">/g) ?? []).length, 1, '404 page sends only the origin as referrer');
  assert.match(readFileSync(path.join(dir, 'privacy/index.html'), 'utf8'), /uses analytics and site-experience tools/);
  assert.doesNotMatch(readFileSync(path.join(dir, 'privacy/index.html'), 'utf8').replace(/<[^>]+>/g, ' '), /placeholder|for eddie|\[Eddie|not legal advice|replace before release/i);
}

test('real builds: unset / 0 / true / empty / test-hosts-without-flag are fully OFF', () => {
  for (const [label, env] of [['unset', {}], ['0', { ANALYTICS_ENABLED: '0' }], ['true', { ANALYTICS_ENABLED: 'true' }], ['empty', { ANALYTICS_ENABLED: '' }], ['hosts + test marker, flag off', { ANALYTICS_TEST_BUILD: '1', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }]]) assertOff(build(env), label);
});

test('real builds (L3): a stray ANALYTICS_TEST_EXTRA_HOSTS fails the build, OFF or ON, unless ANALYTICS_TEST_BUILD=1', () => {
  build({ ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }, { expectFail: true });
  build({ ANALYTICS_ENABLED: '1', ANALYTICS_TEST_EXTRA_HOSTS: 'evil.pages.dev,127.0.0.1' }, { expectFail: true });
});

test('real build: a .env file alone cannot half-enable (config and pages read one pinned gate)', () => {
  const envFile = path.join(root, '.env');
  assert.equal(existsSync(envFile), false, 'refusing to overwrite an existing .env');
  writeFileSync(envFile, 'ANALYTICS_ENABLED=1\nANALYTICS_TEST_EXTRA_HOSTS=127.0.0.1\n');
  try { assertOff(build({}), '.env only'); } finally { unlinkSync(envFile); }
});

test('real builds: ANALYTICS_ENABLED=1 is ON with only the production hosts; test hosts are baked only when requested', () => {
  assertOn(build({ ANALYTICS_ENABLED: '1' }), ['lowcountrydigitalworks.com', 'www.lowcountrydigitalworks.com']);
  assertOn(build({ ANALYTICS_ENABLED: '1', ANALYTICS_TEST_BUILD: '1', ANALYTICS_TEST_EXTRA_HOSTS: '127.0.0.1' }), ['lowcountrydigitalworks.com', 'www.lowcountrydigitalworks.com', '127.0.0.1']);
});
