import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPECTED_SCHEMA,
  expectedColumns,
  generateSchemaSyncSql,
} from './src/utils/schemaSync';

// The audit hits the network; stub fetch per test.
const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('expected app schema', () => {
  it('covers every table the app writes', () => {
    const names = EXPECTED_SCHEMA.map((t) => t.name);
    [
      'profiles',
      'customer_bikes',
      'service_bookings',
      'stamp_logs',
      'discount_codes',
      'counter_sales',
      'service_vouchers',
      'prize_wheels',
      'prize_draws',
      'app_settings',
      'app_theme_config',
      'staff_members',
      'promotions',
    ].forEach((t) => expect(names).toContain(t));
  });

  it('includes the bike identity / e-bike conversion columns', () => {
    expect(expectedColumns('customer_bikes')).toContain('bike_details');
    expect(expectedColumns('service_bookings')).toContain('bike_details');
  });

  it('declares the quote/approval lifecycle columns', () => {
    const cols = expectedColumns('service_bookings');
    ['approval_status', 'quoted_price', 'quote_note', 'repair_stage', 'progress_events'].forEach(
      (c) => expect(cols).toContain(c)
    );
  });

  it('matches every table the app actually queries via supabase.from()', () => {
    const srcDir = join(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) files.push(full);
      }
    };
    walk(srcDir);

    const used = new Set<string>();
    const re = /\.from\(['"]([a-z_]+)['"]\)/g;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) used.add(m[1]);
    }

    expect(used.size).toBeGreaterThan(0);
    const expected = new Set(EXPECTED_SCHEMA.map((t) => t.name));
    const unknown = [...used].filter((t) => !expected.has(t)).sort();
    expect(unknown, `Add these tables to EXPECTED_SCHEMA: ${unknown.join(', ')}`).toEqual([]);
  });
});

describe('generateSchemaSyncSql', () => {
  const sql = generateSchemaSyncSql();

  it('creates tables idempotently', () => {
    EXPECTED_SCHEMA.forEach((t) => {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${t.name}`);
    });
  });

  it('adds every non-key column with IF NOT EXISTS', () => {
    EXPECTED_SCHEMA.forEach((t) => {
      t.columns
        .filter((c) => c.name !== t.primaryKey)
        .forEach((c) => {
          expect(sql).toContain(
            `ALTER TABLE public.${t.name} ADD COLUMN IF NOT EXISTS ${c.name}`
          );
        });
    });
  });

  it('relaxes the legacy NOT NULLs that block bookings and stamp logs', () => {
    expect(sql).toContain(`ARRAY['customer_phone','service_id','service_title','preferred_date','preferred_time_slot']`);
    expect(sql).toContain(`ARRAY['user_id','amount','source','created_at']`);
    expect(sql).toContain('DROP NOT NULL');
  });

  it('drops the legacy stamp_logs amount/source CHECK constraints', () => {
    expect(sql).toContain(`ARRAY['stamp_logs_amount_check','stamp_logs_source_check']`);
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS');
  });

  it('coerces legacy uuid id columns to text', () => {
    expect(sql).toContain('ALTER COLUMN id TYPE text USING id::text');
    ['customer_bikes', 'service_bookings', 'stamp_logs'].forEach((t) =>
      expect(sql).toContain(`'${t}'`)
    );
  });

  it('re-applies grants, RLS and realtime', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
    expect(sql).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE');
  });

  it('keeps the auth-user profile trigger and seed rows', () => {
    expect(sql).toContain('handle_new_loyalty_user');
    expect(sql).toContain('on_auth_user_created_loyalty');
    expect(sql).toContain('INSERT INTO public.app_settings (id)');
  });

  it('never drops tables or deletes rows', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });
});

describe('auditLiveSchema', () => {
  it('reports missing tables and columns from live probes', async () => {
    // profiles: everything present (200). stamp_logs: reward_id missing (the
    // all-column probe contains reward_id → 400, and the per-column probe for
    // reward_id → 400, while every other column → 200). prize_draws: 404.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/prize_draws?')) return new Response('', { status: 404 });
      if (url.includes('/stamp_logs?')) {
        return new Response('', { status: url.includes('reward_id') ? 400 : 200 });
      }
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    // getStoredSupabaseAnonKey reads localStorage, which jsdom provides.
    localStorage.setItem('stakeys_supabase_anon_key', 'test-anon-key');
    const { auditLiveSchema } = await import('./src/utils/schemaSync');
    const report = await auditLiveSchema();

    expect(report.reachable).toBe(true);
    expect(report.healthy).toBe(false);
    expect(report.missingTables).toContain('prize_draws');
    expect(report.missingColumns.some((c) => c.table === 'stamp_logs' && c.column === 'reward_id')).toBe(
      true
    );
  });
});
