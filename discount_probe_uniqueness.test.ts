import { describe, it, expect, vi } from 'vitest';

/**
 * discount_codes has a UNIQUE index on upper(code). The "Create a discount code"
 * probe used to hardcode 'DIAGTEST', so a second run — or the sibling
 * "Increment discount usage" probe — hit
 *   23505 duplicate key value violates unique constraint "discount_codes_code_upper_uidx".
 * These tests pin the fix: every run must mint a fresh, unique code.
 */
const hoisted = vi.hoisted(() => ({ codes: [] as string[] }));

vi.mock('./src/api/backendDataService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./src/api/backendDataService')>();
  return {
    ...actual,
    upsertDiscountCodeToDb: vi.fn(async (code: { code: string }) => {
      hoisted.codes.push(code.code);
      return true;
    }),
    deleteDiscountCodeFromDb: vi.fn(async () => true),
  };
});

import { FEATURE_TESTS } from './src/utils/featureDiagnostics';

describe('discount code diagnostics probes', () => {
  it('mints a unique code on every run (avoids the upper(code) unique index)', async () => {
    const probe = FEATURE_TESTS.find((t) => t.id === 'discount-code-write')!;
    await probe.run();
    await probe.run();
    await probe.run();

    expect(hoisted.codes).toHaveLength(3);
    const upper = hoisted.codes.map((c) => c.toUpperCase());
    expect(new Set(upper).size).toBe(3);
    for (const c of upper) expect(c).toMatch(/^DIAG/);
  });

  it('does not reuse a fixed code across the two discount probes', async () => {
    hoisted.codes.length = 0;
    const create = FEATURE_TESTS.find((t) => t.id === 'discount-code-write')!;
    const increment = FEATURE_TESTS.find((t) => t.id === 'discount-usage-increment')!;
    await create.run();
    await increment.run();
    const upper = hoisted.codes.map((c) => c.toUpperCase());
    expect(new Set(upper).size).toBe(upper.length);
  });
});
