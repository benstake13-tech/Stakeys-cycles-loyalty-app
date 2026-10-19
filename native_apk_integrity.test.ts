import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('rejects truncated and corrupt Android code before distributing APKs', () => {
  expect(() => execFileSync('python3', ['scripts/check_apk_integrity_test.py'], { stdio: 'pipe' })).not.toThrow();
});
