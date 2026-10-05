import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal fake of the Supabase query builder slice used by the delete helpers:
// from(table).delete().eq(col, val)  and  from(table).delete().not(col, op, val).
const hoisted = vi.hoisted(() => ({
  deletes: [] as any[],
  error: null as { message: string } | null,
}));

vi.mock('./src/shared/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => ({
      delete: () => {
        const record = (kind: string, args: any[]) => {
          hoisted.deletes.push({ table: name, kind, args });
          return Promise.resolve({ error: hoisted.error });
        };
        return {
          eq: (...args: any[]) => record('eq', args),
          not: (...args: any[]) => record('not', args),
        };
      },
    }),
  }),
}));

import {
  deleteServiceBookingFromDb,
  deleteAllServiceBookingsFromDb,
} from './src/shared/api/backendDataService';

beforeEach(() => {
  hoisted.deletes = [];
  hoisted.error = null;
});

describe('deleteServiceBookingFromDb', () => {
  it('deletes a single booking by id', async () => {
    const ok = await deleteServiceBookingFromDb('bk-42');
    expect(ok).toBe(true);
    expect(hoisted.deletes[0]).toEqual({
      table: 'service_bookings',
      kind: 'eq',
      args: ['id', 'bk-42'],
    });
  });

  it('returns false when the delete errors', async () => {
    hoisted.error = { message: 'permission denied' };
    const ok = await deleteServiceBookingFromDb('bk-42');
    expect(ok).toBe(false);
  });
});

describe('deleteAllServiceBookingsFromDb', () => {
  it('deletes every row without an id-specific filter', async () => {
    const ok = await deleteAllServiceBookingsFromDb();
    expect(ok).toBe(true);
    expect(hoisted.deletes).toHaveLength(1);
    expect(hoisted.deletes[0].table).toBe('service_bookings');
    // PostgREST requires a filter; `not id is null` matches all rows.
    expect(hoisted.deletes[0].kind).toBe('not');
    expect(hoisted.deletes[0].args).toEqual(['id', 'is', null]);
  });

  it('reports failure so the caller can warn about local-only deletion', async () => {
    hoisted.error = { message: 'RLS blocked' };
    const ok = await deleteAllServiceBookingsFromDb();
    expect(ok).toBe(false);
  });
});
