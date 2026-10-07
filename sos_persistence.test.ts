import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('updateServiceBookingInDb — SOS column mapping', () => {
  it('maps SOS fields to their snake_case columns', async () => {
    await updateServiceBookingInDb('bk-sos-1', {
      sosStatus: 'location_requested',
      sosLocationRequestedAt: '2026-10-06T10:00:00.000Z',
      sosLocationNote: 'Outside the Co-op on Mill Street',
    });

    const { payload } = hoisted.updates[0];
    expect(payload).toMatchObject({
      sos_status: 'location_requested',
      sos_location_requested_at: '2026-10-06T10:00:00.000Z',
      sos_location_note: 'Outside the Co-op on Mill Street',
    });
  });

  it('maps the confirmed timestamp and never emits undefined SOS keys', async () => {
    await updateServiceBookingInDb('bk-sos-2', {
      sosStatus: 'confirmed',
      sosConfirmedAt: '2026-10-06T10:30:00.000Z',
    });

    const { payload } = hoisted.updates[0];
    expect(payload).toMatchObject({
      sos_status: 'confirmed',
      sos_confirmed_at: '2026-10-06T10:30:00.000Z',
    });
    expect('sos_location_note' in payload).toBe(false);
    expect('sos_location_requested_at' in payload).toBe(false);
  });
});
