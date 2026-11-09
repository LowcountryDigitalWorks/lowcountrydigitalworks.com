import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
