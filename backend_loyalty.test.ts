import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture every insert/upsert call so we can assert on the payloads.
const hoisted = vi.hoisted(() => ({
  inserts: [] as any[],
  upserts: [] as any[],
  insertResults: [] as any[],
  upsertResults: [] as any[],
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      insert: (payload: any) => {
        hoisted.inserts.push({ table, payload });
        return Promise.resolve(hoisted.insertResults.shift() ?? { error: null });
      },
      upsert: (payload: any, opts: any) => {
        hoisted.upserts.push({ table, payload, opts });
        return Promise.resolve(hoisted.upsertResults.shift() ?? { error: null });
      },
    }),
  }),
}));

import { insertStampLogToDb, ensureProfileRowInDb, updateUserProfileInDb } from './src/api/backendDataService';

const log = {
  id: 'log-1',
  customerId: '11111111-1111-1111-1111-111111111111',
  customerName: 'Ada',
  membershipNumber: 'STK-1',
  staffId: 'staff-1',
  staffName: 'Ben',
  action: 'add_stamp' as const,
  stampsBefore: 3,
  stampsAfter: 4,
  timestamp: new Date('2026-10-03T12:00:00Z'),
  note: 'Added visit stamp (4/10)',
};

beforeEach(() => {
  hoisted.inserts = [];
  hoisted.upserts = [];
  hoisted.insertResults = [];
  hoisted.upsertResults = [];
});

describe('insertStampLogToDb', () => {
  it('writes the full payload when the schema matches', async () => {
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(1);
    expect(hoisted.inserts[0].payload.action).toBe('add_stamp');
    expect(hoisted.inserts[0].payload.customer_id).toBe(log.customerId);
    // user_id must be supplied so a NOT NULL legacy column is satisfied.
    expect(hoisted.inserts[0].payload.user_id).toBe(log.customerId);
  });

  it('does not set user_id when the customer id is not a UUID', async () => {
    await insertStampLogToDb({ ...log, customerId: 'STK-839201' } as any);
    expect(hoisted.inserts[0].payload.user_id).toBeUndefined();
  });

  it('retries on a not-null violation (23502) from a legacy user_id column', async () => {
    hoisted.insertResults = [
      { error: { code: '23502', message: 'null value in column "user_id"' } },
      { error: null },
    ];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(2);
    expect(hoisted.inserts[1].payload.user_id).toBe(log.customerId);
  });

  it('retries with legacy ledger columns when amount/source/created_at are NOT NULL', async () => {
    // The live points-ledger schema rejects the app payload with 23502 (amount
    // is NOT NULL). The second attempt supplies amount/source/created_at.
    hoisted.insertResults = [
      { error: { code: '23502', message: 'null value in column "amount"' } },
      { error: null },
    ];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(2);
    const retry = hoisted.inserts[1].payload;
    expect(retry.amount).toBe(1);
    expect(retry.source).toBe('visit');
    expect(typeof retry.created_at).toBe('string');
    expect(hoisted.inserts[0].payload.amount).toBeUndefined();
  });

  it('uses a negative amount for a redemption so the amount check passes', async () => {
    hoisted.insertResults = [
      { error: { code: '23502', message: 'null value in column "amount"' } },
      { error: null },
    ];
    await insertStampLogToDb({
      ...log,
      action: 'redeem_reward',
      stampsBefore: 10,
      stampsAfter: 0,
    } as any);
    expect(hoisted.inserts[1].payload.amount).toBe(-10);
  });

  it('falls back to the bare legacy shape when even the ledger columns are unknown', async () => {
    // PGRST204 three times: the app payload, the ledger payload and the minimal
    // ledger payload all reference columns the oldest schema lacks, so only
    // reason + staff_id remain.
    hoisted.insertResults = [
      { error: { code: 'PGRST204', message: "Could not find the 'action' column" } },
      { error: { code: 'PGRST204', message: "Could not find the 'action' column" } },
      { error: { code: 'PGRST204', message: "Could not find the 'action' column" } },
      { error: null },
    ];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(4);
    const retry = hoisted.inserts[3].payload;
    expect(retry.reason).toBe(log.note);
    expect(retry.staff_id).toBe(log.staffId);
    expect(retry.action).toBeUndefined();
    expect(retry.amount).toBeUndefined();
  });

  it('drops user_id when a FK to profiles rejects the customer id (23503)', async () => {
    hoisted.insertResults = [
      { error: { code: '23503', message: 'violates foreign key constraint "stamp_logs_user_id_fkey"' } },
      { error: { code: '23503', message: 'violates foreign key constraint "stamp_logs_user_id_fkey"' } },
      { error: null },
    ];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(3);
    expect(hoisted.inserts[2].payload.user_id).toBeUndefined();
    expect(hoisted.inserts[2].payload.id).toBe(log.id);
    expect(hoisted.inserts[2].payload.customer_id).toBe(log.customerId);
    expect(hoisted.inserts[2].payload.stamps_after).toBe(4);
    expect(hoisted.inserts[2].payload.amount).toBe(1);
  });

  it('does not retry for a non-schema error', async () => {
    hoisted.insertResults = [{ error: { code: 'XX000', message: 'unexpected failure' } }];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(false);
    expect(hoisted.inserts).toHaveLength(1);
  });

  it('retries when the anon role has no table privileges yet (42501)', async () => {
    hoisted.insertResults = [
      { error: { code: '42501', message: 'permission denied for table stamp_logs' } },
      { error: null },
    ];
    const ok = await insertStampLogToDb(log as any);
    expect(ok).toBe(true);
    expect(hoisted.inserts).toHaveLength(2);
  });
});

describe('ensureProfileRowInDb', () => {
  it('upserts a profile row with the mapped columns', async () => {
    const ok = await ensureProfileRowInDb({
      uid: '22222222-2222-2222-2222-222222222222',
      displayName: 'Ada',
      email: 'ada@example.com',
      membershipNumber: 'STK-2',
      stamps: 2,
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts).toHaveLength(1);
    const { table, payload, opts } = hoisted.upserts[0];
    expect(table).toBe('profiles');
    expect(payload.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(payload.display_name).toBe('Ada');
    expect(payload.completed_cards).toBe(0);
    expect(opts.onConflict).toBe('id');
    expect(opts.ignoreDuplicates).toBe(true);
  });
});

describe('updateUserProfileInDb', () => {
  it('persists last_stamped_at so the daily rate limit survives reloads', async () => {
    const when = new Date('2026-10-03T09:30:00Z');
    const ok = await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', {
      stamps: 4,
      lastStampedAt: when,
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts).toHaveLength(1);
    const { table, payload } = hoisted.upserts[0];
    expect(table).toBe('profiles');
    expect(payload.stamps).toBe(4);
    expect(payload.last_stamped_at).toBe(when.toISOString());
  });

  it('does not send last_stamped_at when the update omits it', async () => {
    await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', { stamps: 5 });
    expect(hoisted.upserts[0].payload.last_stamped_at).toBeUndefined();
  });
});
