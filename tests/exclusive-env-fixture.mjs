// Test-only helper: exclusively create a temporary .env in a controlled checkout.
import { closeSync, openSync, unlinkSync, writeFileSync } from 'node:fs';

export function withExclusiveEnvFile(file, contents, action) {
  // 'wx' atomically refuses existing files (including symlinks). If opening
  // fails, nothing is owned by this fixture and there must be no cleanup.
  const fd = openSync(file, 'wx', 0o600);
  try {
    try { writeFileSync(fd, contents, 'utf8'); } finally { closeSync(fd); }
    return action();
  } finally {
    unlinkSync(file);
  }
}
