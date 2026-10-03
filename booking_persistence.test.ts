import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal fake of the Supabase query builder slice used by
// updateServiceBookingInDb: from(table).update(payload).eq(col, val).
const hoisted = vi.hoisted(() => ({
  updates: [] as any[],
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (name: string) => ({
      update: (payload: any) => {
        const builder: any = {
          eq: (col: string, val: any) => {
            hoisted.updates.push({ table: name, payload, col, val });
            return Promise.resolve({ error: null });
          },
        };
        return builder;
      },
    }),
  }),
}));

import { updateServiceBookingInDb } from './src/api/backendDataService';

beforeEach(() => {
  hoisted.updates = [];
});

describe('updateServiceBookingInDb column mapping', () => {
  it('persists the approval fields under their snake_case columns', async () => {
    await updateServiceBookingInDb('bk-1', {
      status: 'confirmed',
      approvalStatus: 'approved',
      approvedAt: '2026-10-03T10:00:00.000Z',
      approvedBy: 'Ben Stakey',
      staffNotes: 'Bring the battery key',
    });

    const { payload } = hoisted.updates[0];
    expect(payload).toMatchObject({
      status: 'confirmed',
      approval_status: 'approved',
      approved_at: '2026-10-03T10:00:00.000Z',
      approved_by: 'Ben Stakey',
      staff_notes: 'Bring the battery key',
    });
  });

  it('persists the saved quote under quoted_price / quote_note', async () => {
    await updateServiceBookingInDb('bk-2', {
      quotedPrice: 129.5,
      quoteNote: 'Includes new chain',
      quoteSentAt: '2026-10-03T11:00:00.000Z',
    });

    const { payload } = hoisted.updates[0];
    expect(payload).toMatchObject({
      quoted_price: 129.5,
      quote_note: 'Includes new chain',
      quote_sent_at: '2026-10-03T11:00:00.000Z',
    });
  });

  it('never emits undefined keys for optional numbers', async () => {
    await updateServiceBookingInDb('bk-3', { status: 'declined' });
    const { payload } = hoisted.updates[0];
    expect('quoted_price' in payload).toBe(false);
    expect('quote_note' in payload).toBe(false);
  });
});
