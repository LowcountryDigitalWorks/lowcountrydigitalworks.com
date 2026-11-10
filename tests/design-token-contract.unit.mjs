import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasActiveCssImport,
  listActiveCssImports,
  parseRootCustomProperties,
  stripCssComments
} from '../scripts/design_token_contract_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  assert.notEqual(props.get('--bg'), 'var(--ldw-soft-white)');
});

test('comment-only :root block does not supply effective values', () => {
  const css = `
    /* :root { --bg: var(--ldw-soft-white); } */
    :root {
      --bg: #111111;
    }
  `;
  const { props } = parseRootCustomProperties(css);
  assert.equal(props.get('--bg'), '#111111');
});

test('conflicting duplicate :root declarations fail closed', () => {
  const css = `
    :root { --muted: #55656D; }
    :root { --muted: #FFFFFF; }
  `;
  const { conflicts } = parseRootCustomProperties(css);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].name, '--muted');
});

test('commented import cannot satisfy required active import', () => {
  const css = `
    /* @import url("../brand/css/brand-tokens.css"); */
    :root { --bg: white; }
  `;
  assert.equal(hasActiveCssImport(css, 'brand/css/brand-tokens.css'), false);
  assert.deepEqual(listActiveCssImports(css), []);
});

test('active import is recognized after comment stripping', () => {
  const css = `
    @import url("../brand/css/brand-tokens.css");
    :root { --bg: white; }
  `;
  assert.equal(hasActiveCssImport(css, 'brand/css/brand-tokens.css'), true);
});

test('stripCssComments removes block and line comments', () => {
  const css = 'a { color: red; } /* hide */ // line\n:root { --x: 1; }';
  const stripped = stripCssComments(css);
  assert.ok(!stripped.includes('hide'));
  assert.ok(stripped.includes(':root'));
});
