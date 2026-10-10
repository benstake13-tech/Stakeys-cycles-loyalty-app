import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory fake of the small slice of the Supabase query builder the review
// persistence helpers and the "delete all" reset helpers use:
// select().order(), upsert(), delete().eq() and delete().not().
const hoisted = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  upserts: [] as any[],
  deletes: [] as any[],
  error: null as { message: string } | null,
}));

function tableRows(name: string): any[] {
  if (!hoisted.tables[name]) hoisted.tables[name] = [];
  return hoisted.tables[name];
}

function makeBuilder(name: string, mode: 'select' | 'delete' | 'upsert') {
  const builder: any = {
    _eq: null as null | { col: string; val: any },
    select: () => builder,
    order: () => Promise.resolve({ data: tableRows(name), error: hoisted.error }),
    eq: (col: string, val: any) => {
      builder._eq = { col, val };
      return builder;
    },
    not: (col: string, op: string, val: any) => {
      builder._not = { col, op, val };
      return builder;
    },
    _not: null as null | { col: string; op: string; val: any },
    upsert: (p: any) => {
      hoisted.upserts.push({ table: name, payload: p });
      const rows = tableRows(name);
      const idx = rows.findIndex((r) => r.id === p.id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...p };
      else rows.push({ ...p });
      return Promise.resolve({ error: hoisted.error });
    },
    delete: () => {
      hoisted.deletes.push({ table: name });
      return builder;
    },
    then: (resolve: any) => {
      if (mode === 'delete') {
        const rows = tableRows(name);
        if (builder._eq) {
          hoisted.tables[name] = rows.filter((r) => r[builder._eq.col] !== builder._eq.val);
        } else if (builder._not) {
          // `not id is null` matches every row.
          hoisted.tables[name] = [];
        }
      }
      return Promise.resolve({ error: hoisted.error }).then(resolve);
    },
  };
  return builder;
}

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => ({
      select: () => makeBuilder(name, 'select').select(),
      upsert: (p: any) => makeBuilder(name, 'upsert').upsert(p),
      delete: () => makeBuilder(name, 'delete').delete(),
    }),
  }),
}));

import {
  fetchReviewsFromDb,
  upsertReviewToDb,
  deleteReviewFromDb,
  deleteAllCounterSalesFromDb,
  deleteAllOrdersFromDb,
} from './src/api/backendDataService';

beforeEach(() => {
  hoisted.tables = {};
  hoisted.upserts = [];
  hoisted.deletes = [];
  hoisted.error = null;
});

describe('review persistence', () => {
  it('maps snake_case review rows to the CustomerReview shape', async () => {
    hoisted.tables['reviews'] = [
      {
        id: 'review-1',
        customer_uid: 'u1',
        customer_name: 'Ada',
        membership_number: 'STK-1',
        rating: 5,
        title: 'Great service',
        comment: 'Fast and friendly.',
        status: 'published',
        source: 'website',
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    const rows = await fetchReviewsFromDb();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'review-1',
      customerUid: 'u1',
      customerName: 'Ada',
      membershipNumber: 'STK-1',
      rating: 5,
      title: 'Great service',
      status: 'published',
      source: 'website',
    });
  });

  it('upserts a review with snake_case columns', async () => {
    const ok = await upsertReviewToDb({
      id: 'review-2',
      customerName: 'Ben',
      rating: 4,
      comment: 'Good',
      status: 'pending',
      source: 'in_store',
      createdAt: '2026-01-02T00:00:00Z',
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts[0].table).toBe('reviews');
    expect(hoisted.upserts[0].payload).toMatchObject({
      id: 'review-2',
      customer_name: 'Ben',
      rating: 4,
      comment: 'Good',
      status: 'pending',
      source: 'in_store',
    });
  });

  it('deletes a single review by id', async () => {
    hoisted.tables['reviews'] = [{ id: 'review-3' }, { id: 'review-4' }];
    const ok = await deleteReviewFromDb('review-3');
    expect(ok).toBe(true);
    expect(hoisted.deletes[0]).toMatchObject({ table: 'reviews' });
    expect(hoisted.tables['reviews'].map((r) => r.id)).toEqual(['review-4']);
  });
});

describe('clean-slate financial reset helpers', () => {
  it('wipes every counter sale', async () => {
    hoisted.tables['counter_sales'] = [{ id: 's1' }, { id: 's2' }];
    const ok = await deleteAllCounterSalesFromDb();
    expect(ok).toBe(true);
    expect(hoisted.tables['counter_sales']).toEqual([]);
  });

  it('wipes every online order', async () => {
    hoisted.tables['ecommerce_orders'] = [{ id: 'o1' }];
    const ok = await deleteAllOrdersFromDb();
    expect(ok).toBe(true);
    expect(hoisted.tables['ecommerce_orders']).toEqual([]);
  });
});
