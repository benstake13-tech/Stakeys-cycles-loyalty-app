import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard against the whole-environment inlining bug.
 *
 * Vite inlines the WHOLE env object (every VITE_ variable, including
 * server-only secrets like VITE_ONESIGNAL_REST_API_KEY) into the public browser
 * bundle whenever client code indexes `import.meta.env` dynamically, e.g.
 * `import.meta.env[name]` or `(import.meta as any).env?.[key]`. Every env read
 * must therefore be a literal `import.meta.env.VITE_X` property access.
 */

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Removes block and line comments so prose about the anti-pattern is ignored. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const DYNAMIC_ENV_PATTERNS = [
  /import\.meta\.env\s*\[/,
  /import\.meta\.env\s*\?\.\s*\[/,
  /\(\s*import\.meta\s+as\s+any\s*\)\s*\.env\s*\?\.\s*\[/,
  /\(\s*import\.meta\s+as\s+any\s*\)\s*\.env\s*\[/,
];

describe('env access is static (no whole-env leak)', () => {
  it('never indexes import.meta.env dynamically in client source', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles('src')) {
      const text = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of DYNAMIC_ENV_PATTERNS) {
        if (pattern.test(text)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
