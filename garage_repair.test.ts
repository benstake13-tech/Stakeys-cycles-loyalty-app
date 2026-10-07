import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake the Supabase query-builder slices used by the customer_bikes helpers.
// Every builder method returns `this`; the builder is thenable and resolves to
// the configured result. Calls are captured so tests can assert the query shape.
const hoisted = vi.hoisted(() => ({
  calls: [] as { table: string; op: string; args: any[] }[],
  rows: [] as any[],
  deleteRows: [] as any[],
  updateRows: [] as any[],
  error: null as any,
}));

function makeBuilder(table: string) {
  const record = (op: string, ...args: any[]) => hoisted.calls.push({ table, op, args });
  let op = 'select';
  const builder: any = {
    select: (...a: any[]) => { record('select', ...a); return builder; },
    eq: (...a: any[]) => { record('eq', ...a); return builder; },
    in: (...a: any[]) => { record('in', ...a); return builder; },
    or: (...a: any[]) => { record('or', ...a); return builder; },
    update: (...a: any[]) => { op = 'update'; record('update', ...a); return builder; },
    delete: (...a: any[]) => { op = 'delete'; record('delete', ...a); return builder; },
    then: (resolve: any) => {
      const data = op === 'delete' ? hoisted.deleteRows : op === 'update' ? hoisted.updateRows : hoisted.rows;
      return Promise.resolve({ data, error: hoisted.error }).then(resolve);
    },
  };
  return builder;
}

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => makeBuilder(name),
  }),
}));

import {
  fetchCustomerBikesFromDb,
  reassignBikesToOwner,
  deleteBikesByIds,
} from './src/api/backendDataService';

beforeEach(() => {
  hoisted.calls = [];
  hoisted.rows = [];
  hoisted.deleteRows = [];
  hoisted.updateRows = [];
  hoisted.error = null;
});

describe('customer_bikes ownership query', () => {
  it('filters by UUID + membership when a real membership number is present', async () => {
    await fetchCustomerBikesFromDb('uuid-1', '124');
    const orCall = hoisted.calls.find((c) => c.op === 'or');
    expect(orCall?.args[0]).toBe('customer_id.eq.uuid-1,customer_id.eq.124');
    expect(hoisted.calls.some((c) => c.op === 'eq' && c.args[1] === '')).toBe(false);
  });

  it('filters by UUID only when no membership number is given', async () => {
    await fetchCustomerBikesFromDb('uuid-1');
    expect(hoisted.calls.find((c) => c.op === 'eq')?.args).toEqual(['customer_id', 'uuid-1']);
    expect(hoisted.calls.some((c) => c.op === 'or')).toBe(false);
  });

  it('never adds a blank membership filter for an empty string', async () => {
    await fetchCustomerBikesFromDb('uuid-1', '');
    expect(hoisted.calls.find((c) => c.op === 'eq')?.args).toEqual(['customer_id', 'uuid-1']);
    expect(hoisted.calls.some((c) => c.op === 'or')).toBe(false);
    // The regression: `customer_id.eq.` matches every NULL row -> whole workshop.
    expect(hoisted.calls.some((c) => c.op === 'or' && String(c.args[0]).includes('customer_id.eq.'))).toBe(false);
  });

  it('treats whitespace-only membership as absent', async () => {
    await fetchCustomerBikesFromDb('uuid-1', '   ');
    expect(hoisted.calls.find((c) => c.op === 'eq')?.args).toEqual(['customer_id', 'uuid-1']);
    expect(hoisted.calls.some((c) => c.op === 'or')).toBe(false);
  });

  it('maps rows to CustomerBike objects', async () => {
    hoisted.rows = [{ id: 'b1', brand: 'Trek', model: 'FX 3', category: 'cycle', created_at: '2026-10-01T00:00:00Z' }];
    const bikes = await fetchCustomerBikesFromDb('uuid-1');
    expect(bikes).toHaveLength(1);
    expect(bikes[0]).toMatchObject({ id: 'b1', brand: 'Trek', model: 'FX 3', addedAt: '2026-10-01' });
  });
});

describe('reassignBikesToOwner', () => {
  it('re-points membership-keyed rows to the profile UUID', async () => {
    hoisted.updateRows = [{ id: 'b1' }, { id: 'b2' }];
    const n = await reassignBikesToOwner('uuid-1', '124');
    expect(n).toBe(2);
    expect(hoisted.calls.find((c) => c.op === 'update')?.args[0]).toEqual({ customer_id: 'uuid-1' });
    expect(hoisted.calls.find((c) => c.op === 'eq')?.args).toEqual(['customer_id', '124']);
  });

  it('does nothing without a membership number', async () => {
    const n = await reassignBikesToOwner('uuid-1', '');
    expect(n).toBe(0);
    expect(hoisted.calls).toHaveLength(0);
  });
});

describe('deleteBikesByIds', () => {
  it('deletes by id scoped to the owning customer', async () => {
    hoisted.deleteRows = [{ id: 'b1' }];
    const n = await deleteBikesByIds('uuid-1', ['b1']);
    expect(n).toBe(1);
    expect(hoisted.calls.find((c) => c.op === 'eq')?.args).toEqual(['customer_id', 'uuid-1']);
    expect(hoisted.calls.find((c) => c.op === 'in')?.args).toEqual(['id', ['b1']]);
  });

  it('does nothing for an empty id list', async () => {
    const n = await deleteBikesByIds('uuid-1', []);
    expect(n).toBe(0);
    expect(hoisted.calls).toHaveLength(0);
  });
});

describe('fetchCustomerBikesFromDbDetailed', () => {
  it('returns the bikes and no error on success', async () => {
    hoisted.rows = [{ id: 'b1', brand: 'Trek', model: 'FX', category: 'cycle' }];
    const { bikes, error } = await (await import('./src/api/backendDataService')).fetchCustomerBikesFromDbDetailed('uuid-1', '124');
    expect(error).toBeUndefined();
    expect(bikes.map((b) => b.id)).toEqual(['b1']);
  });

  it('surfaces the underlying error so a hidden garage is explainable', async () => {
    hoisted.rows = [];
    hoisted.error = { message: 'permission denied for table customer_bikes' };
    const { bikes, error } = await (await import('./src/api/backendDataService')).fetchCustomerBikesFromDbDetailed('uuid-1');
    expect(bikes).toEqual([]);
    expect(error).toContain('permission denied');
  });
});
