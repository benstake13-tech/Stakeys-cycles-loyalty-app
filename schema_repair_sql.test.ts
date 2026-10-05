import { describe, it, expect } from 'vitest';
import {
  generateRepairSqlForTables,
  generateProfileBalanceProbeSql,
  isSyntheticProfileIdIssue,
  planBalanceProbe,
} from './src/shared/utils/schemaSync';

describe('generateRepairSqlForTables', () => {
  it('produces a focused, idempotent repair for the profiles table', () => {
    const sql = generateRepairSqlForTables(['profiles']);

    // Adds the column whose absence breaks the stamp/ticket/point upsert.
    expect(sql).toContain('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
    // Relaxes the legacy NOT NULL the app sends nulls through.
    expect(sql).toContain('ALTER TABLE public.profiles ALTER COLUMN %I DROP NOT NULL');
    // Re-applies grants/RLS and verifies.
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I');
    expect(sql).toContain("table_name IN ('profiles')");
    // Never destructive.
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
  });

  it('only touches the requested tables', () => {
    const sql = generateRepairSqlForTables(['service_bookings']);
    expect(sql).toContain('public.service_bookings');
    expect(sql).not.toContain('public.profiles');
    expect(sql).not.toContain('public.stamp_logs');
  });

  it('explains when a feature has no known schema', () => {
    const sql = generateRepairSqlForTables(['not_a_real_table']);
    expect(sql).toMatch(/nothing to repair/i);
  });

  it('repairs the counter_sales quote/approval lifecycle columns', () => {
    const sql = generateRepairSqlForTables(['counter_sales']);
    for (const col of [
      'status',
      'quoted_amount',
      'quote_note',
      'quote_sent_at',
      'quote_sent_by',
      'approved_at',
      'approved_by',
      'declined_at',
      'decline_reason',
      'discount_source',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col} `);
    }
    // Legacy CHECKs would reject 'unpaid' / 'quote' / 'approved'.
    expect(sql).toContain('counter_sales_status_check');
    expect(sql).toContain('counter_sales_payment_method_check');
  });
});

describe('generateProfileBalanceProbeSql', () => {
  it('adds the balance columns and re-applies grants without being destructive', () => {
    const sql = generateProfileBalanceProbeSql();
    expect(sql).toContain('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;');
    expect(sql).toContain('CREATE POLICY "Allow all on profiles"');
    // Runs a real update but rolls it back so no data changes.
    expect(sql).toContain('rollback probe');
    expect(sql).toContain('EXCEPTION WHEN raise_exception');
    // It must not silently change a member's balance.
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
  });

  it('targets a specific profile id when one is supplied', () => {
    const sql = generateProfileBalanceProbeSql('3a9b7d17-7ca0-4fb9-97c2-0ec0afa0129c');
    expect(sql).toContain("DECLARE target uuid := '3a9b7d17-7ca0-4fb9-97c2-0ec0afa0129c'::uuid;");
  });

  it('falls back to the first real profile when no id is supplied', () => {
    const sql = generateProfileBalanceProbeSql();
    expect(sql).toContain('DECLARE target uuid := NULL;');
    expect(sql).toContain('SELECT id INTO target FROM public.profiles ORDER BY created_at LIMIT 1;');
  });
});

describe('isSyntheticProfileIdIssue', () => {
  it('recognises the text-id-on-uuid column error', () => {
    expect(
      isSyntheticProfileIdIssue('invalid input syntax for type uuid: "__stakeys_diag__profile-1"')
    ).toBe(true);
  });

  it('recognises the profiles -> auth.users foreign-key error', () => {
    expect(
      isSyntheticProfileIdIssue('violates foreign key constraint "profiles_id_fkey"')
    ).toBe(true);
  });

  it('does not swallow genuine schema drift', () => {
    expect(isSyntheticProfileIdIssue("column 'last_spin_date' does not exist")).toBe(false);
  });
});

describe('planBalanceProbe', () => {
  it('writes sentinel values one above the current balance and restores them', () => {
    const plan = planBalanceProbe({
      id: '3a9b7d17-7ca0-4fb9-97c2-0ec0afa0129c',
      membership_number: 'STK-0042',
      stamps: 4,
      completed_cards: 2,
      merit_points: 31,
    });
    expect(plan.probe).toEqual({ stamps: 5, tickets: 3, points: 32 });
    expect(plan.restore).toEqual({ stamps: 4, tickets: 2, points: 31, lastSpinDate: null });
    expect(plan.membershipNumber).toBe('STK-0042');
  });

  it('treats null/missing balances as zero', () => {
    const plan = planBalanceProbe({ id: 'x', stamps: null, completed_cards: undefined });
    expect(plan.before).toEqual({ stamps: 0, completedCards: 0, meritPoints: 0 });
    expect(plan.probe).toEqual({ stamps: 1, tickets: 1, points: 1 });
    expect(plan.restore).toEqual({ stamps: 0, tickets: 0, points: 0, lastSpinDate: null });
  });

  it('captures and restores last_spin_date so a spin is not blocked', () => {
    const plan = planBalanceProbe({ id: 'x', last_spin_date: '2026-09-30T10:00:00.000Z' });
    expect(plan.restore.lastSpinDate).toBe('2026-09-30T10:00:00.000Z');
  });
});
