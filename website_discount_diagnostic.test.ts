import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  rows: [] as any[],
  error: null as any,
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        order: () => Promise.resolve({ data: hoisted.rows, error: hoisted.error }),
        eq: () => chain,
      };
      return chain;
    },
  }),
}));

import { FEATURE_TESTS } from './src/utils/featureDiagnostics';

const test = FEATURE_TESTS.find((t) => t.id === 'website-discount-codes')!;

beforeEach(() => {
  hoisted.rows = [];
  hoisted.error = null;
});

describe('website discount-code diagnostic', () => {
  it('exists and targets the till area', () => {
    expect(test).toBeTruthy();
    expect(test.area).toBe('till');
  });

  it('passes when the live table has an active public code', async () => {
    hoisted.rows = [
      { id: 'disc-web-5off', code: 'WEB-5OFF', title: 'Welcome 5% off', type: 'percent', value: 5, status: 'active', audience: 'public' },
    ];
    const res = await test.run();
    expect(res.status).toBe('pass');
    expect(res.detail).toContain('WEB-5OFF');
  });

  it('warns when no public code is active, pointing at the generator', async () => {
    const res = await test.run();
    expect(res.status).toBe('warn');
    expect(res.hint).toMatch(/Website visitor set/i);
  });

  it('fails and surfaces the raw error when the table cannot be read', async () => {
    hoisted.error = { message: 'permission denied for table discount_codes' };
    const res = await test.run();
    expect(res.status).toBe('fail');
    expect(res.detail).toContain('permission denied');
  });
});
