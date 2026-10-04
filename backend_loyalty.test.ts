import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture every insert/upsert/update/select call so we can assert on the payloads.
const hoisted = vi.hoisted(() => ({
  inserts: [] as any[],
  upserts: [] as any[],
  updates: [] as any[],
  selectResults: [] as any[],
  insertResults: [] as any[],
  upsertResults: [] as any[],
  updateResults: [] as any[],
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
      update: (payload: any) => {
        hoisted.updates.push({ table, payload });
        const result = hoisted.updateResults.shift() ?? { error: null, data: [{ id: 'x' }] };
        const chain: any = {
          eq: () => chain,
          select: () => Promise.resolve(result),
          then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
        };
        return chain;
      },
      select: () => {
        const result = hoisted.selectResults.shift() ?? { error: null, data: null };
        const chain: any = {
          eq: () => chain,
          maybeSingle: () => Promise.resolve(result),
          single: () => Promise.resolve(result),
        };
        return chain;
      },
    }),
  }),
}));

import { insertStampLogToDb, ensureProfileRowInDb, updateUserProfileInDb, updateCounterSaleInDb } from './src/api/backendDataService';

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
  hoisted.updates = [];
  hoisted.selectResults = [];
  hoisted.insertResults = [];
  hoisted.upsertResults = [];
  hoisted.updateResults = [];
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
  it('patches (never upserts) the profile row so a NOT NULL display_name is not violated', async () => {
    const when = new Date('2026-10-03T09:30:00Z');
    const ok = await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', {
      stamps: 4,
      lastStampedAt: when,
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts).toHaveLength(0);
    expect(hoisted.updates).toHaveLength(1);
    const { table, payload } = hoisted.updates[0];
    expect(table).toBe('profiles');
    expect(payload.stamps).toBe(4);
    expect(payload.last_stamped_at).toBe(when.toISOString());
  });

  it('does not send last_stamped_at when the update omits it', async () => {
    await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', { stamps: 5 });
    expect(hoisted.updates[0].payload.last_stamped_at).toBeUndefined();
  });

  it('mirrors last_spun_at into last_spin_date so the weekly cooldown cannot drift', async () => {
    const when = new Date('2026-10-03T09:30:00Z');
    await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', { lastSpunAt: when });
    const { payload } = hoisted.updates[0];
    expect(payload.last_spun_at).toBe(when.toISOString());
    expect(payload.last_spin_date).toBe(when.toISOString());
  });

  it('clears both spin columns when the cooldown is reset', async () => {
    await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-1', { lastSpunAt: null });
    const { payload } = hoisted.updates[0];
    expect(payload.last_spun_at).toBeNull();
    expect(payload.last_spin_date).toBeNull();
  });

  it('creates the profile row when the update matches nothing', async () => {
    hoisted.updateResults.push({ error: null, data: [] }, { error: null, data: [{ id: 'x' }] });
    const ok = await updateUserProfileInDb('11111111-1111-1111-1111-111111111111', 'STK-9', { stamps: 1 });
    expect(ok).toBe(true);
    // First attempt found no row, ensureProfileRowInDb inserted, then the update ran again.
    expect(hoisted.upserts).toHaveLength(1);
    expect(hoisted.upserts[0].payload.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(hoisted.updates).toHaveLength(2);
  });
});

describe('updateCounterSaleInDb', () => {
  const existingRow = {
    id: 'sale-1',
    sale_number: 'SALE-2026-0001',
    customer_name: 'Ada',
    items: [{ id: 'a', name: 'Brake pads', quantity: 1, unitPrice: 10 }],
    subtotal: 10,
    vat_rate: 0.2,
    vat_amount: 2,
    discount: 0,
    grand_total: 12,
    payment_method: 'unpaid',
    status: 'quote',
    quoted_amount: 12,
    quote_note: 'as discussed',
    quote_sent_at: '2026-10-03T09:00:00.000Z',
    quote_sent_by: 'Ben',
    created_at: '2026-10-03T08:00:00.000Z',
  };

  it('PATCHes (never upserts) and keeps the quote when approving', async () => {
    hoisted.selectResults.push({ error: null, data: existingRow });
    const ok = await updateCounterSaleInDb('sale-1', {
      status: 'approved',
      approvedAt: '2026-10-03T10:00:00.000Z',
      approvedBy: 'Ben',
    });
    expect(ok).toBe(true);
    expect(hoisted.upserts).toHaveLength(0);
    expect(hoisted.updates).toHaveLength(1);
    const { table, payload } = hoisted.updates[0];
    expect(table).toBe('counter_sales');
    expect(payload.status).toBe('approved');
    expect(payload.approved_by).toBe('Ben');
    // Approving must not clear the quote that was already sent.
    expect(payload.quoted_amount).toBeUndefined();
    expect(payload.quote_note).toBeUndefined();
    expect(payload.quote_sent_at).toBeUndefined();
  });

  it('writes the quote columns when a quote is sent', async () => {
    hoisted.selectResults.push({ error: null, data: { ...existingRow, status: 'completed' } });
    const ok = await updateCounterSaleInDb('sale-1', {
      status: 'quote',
      quote: { amount: 12, note: 'diagnostics quote', sentAt: '2026-10-03T09:00:00.000Z', sentBy: 'Diagnostics' },
    });
    expect(ok).toBe(true);
    const { payload } = hoisted.updates[0];
    expect(payload.status).toBe('quote');
    expect(payload.quoted_amount).toBe(12);
    expect(payload.quote_note).toBe('diagnostics quote');
    expect(payload.quote_sent_by).toBe('Diagnostics');
  });

  it('fails without writing when the sale row does not exist', async () => {
    hoisted.selectResults.push({ error: null, data: null });
    const ok = await updateCounterSaleInDb('missing', { status: 'approved' });
    expect(ok).toBe(false);
    expect(hoisted.updates).toHaveLength(0);
  });
});
