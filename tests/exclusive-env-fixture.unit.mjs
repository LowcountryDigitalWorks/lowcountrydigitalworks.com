import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withExclusiveEnvFile } from './exclusive-env-fixture.mjs';

function withFixtureDir(action) {
  const dir = mkdtempSync(path.join(tmpdir(), 'exclusive-env-test-'));
  try { return action(path.join(dir, '.env')); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('exclusive env fixture creates, exposes and removes only its temporary file', () => {
  withFixtureDir(file => {
    assert.equal(withExclusiveEnvFile(file, 'SYNTHETIC=1\n', () => {
      assert.equal(readFileSync(file, 'utf8'), 'SYNTHETIC=1\n');
      return 42;
    }), 42);
    assert.equal(existsSync(file), false);
  });
});

test('exclusive env fixture refuses an existing file without running the action or deleting it', () => {
  withFixtureDir(file => {
    writeFileSync(file, 'EXISTING=1\n', { flag: 'wx' });
    assert.throws(() => withExclusiveEnvFile(file, 'NEW=1\n', () => assert.fail('must not run')), { code: 'EEXIST' });
    assert.equal(readFileSync(file, 'utf8'), 'EXISTING=1\n');
  });
});

test('exclusive env fixture rejects a competing fixture and preserves the first owner', () => {
  withFixtureDir(file => {
    withExclusiveEnvFile(file, 'FIRST=1\n', () => {
      assert.throws(() => withExclusiveEnvFile(file, 'SECOND=1\n', () => assert.fail('must not run')), { code: 'EEXIST' });
      assert.equal(readFileSync(file, 'utf8'), 'FIRST=1\n');
    });
    assert.equal(existsSync(file), false);
  });
});

test('exclusive env fixture removes its own file when the action fails', () => {
  withFixtureDir(file => {
    assert.throws(() => withExclusiveEnvFile(file, 'SYNTHETIC=1\n', () => { throw new Error('synthetic failure'); }), /synthetic failure/);
    assert.equal(existsSync(file), false);
  });
});
