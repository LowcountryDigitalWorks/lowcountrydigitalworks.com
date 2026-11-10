import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CssSyntaxError,
  hasActiveCssImport,
  listActiveCssImports,
  parseRootCustomProperties,
  stripCssComments
} from '../scripts/design_token_contract_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = 'brand/css/brand-tokens.css';

test('design token contract validator passes on repository sources', () => {
  const result = spawnSync(process.execPath, ['scripts/validate_design_token_contract.mjs'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(
    result.status,
    0,
    `validate_design_token_contract.mjs failed:\n${result.stdout}\n${result.stderr}`
  );
  assert.match(result.stdout, /PASS/);
});

test('commented declarations cannot mask active drift in :root', () => {
  const css = `
    :root {
      --bg: #000000;
      /* --bg: var(--ldw-soft-white); */
    }
  `;
  const { props } = parseRootCustomProperties(css);
  assert.equal(props.get('--bg'), '#000000');
});

test('conflicting duplicate :root declarations fail closed', () => {
  const css = `
    :root { --muted: #55656D; }
    :root { --muted: #FFFFFF; }
  `;
  const { conflicts } = parseRootCustomProperties(css);
  assert.equal(conflicts.length, 1);
});

test('url() with // does not truncate :root body; later override surfaces conflict', () => {
  const css = `
    :root {
      --bg: url(https://example.test/a);
      --bg: #111111;
    }
  `;
  const { props, conflicts } = parseRootCustomProperties(css);
  assert.equal(props.get('--bg'), '#111111');
  assert.equal(conflicts.length, 0);
});

test('unclosed block comment fails closed', () => {
  const { error } = parseRootCustomProperties(':root { /* unclosed --x: 1; }');
  assert.ok(error);
});

test('quoted string may contain literal /* without closing comment state', () => {
  const css = `:root { --note: "keep /* literal"; --bg: #222; }`;
  const stripped = stripCssComments(css);
  assert.match(stripped, /keep \/\* literal/);
  const { props } = parseRootCustomProperties(css);
  assert.equal(props.get('--bg'), '#222');
});

test('stripCssComments removes block comments but preserves //', () => {
  const css = 'a { background: url(https://example.test/a); } /* hide */\n:root { --x: 1; }';
  const stripped = stripCssComments(css);
  assert.ok(!stripped.includes('hide'));
  assert.match(stripped, /https:\/\/example\.test\/a/);
});

test('commented import cannot satisfy required active import', () => {
  const css = `
    /* @import url("../brand/css/brand-tokens.css"); */
    :root { --bg: white; }
  `;
  assert.equal(hasActiveCssImport(css, 'design/tokens.css', BRAND), false);
  assert.deepEqual(listActiveCssImports(css, 'design/tokens.css'), []);
});

test('remote https import does not satisfy local brand import', () => {
  const css = `@import url("https://evil.example/../brand/css/brand-tokens.css");\n:root { --bg: white; }`;
  assert.equal(hasActiveCssImport(css, 'design/tokens.css', BRAND), false);
});

test('path suffix spoof does not satisfy exact canonical import', () => {
  const css = `@import "../brand/css/brand-tokens.css.evil";\n:root { --bg: white; }`;
  assert.equal(hasActiveCssImport(css, 'design/tokens.css', BRAND), false);
});

test('traversal import resolving outside repo is rejected', () => {
  const css = `@import "../../../../../etc/passwd";\n:root { --bg: white; }`;
  assert.equal(hasActiveCssImport(css, 'design/tokens.css', BRAND), false);
});

test('design/tokens.css url() import resolves to brand tokens exactly', () => {
  const css = `@import url("../brand/css/brand-tokens.css");\n:root { --bg: white; }`;
  assert.equal(hasActiveCssImport(css, 'design/tokens.css', BRAND), true);
  assert.deepEqual(listActiveCssImports(css, 'design/tokens.css'), [BRAND]);
});

test('global.css bare relative import resolves to brand tokens exactly', () => {
  const css = `@import "../../brand/css/brand-tokens.css";\n:root { --bg: white; }`;
  assert.equal(hasActiveCssImport(css, 'src/styles/global.css', BRAND), true);
});

test('stripCssComments throws on unclosed block comment', () => {
  assert.throws(() => stripCssComments('/* oops'), CssSyntaxError);
});
