import { describe, it, expect } from 'vitest';
import { generateRepairSqlForTables } from './src/utils/schemaSync';

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
});
