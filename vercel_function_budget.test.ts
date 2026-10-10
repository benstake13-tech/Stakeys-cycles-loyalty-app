import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vercel Hobby (free) allows a maximum of 12 Serverless Functions per deployment,
 * and for a non-Next framework (this app is Vite) every file under `api/` becomes
 * one function. Files/directories prefixed with `_` are ignored by Vercel and do
 * not count. Exceeding the cap makes the WHOLE deployment fail, which surfaces as
 * the live domain silently serving an older build — so guard the budget here.
 *
 * https://vercel.com/docs/functions/runtimes#functions-created-per-deployment
 */
const HOBBY_FUNCTION_LIMIT = 12;

function isFunctionFile(relPath: string) {
  if (!relPath.endsWith('.js')) return false;
  // Any path segment starting with `_` (e.g. `_shared.js`, `_lib/`) is ignored.
  return !relPath.split(path.sep).some((seg) => seg.startsWith('_'));
}

function collectFunctionFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      out.push(...collectFunctionFiles(full, base));
    } else if (isFunctionFile(rel)) {
      out.push(rel);
    }
  }
  return out;
}

describe('Vercel serverless function budget', () => {
  const apiDir = path.resolve(__dirname, 'api');

  it('stays within the Hobby plan limit of 12 functions per deployment', () => {
    const functions = collectFunctionFiles(apiDir);
    expect(
      functions.length,
      `Too many Vercel functions (${functions.length}/${HOBBY_FUNCTION_LIMIT}). ` +
        `Consolidate related routes into an [action].js dispatcher instead of ` +
        `adding another file. Found:\n${functions.sort().join('\n')}`
    ).toBeLessThanOrEqual(HOBBY_FUNCTION_LIMIT);
  });

  it('does not deploy underscore-prefixed helpers as functions', () => {
    const functions = collectFunctionFiles(apiDir);
    expect(functions.some((f) => f.includes('_shared'))).toBe(false);
  });
});
