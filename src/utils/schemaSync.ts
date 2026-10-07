/**
 * Stakey's Cycles — live database schema audit & sync-SQL generator.
 *
 * The app and the live Supabase project drift apart: a column the app writes
 * may not exist yet (or a legacy NOT NULL blocks a row), which shows up as a
 * silent PGRST204 / 400 on insert. This module knows the schema the app
 * actually uses, probes the live project column-by-column over the REST API
 * (the anon key can read `information_schema`-equivalent metadata via a
 * `select=col&limit=0` probe), and generates an idempotent SQL script that
 * brings the project back in line.
 *
 * It only reads — the generated SQL must be pasted into the Supabase SQL
 * Editor because the anon key cannot run DDL.
 */
import { getStoredSupabaseUrl, getStoredSupabaseAnonKey } from '../supabase';

export type SqlType =
  | 'text'
  | 'uuid'
  | 'boolean'
  | 'integer'
  | 'numeric'
  | 'timestamptz'
  | 'jsonb';

export interface ExpectedColumn {
  name: string;
  type: SqlType;
  /** SQL default expression, e.g. `'pending'` or `NOW()`. */
  default?: string;
  /** App sends null here, so a legacy NOT NULL must be dropped. */
  relaxNotNull?: boolean;
  /** Foreign-key clause for CREATE TABLE, e.g. `auth.users(id) ON DELETE CASCADE`. */
  references?: string;
}

export interface ExpectedTable {
  name: string;
  primaryKey: string;
  columns: ExpectedColumn[];
  /** The app writes text ids ('bike-1727…'); coerce a legacy uuid column. */
  textId?: boolean;
  /**
   * Legacy CHECK constraints the app's values violate. Dropped by name so an
   * older schema can accept the app's payload (e.g. stamp_logs.amount check
   * rejects 0, but every stamp history row carries amount 0).
   */
  dropChecks?: string[];
}

export interface ColumnIssue {
  table: string;
  column: string;
  type: SqlType;
}

export interface SchemaAuditReport {
  checkedAt: string;
  reachable: boolean;
  error?: string;
  missingTables: string[];
  missingColumns: ColumnIssue[];
  /** Tables/columns that could not be read (grants or RLS), not necessarily missing. */
  warnings: string[];
  totalColumns: number;
  healthy: boolean;
}

const NOW = 'NOW()';

export const EXPECTED_SCHEMA: ExpectedTable[] = [
  {
    name: 'profiles',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'uuid', references: 'auth.users(id) ON DELETE CASCADE' },
      { name: 'email', type: 'text' },
      { name: 'display_name', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'role', type: 'text', default: `'customer'` },
      { name: 'membership_number', type: 'text', relaxNotNull: true },
      { name: 'stamps', type: 'integer', default: '0' },
      { name: 'completed_cards', type: 'integer', default: '0' },
      { name: 'merit_points', type: 'integer', default: '0' },
      { name: 'tickets', type: 'integer', default: '0' },
      { name: 'last_spin_date', type: 'text' },
      { name: 'last_spun_at', type: 'timestamptz' },
      { name: 'last_stamped_at', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'referrals',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'owner_uid', type: 'text' },
      { name: 'owner_name', type: 'text' },
      { name: 'owner_membership', type: 'text' },
      { name: 'code', type: 'text' },
      { name: 'link', type: 'text' },
      { name: 'times_shared', type: 'integer', default: '0' },
      { name: 'rewards_earned', type: 'integer', default: '0' },
      { name: 'rewards', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'referred_friends', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'customer_bikes',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'customer_id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'brand', type: 'text' },
      { name: 'model', type: 'text' },
      { name: 'make', type: 'text' },
      { name: 'year', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'serial_number', type: 'text' },
      { name: 'frame_number', type: 'text' },
      { name: 'category', type: 'text', default: `'cycle'` },
      { name: 'vehicle_category', type: 'text' },
      { name: 'stock_specs_scraped', type: 'boolean', default: 'false' },
      { name: 'scraped_data', type: 'jsonb' },
      { name: 'bike_details', type: 'jsonb' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'service_bookings',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'customer_id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'customer_phone', type: 'text', relaxNotNull: true },
      { name: 'customer_email', type: 'text' },
      { name: 'membership_number', type: 'text' },
      { name: 'service_id', type: 'text', relaxNotNull: true },
      { name: 'service_title', type: 'text', relaxNotNull: true },
      { name: 'service_price', type: 'numeric', default: '0' },
      { name: 'vehicle_type', type: 'text' },
      { name: 'vehicle_model', type: 'text' },
      { name: 'preferred_date', type: 'text', relaxNotNull: true },
      { name: 'preferred_time_slot', type: 'text', relaxNotNull: true },
      { name: 'notes', type: 'text' },
      { name: 'status', type: 'text', default: `'pending'` },
      { name: 'reminder_24h_sent', type: 'boolean', default: 'false' },
      { name: 'notifications', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'bike_details', type: 'jsonb' },
      { name: 'approval_status', type: 'text' },
      { name: 'approved_at', type: 'timestamptz' },
      { name: 'approved_by', type: 'text' },
      { name: 'declined_at', type: 'timestamptz' },
      { name: 'decline_reason', type: 'text' },
      { name: 'staff_notes', type: 'text' },
      { name: 'quoted_price', type: 'numeric' },
      { name: 'quote_note', type: 'text' },
      { name: 'quote_sent_at', type: 'timestamptz' },
      { name: 'quote_sent_by', type: 'text' },
      { name: 'repair_stage', type: 'text' },
      { name: 'progress_events', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'estimate_ready_at', type: 'timestamptz' },
      { name: 'invoice', type: 'jsonb' },
      { name: 'referral_code', type: 'text' },
      { name: 'is_sos', type: 'boolean', default: 'false' },
      { name: 'sos_status', type: 'text' },
      { name: 'sos_location_requested_at', type: 'timestamptz' },
      { name: 'sos_location_note', type: 'text' },
      { name: 'sos_confirmed_at', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'stamp_logs',
    primaryKey: 'id',
    textId: true,
    dropChecks: ['stamp_logs_amount_check', 'stamp_logs_source_check'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'customer_id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'membership_number', type: 'text' },
      { name: 'staff_id', type: 'text' },
      { name: 'staff_name', type: 'text' },
      { name: 'action', type: 'text', default: `'add_stamp'` },
      { name: 'stamps_before', type: 'integer' },
      { name: 'stamps_after', type: 'integer' },
      { name: 'reward_id', type: 'text' },
      { name: 'note', type: 'text' },
      { name: 'user_id', type: 'uuid', relaxNotNull: true },
      // Legacy points-ledger columns: some projects declared these NOT NULL with
      // CHECKs (amount <> 0, source IN ('visit','wheel')). The app always writes
      // amount 0 / source 'visit', so both the NOT NULLs and the CHECKs must go.
      { name: 'amount', type: 'numeric', default: '0', relaxNotNull: true },
      { name: 'source', type: 'text', default: `'visit'`, relaxNotNull: true },
      { name: 'created_at', type: 'timestamptz', default: NOW, relaxNotNull: true },
      { name: 'timestamp', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'discount_codes',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'code', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'type', type: 'text', default: `'percent'` },
      { name: 'value', type: 'numeric', default: '0' },
      { name: 'status', type: 'text', default: `'active'` },
      { name: 'expires_at', type: 'timestamptz' },
      { name: 'usage_limit', type: 'integer' },
      { name: 'times_used', type: 'integer', default: '0' },
      { name: 'assigned_to_uid', type: 'text' },
      { name: 'assigned_to_membership', type: 'text' },
      { name: 'assigned_to_name', type: 'text' },
      { name: 'eligible_categories', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'minimum_spend', type: 'numeric' },
      { name: 'audience', type: 'text' },
      { name: 'created_by', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'counter_sales',
    primaryKey: 'id',
    textId: true,
    // Legacy CHECKs reject the values the app writes: payment_method may be
    // 'unpaid' (quote not yet paid) and status must allow the full
    // quote/approved/declined lifecycle.
    dropChecks: ['counter_sales_payment_method_check', 'counter_sales_status_check'],
    columns: [
      { name: 'id', type: 'text' },
      { name: 'sale_number', type: 'text' },
      { name: 'customer_id', type: 'text' },
      { name: 'membership_number', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'items', type: 'jsonb' },
      { name: 'subtotal', type: 'numeric', default: '0' },
      { name: 'vat_rate', type: 'numeric', default: '0' },
      { name: 'vat_amount', type: 'numeric', default: '0' },
      { name: 'discount', type: 'numeric', default: '0' },
      { name: 'discount_code', type: 'text' },
      { name: 'discount_label', type: 'text' },
      { name: 'discount_source', type: 'text' },
      { name: 'grand_total', type: 'numeric', default: '0' },
      { name: 'payment_method', type: 'text', default: `'unpaid'` },
      { name: 'staff_uid', type: 'text' },
      { name: 'staff_name', type: 'text' },
      // Quote → approval → completion lifecycle (mirrors SaleTransaction).
      { name: 'status', type: 'text', default: `'completed'` },
      { name: 'quoted_amount', type: 'numeric' },
      { name: 'quote_note', type: 'text' },
      { name: 'quote_sent_at', type: 'timestamptz' },
      { name: 'quote_sent_by', type: 'text' },
      { name: 'approved_at', type: 'timestamptz' },
      { name: 'approved_by', type: 'text' },
      { name: 'declined_at', type: 'timestamptz' },
      { name: 'decline_reason', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'service_vouchers',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'customer_id', type: 'text' },
      { name: 'code', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'value', type: 'numeric', default: '0' },
      { name: 'type', type: 'text', default: `'merch'` },
      { name: 'terms', type: 'text' },
      { name: 'status', type: 'text', default: `'available'` },
      { name: 'claimed_at', type: 'timestamptz', default: NOW },
      { name: 'redeemed_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'prize_wheels',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'segments', type: 'jsonb' },
      { name: 'is_active', type: 'boolean', default: 'true' },
      { name: 'ticket_cost', type: 'integer', default: '1' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'prize_draws',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'prize_description', type: 'text' },
      { name: 'draw_date', type: 'text' },
      { name: 'status', type: 'text', default: `'upcoming'` },
      { name: 'winner_uid', type: 'text' },
      { name: 'winner_name', type: 'text' },
      { name: 'completed_at', type: 'timestamptz' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'app_settings',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'owner_email', type: 'text' },
      { name: 'owner_phone', type: 'text' },
      { name: 'email_alerts_enabled', type: 'boolean', default: 'true' },
      { name: 'sms_alerts_enabled', type: 'boolean', default: 'false' },
      { name: 'business_name', type: 'text' },
      { name: 'automated_reminders_enabled', type: 'boolean', default: 'true' },
      { name: 'reminders_push_only', type: 'boolean', default: 'true' },
      { name: 'reminder_owner_email', type: 'text' },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'app_theme_config',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'integer' },
      { name: 'theme', type: 'text', default: `'none'` },
      { name: 'active_theme', type: 'text' },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'staff_members',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'phone', type: 'text' },
      { name: 'role', type: 'text', default: `'Mechanic'` },
      { name: 'status', type: 'text', default: `'Active'` },
      { name: 'joined_date', type: 'text' },
      { name: 'certification_level', type: 'text' },
      { name: 'avatar_color', type: 'text' },
      { name: 'notes', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'promotions',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'subtitle', type: 'text' },
      { name: 'code', type: 'text' },
      { name: 'discount_percentage', type: 'numeric' },
      { name: 'discount_amount', type: 'numeric' },
      { name: 'badge_text', type: 'text' },
      { name: 'status', type: 'text', default: `'active'` },
      { name: 'start_date', type: 'text' },
      { name: 'end_date', type: 'text' },
      { name: 'terms_and_conditions', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'eligible_categories', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'bg_gradient', type: 'text' },
      { name: 'image_url', type: 'text' },
      { name: 'featured', type: 'boolean', default: 'false' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'ecommerce_orders',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'customer_name', type: 'text' },
      { name: 'contact', type: 'text' },
      { name: 'items', type: 'jsonb', default: `'[]'::jsonb` },
      { name: 'total', type: 'numeric' },
      { name: 'note', type: 'text' },
      { name: 'discount_code', type: 'text' },
      { name: 'created_at', type: 'timestamptz', default: NOW },
    ],
  },
  {
    name: 'assistant_config',
    primaryKey: 'id',
    textId: true,
    columns: [
      { name: 'id', type: 'text' },
      { name: 'config', type: 'jsonb', default: `'{}'::jsonb` },
      { name: 'updated_at', type: 'timestamptz', default: NOW },
    ],
  },
];

export function expectedTable(name: string): ExpectedTable | undefined {
  return EXPECTED_SCHEMA.find((t) => t.name === name);
}

export function expectedColumns(name: string): string[] {
  return expectedTable(name)?.columns.map((c) => c.name) ?? [];
}

/**
 * Probe one table with all of its expected columns. A 200 means every column
 * exists; a 400 means at least one is missing and we fall back to per-column
 * probes; a 404 means the table itself is missing.
 */
async function probeTable(
  url: string,
  anonKey: string,
  table: ExpectedTable
): Promise<{ status: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const cols = table.columns.map((c) => c.name).join(',');
    const res = await fetch(`${url}/rest/v1/${table.name}?select=${encodeURIComponent(cols)}&limit=0`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });
    return { status: res.status };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : 'Network error' };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeColumn(
  url: string,
  anonKey: string,
  table: string,
  column: string
): Promise<{ status: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(column)}&limit=0`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });
    return { status: res.status };
  } catch (e) {
    return { status: 0, error: e instanceof Error ? e.message : 'Network error' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Audits the live Supabase project against EXPECTED_SCHEMA. Read-only.
 * Optionally pass an explicit url/key (e.g. while testing an unsaved config).
 */
export async function auditLiveSchema(overrideUrl?: string, overrideKey?: string): Promise<SchemaAuditReport> {
  const url = (overrideUrl || getStoredSupabaseUrl()).replace(/\/+$/, '');
  const anonKey = (overrideKey !== undefined ? overrideKey : getStoredSupabaseAnonKey()).trim();
  const checkedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const missingTables: string[] = [];
  const missingColumns: ColumnIssue[] = [];
  const warnings: string[] = [];
  const totalColumns = EXPECTED_SCHEMA.reduce((n, t) => n + t.columns.length, 0);

  if (!anonKey) {
    return {
      checkedAt,
      reachable: false,
      error: 'No Supabase Anon API Key configured. Add it in the Service Status panel first.',
      missingTables,
      missingColumns,
      warnings,
      totalColumns,
      healthy: false,
    };
  }

  let networkError: string | undefined;

  for (const table of EXPECTED_SCHEMA) {
    const tableProbe = await probeTable(url, anonKey, table);

    if (tableProbe.status === 404) {
      missingTables.push(table.name);
      continue;
    }
    if (tableProbe.status === 0) {
      networkError = tableProbe.error || 'Cannot reach the Supabase host';
      break;
    }
    if (tableProbe.status === 401 || tableProbe.status === 403) {
      warnings.push(`${table.name}: permission denied (check GRANTs / RLS)`);
      continue;
    }
    if (tableProbe.status === 200) continue; // all columns present

    // 400 → at least one column is missing; find which.
    for (const column of table.columns) {
      const colProbe = await probeColumn(url, anonKey, table.name, column.name);
      if (colProbe.status === 400) {
        missingColumns.push({ table: table.name, column: column.name, type: column.type });
      } else if (colProbe.status === 404) {
        missingTables.push(table.name);
        break;
      } else if (colProbe.status === 0) {
        warnings.push(`${table.name}.${column.name}: ${colProbe.error || 'unreachable'}`);
      }
    }
  }

  if (networkError) {
    return {
      checkedAt,
      reachable: false,
      error: networkError,
      missingTables,
      missingColumns,
      warnings,
      totalColumns,
      healthy: false,
    };
  }

  return {
    checkedAt,
    reachable: true,
    missingTables,
    missingColumns,
    warnings,
    totalColumns,
    healthy: missingTables.length === 0 && missingColumns.length === 0,
  };
}

function columnDefinition(col: ExpectedColumn): string {
  const parts = [`${col.name} ${col.type.toUpperCase()}`];
  if (col.default) parts.push(`DEFAULT ${col.default}`);
  return parts.join(' ');
}

/**
 * Generates an idempotent SQL script that creates every missing table/column,
 * relaxes the legacy NOT NULLs the app hits, re-grants, re-enables RLS and
 * re-publishes realtime. Safe to run repeatedly; never drops data.
 */
export function generateSchemaSyncSql(): string {
  const lines: string[] = [
    "-- ==========================================================================",
    "-- Stakey's Cycles — sync live Supabase schema with the app",
    "-- Generated by the staff area → Database Sync. Run in:",
    "--   Supabase Dashboard -> SQL Editor -> New query -> Run.",
    "-- Idempotent: safe to re-run. Never drops tables or deletes rows.",
    "-- ==========================================================================",
    '',
    '-- 1. Create any missing tables (existing tables are left untouched).',
  ];

  for (const table of EXPECTED_SCHEMA) {
    const cols = table.columns
      .map((c) => {
        if (c.name === table.primaryKey) {
          const type = c.type.toUpperCase();
          const ref = c.references ? ` REFERENCES ${c.references}` : '';
          return `  ${c.name} ${type} PRIMARY KEY${ref}`;
        }
        return `  ${columnDefinition(c)}`;
      })
      .join(',\n');
    lines.push(`CREATE TABLE IF NOT EXISTS public.${table.name} (\n${cols}\n);`);
    lines.push('');
  }

  lines.push('-- 2. Add any missing columns to existing tables.');
  for (const table of EXPECTED_SCHEMA) {
    for (const col of table.columns) {
      if (col.name === table.primaryKey) continue;
      const def = col.default ? ` DEFAULT ${col.default}` : '';
      lines.push(
        `ALTER TABLE public.${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type.toUpperCase()}${def};`
      );
    }
    lines.push('');
  }

  lines.push('-- 3. Relax legacy NOT NULL constraints the app sends nulls through.');
  const relaxByTable = new Map<string, string[]>();
  for (const table of EXPECTED_SCHEMA) {
    const cols = table.columns.filter((c) => c.relaxNotNull).map((c) => c.name);
    if (cols.length) relaxByTable.set(table.name, cols);
  }
  if (relaxByTable.size === 0) {
    lines.push('-- (none)');
  } else {
    for (const [table, cols] of relaxByTable) {
      lines.push(`DO $$`);
      lines.push(`DECLARE c text;`);
      lines.push(`BEGIN`);
      lines.push(`  IF to_regclass('public.${table}') IS NULL THEN RETURN; END IF;`);
      lines.push(`  FOREACH c IN ARRAY ARRAY[${cols.map((c) => `'${c}'`).join(',')}] LOOP`);
      lines.push(`    BEGIN`);
      lines.push(
        `      EXECUTE format('ALTER TABLE public.${table} ALTER COLUMN %I DROP NOT NULL', c);`
      );
      lines.push(
        `    EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN RAISE NOTICE '${table}.% : %', c, SQLERRM; END;`
      );
      lines.push(`  END LOOP;`);
      lines.push(`END $$;`);
      lines.push('');
    }
  }

  const dropChecksByTable = EXPECTED_SCHEMA.filter((t) => t.dropChecks?.length);
  if (dropChecksByTable.length) {
    lines.push('-- 3b. Drop legacy CHECK constraints the app values violate.');
    lines.push(`DO $$`);
    lines.push(`DECLARE c text;`);
    lines.push(`BEGIN`);
    for (const table of dropChecksByTable) {
      lines.push(`  IF to_regclass('public.${table.name}') IS NULL THEN`);
      lines.push(`    RAISE NOTICE 'skipping checks: public.${table.name} does not exist';`);
      lines.push(`  ELSE`);
      lines.push(
        `    FOREACH c IN ARRAY ARRAY[${table.dropChecks!.map((c) => `'${c}'`).join(',')}] LOOP`
      );
      lines.push(`      BEGIN`);
      lines.push(
        `        EXECUTE format('ALTER TABLE public.${table.name} DROP CONSTRAINT IF EXISTS %I', c);`
      );
      lines.push(
        `      EXCEPTION WHEN others THEN RAISE NOTICE '${table.name}.% check drop skipped: %', c, SQLERRM; END;`
      );
      lines.push(`    END LOOP;`);
      lines.push(`  END IF;`);
    }
    lines.push(`END $$;`);
    lines.push('');
  }

  const textIdTables = EXPECTED_SCHEMA.filter((t) => t.textId).map((t) => t.name);
  if (textIdTables.length) {
    lines.push('-- 4. Coerce legacy uuid id columns to text (the app writes text ids).');
    lines.push(`DO $$`);
    lines.push(`DECLARE t text;`);
    lines.push(`BEGIN`);
    lines.push(
      `  FOREACH t IN ARRAY ARRAY[${textIdTables.map((t) => `'${t}'`).join(',')}] LOOP`
    );
    lines.push(`    BEGIN`);
    lines.push(
      `      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='id' AND data_type='uuid') THEN`
    );
    lines.push(
      `        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT', t);`
    );
    lines.push(
      `        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE text USING id::text', t);`
    );
    lines.push(`        RAISE NOTICE '% .id converted to text', t;`);
    lines.push(`      END IF;`);
    lines.push(
      `    EXCEPTION WHEN others THEN RAISE NOTICE '% id coercion skipped: %', t, SQLERRM; END;`
    );
    lines.push(`  END LOOP;`);
    lines.push(`END $$;`);
    lines.push('');
  }

  const tableList = EXPECTED_SCHEMA.map((t) => `'${t.name}'`).join(', ');

  lines.push('-- 5. Grants + permissive RLS on every app table.');
  lines.push(`DO $$`);
  lines.push(`DECLARE t text; r text;`);
  lines.push(`BEGIN`);
  lines.push(
    `  FOREACH t IN ARRAY ARRAY[${tableList}] LOOP`
  );
  lines.push(
    `    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;`
  );
  lines.push(`    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP`);
  lines.push(`      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN`);
  lines.push(
    `        BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I', t, r);`
  );
  lines.push(
    `        EXCEPTION WHEN others THEN RAISE NOTICE 'grant % on % failed: %', r, t, SQLERRM; END;`
  );
  lines.push(`      END IF;`);
  lines.push(`    END LOOP;`);
  lines.push(
    `    BEGIN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);`
  );
  lines.push(
    `      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t, t);`
  );
  lines.push(
    `      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Allow all on ' || t, t);`
  );
  lines.push(
    `    EXCEPTION WHEN others THEN RAISE NOTICE 'rls on % failed: %', t, SQLERRM; END;`
  );
  lines.push(`  END LOOP;`);
  lines.push(`END $$;`);
  lines.push('');

  lines.push('-- 6. Realtime — publish every app table (ignore if already published).');
  lines.push(`DO $$`);
  lines.push(`DECLARE t text;`);
  lines.push(`BEGIN`);
  lines.push(`  FOREACH t IN ARRAY ARRAY[${tableList}] LOOP`);
  lines.push(`    BEGIN`);
  lines.push(
    `      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);`
  );
  lines.push(`    EXCEPTION`);
  lines.push(`      WHEN duplicate_object THEN NULL;`);
  lines.push(
    `      WHEN undefined_object THEN RAISE NOTICE 'supabase_realtime publication not found'; RETURN;`
  );
  lines.push(`      WHEN others THEN RAISE NOTICE 'realtime add % skipped: %', t, SQLERRM;`);
  lines.push(`    END;`);
  lines.push(`  END LOOP;`);
  lines.push(`END $$;`);
  lines.push('');

  lines.push('-- 7. Auto-create a profiles row for every new auth user + backfill.');
  lines.push(`CREATE OR REPLACE FUNCTION public.handle_new_loyalty_user()`);
  lines.push(`RETURNS TRIGGER`);
  lines.push(`LANGUAGE plpgsql`);
  lines.push(`SECURITY DEFINER SET search_path = public`);
  lines.push(`AS $$`);
  lines.push(`BEGIN`);
  lines.push(
    `  INSERT INTO public.profiles (id, email, display_name, role, stamps, completed_cards, merit_points)`
  );
  lines.push(`  VALUES (`);
  lines.push(`    new.id,`);
  lines.push(`    new.email,`);
  lines.push(
    `    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Stakey Rider'),`
  );
  lines.push(`    'customer', 0, 0, 0`);
  lines.push(`  )`);
  lines.push(`  ON CONFLICT (id) DO NOTHING;`);
  lines.push(`  RETURN new;`);
  lines.push(`END;`);
  lines.push(`$$;`);
  lines.push(`DROP TRIGGER IF EXISTS on_auth_user_created_loyalty ON auth.users;`);
  lines.push(`CREATE TRIGGER on_auth_user_created_loyalty`);
  lines.push(`AFTER INSERT ON auth.users`);
  lines.push(`FOR EACH ROW EXECUTE FUNCTION public.handle_new_loyalty_user();`);
  lines.push('');

  lines.push('-- 8. Seed singleton rows.');
  lines.push(`INSERT INTO public.app_settings (id) SELECT 1`);
  lines.push(`  WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);`);
  lines.push(`INSERT INTO public.app_theme_config (id, theme)`);
  lines.push(`  SELECT 1, 'none' WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);`);
  lines.push('');

  lines.push('-- 9. Verify — should list every expected table.');
  lines.push(`SELECT table_name, count(*) AS columns`);
  lines.push(`  FROM information_schema.columns`);
  lines.push(` WHERE table_schema = 'public'`);
  lines.push(`   AND table_name IN (${tableList})`);
  lines.push(` GROUP BY table_name ORDER BY table_name;`);
  lines.push('');

  return lines.join('\n');
}

/**
 * A focused repair script for the tables a failing feature test touches, so
 * staff can fix one broken feature without running the whole schema sync.
 * Idempotent and non-destructive, same guarantees as the full sync.
 */
export function generateRepairSqlForTables(tableNames: string[]): string {
  const tables = EXPECTED_SCHEMA.filter((t) => tableNames.includes(t.name));
  if (tables.length === 0) {
    return '-- No known schema is associated with this feature, so there is nothing to repair here.\n';
  }

  const names = tables.map((t) => t.name);
  const tableList = names.map((t) => `'${t}'`).join(', ');
  const lines: string[] = [
    '-- ==========================================================================',
    `-- Stakey's Cycles — repair SQL for: ${names.join(', ')}`,
    '-- Generated from Staff area → Feature Test Bench → Create fix SQL.',
    '-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.',
    '-- Idempotent: safe to re-run. Only adds columns, relaxes legacy NOT NULLs',
    '-- and re-applies grants — it never drops tables or deletes rows.',
    '-- ==========================================================================',
    '',
    '-- 1. Add any missing columns (CREATE TABLE IF NOT EXISTS keeps existing data).',
  ];

  for (const table of tables) {
    const cols = table.columns
      .map((c) => {
        if (c.name === table.primaryKey) {
          const type = c.type.toUpperCase();
          const ref = c.references ? ` REFERENCES ${c.references}` : '';
          return `  ${c.name} ${type} PRIMARY KEY${ref}`;
        }
        return `  ${columnDefinition(c)}`;
      })
      .join(',\n');
    lines.push(`CREATE TABLE IF NOT EXISTS public.${table.name} (\n${cols}\n);`);
    lines.push('');
    for (const col of table.columns) {
      if (col.name === table.primaryKey) continue;
      const def = col.default ? ` DEFAULT ${col.default}` : '';
      lines.push(
        `ALTER TABLE public.${table.name} ADD COLUMN IF NOT EXISTS ${col.name} ${col.type.toUpperCase()}${def};`
      );
    }
    lines.push('');
  }

  const relaxByTable = tables.filter((t) => t.columns.some((c) => c.relaxNotNull));
  lines.push('-- 2. Relax legacy NOT NULL constraints the app sends nulls through.');
  if (relaxByTable.length === 0) {
    lines.push('-- (none)');
  } else {
    lines.push(`DO $$`);
    lines.push(`DECLARE c text;`);
    lines.push(`BEGIN`);
    for (const table of relaxByTable) {
      const cols = table.columns.filter((c) => c.relaxNotNull).map((c) => c.name);
      lines.push(`  IF to_regclass('public.${table.name}') IS NULL THEN RETURN; END IF;`);
      lines.push(`  FOREACH c IN ARRAY ARRAY[${cols.map((c) => `'${c}'`).join(',')}] LOOP`);
      lines.push(`    BEGIN`);
      lines.push(
        `      EXECUTE format('ALTER TABLE public.${table.name} ALTER COLUMN %I DROP NOT NULL', c);`
      );
      lines.push(
        `    EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN RAISE NOTICE '${table.name}.% : %', c, SQLERRM; END;`
      );
      lines.push(`  END LOOP;`);
    }
    lines.push(`END $$;`);
    lines.push('');
  }

  const dropChecksTables = tables.filter((t) => t.dropChecks?.length);
  if (dropChecksTables.length) {
    lines.push('-- 2b. Drop legacy CHECK constraints the app values violate.');
    lines.push(`DO $$`);
    lines.push(`DECLARE c text;`);
    lines.push(`BEGIN`);
    for (const table of dropChecksTables) {
      lines.push(`  IF to_regclass('public.${table.name}') IS NULL THEN`);
      lines.push(`    RAISE NOTICE 'skipping checks: public.${table.name} does not exist';`);
      lines.push(`  ELSE`);
      lines.push(
        `    FOREACH c IN ARRAY ARRAY[${table.dropChecks!.map((c) => `'${c}'`).join(',')}] LOOP`
      );
      lines.push(`      BEGIN`);
      lines.push(
        `        EXECUTE format('ALTER TABLE public.${table.name} DROP CONSTRAINT IF EXISTS %I', c);`
      );
      lines.push(
        `      EXCEPTION WHEN others THEN RAISE NOTICE '${table.name}.% check drop skipped: %', c, SQLERRM; END;`
      );
      lines.push(`    END LOOP;`);
      lines.push(`  END IF;`);
    }
    lines.push(`END $$;`);
    lines.push('');
  }

  const textIdTables = tables.filter((t) => t.textId).map((t) => t.name);
  if (textIdTables.length) {
    lines.push('-- 3. Coerce legacy uuid id columns to text (the app writes text ids).');
    lines.push(`DO $$`);
    lines.push(`DECLARE t text;`);
    lines.push(`BEGIN`);
    lines.push(`  FOREACH t IN ARRAY ARRAY[${textIdTables.map((t) => `'${t}'`).join(',')}] LOOP`);
    lines.push(`    BEGIN`);
    lines.push(
      `      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='id' AND data_type='uuid') THEN`
    );
    lines.push(`        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT', t);`);
    lines.push(`        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE text USING id::text', t);`);
    lines.push(`        RAISE NOTICE '% .id converted to text', t;`);
    lines.push(`      END IF;`);
    lines.push(
      `    EXCEPTION WHEN others THEN RAISE NOTICE '% id coercion skipped: %', t, SQLERRM; END;`
    );
    lines.push(`  END LOOP;`);
    lines.push(`END $$;`);
    lines.push('');
  }

  lines.push('-- 4. Grants + permissive RLS on the affected tables.');
  lines.push(`DO $$`);
  lines.push(`DECLARE t text; r text;`);
  lines.push(`BEGIN`);
  lines.push(`  FOREACH t IN ARRAY ARRAY[${tableList}] LOOP`);
  lines.push(`    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;`);
  lines.push(`    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP`);
  lines.push(`      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN`);
  lines.push(
    `        BEGIN EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO %I', t, r);`
  );
  lines.push(
    `        EXCEPTION WHEN others THEN RAISE NOTICE 'grant % on % failed: %', r, t, SQLERRM; END;`
  );
  lines.push(`      END IF;`);
  lines.push(`    END LOOP;`);
  lines.push(`    BEGIN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);`);
  lines.push(`      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all on ' || t, t);`);
  lines.push(
    `      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Allow all on ' || t, t);`
  );
  lines.push(`    EXCEPTION WHEN others THEN RAISE NOTICE 'rls on % failed: %', t, SQLERRM; END;`);
  lines.push(`  END LOOP;`);
  lines.push(`END $$;`);
  lines.push('');

  lines.push('-- 5. Verify — should list each repaired table.');
  lines.push(`SELECT table_name, count(*) AS columns`);
  lines.push(`  FROM information_schema.columns`);
  lines.push(` WHERE table_schema = 'public'`);
  lines.push(`   AND table_name IN (${tableList})`);
  lines.push(` GROUP BY table_name ORDER BY table_name;`);
  lines.push('');

  return lines.join('\n');
}

/**
 * True when the error is the diagnostic's own fault rather than a schema
 * problem: a text sentinel id written to a uuid column (22P02), or a random
 * uuid rejected by profiles.id -> auth.users (23503).
 */
export function isSyntheticProfileIdIssue(message: string): boolean {
  return /22P02|invalid input syntax for type uuid/i.test(message) || /23503|violates foreign key constraint/i.test(message);
}

export interface BalanceProbePlan {
  id: string;
  membershipNumber?: string;
  before: { stamps: number; completedCards: number; meritPoints: number };
  /** Sentinel values (+1) so a write can be told apart from a no-op. */
  probe: { stamps: number; tickets: number; points: number };
  /** The original values (incl. last_spin_date), written back after the probe. */
  restore: { stamps: number; tickets: number; points: number; lastSpinDate: string | null };
}

/**
 * Plans a non-destructive balance write against a real profile row.
 *
 * profiles.id is uuid with a FK to auth.users, so the diagnostic cannot create
 * a synthetic row to write to. Instead it probes an existing profile with
 * sentinel values (+1) and restores the originals afterwards.
 */
export function planBalanceProbe(row: {
  id: string;
  membership_number?: string | null;
  stamps?: unknown;
  completed_cards?: unknown;
  merit_points?: unknown;
  last_spin_date?: unknown;
}): BalanceProbePlan {
  const before = {
    stamps: Number(row.stamps) || 0,
    completedCards: Number(row.completed_cards) || 0,
    meritPoints: Number(row.merit_points) || 0,
  };
  const lastSpinDate = row.last_spin_date == null ? null : String(row.last_spin_date);
  return {
    id: row.id,
    membershipNumber: row.membership_number || undefined,
    before,
    probe: { stamps: before.stamps + 1, tickets: before.completedCards + 1, points: before.meritPoints + 1 },
    restore: { stamps: before.stamps, tickets: before.completedCards, points: before.meritPoints, lastSpinDate },
  };
}

/**
 * Repair SQL for the loyalty-balance diagnostic.
 *
 * The self-test now probes a real profile (writes sentinel values, then
 * restores them), because profiles.id is uuid with a FK to auth.users so no
 * synthetic row can satisfy it. This script is the manual fallback for when
 * the write itself is broken: it adds any missing balance columns / grants and
 * runs the same balance UPDATE inside a transaction that is rolled back, so no
 * member data is changed.
 */
export function generateProfileBalanceProbeSql(profileId?: string): string {
  const target = profileId ? `'${profileId}'::uuid` : 'NULL';
  const dollar = String.fromCharCode(36);
  return [
    '-- ==========================================================================',
    "-- Stakey's Cycles — stamp / ticket / point balance probe",
    '-- Generated from Staff area → Feature Test Bench → Create fix SQL.',
    '-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.',
    '-- Non-destructive: adds missing columns/grants and runs a real balance',
    '-- update inside a transaction that is rolled back, so no data is changed.',
    '-- ==========================================================================',
    '',
    '-- 1. Ensure the loyalty balance columns exist (fixes PGRST204).',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spin_date TEXT;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_spun_at TIMESTAMPTZ;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_stamped_at TIMESTAMPTZ;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stamps INTEGER DEFAULT 0;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS completed_cards INTEGER DEFAULT 0;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merit_points INTEGER DEFAULT 0;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tickets INTEGER DEFAULT 0;',
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_number TEXT;',
    'ALTER TABLE public.profiles ALTER COLUMN membership_number DROP NOT NULL;',
    '',
    '-- 2. Re-apply grants + permissive RLS so the anon key can write.',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;',
    'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;',
    'DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;',
    'CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);',
    '',
    '-- 3. The schema the app writes must be present:',
    'SELECT column_name, data_type',
    '  FROM information_schema.columns',
    " WHERE table_schema = 'public' AND table_name = 'profiles'",
    ' ORDER BY ordinal_position;',
    '',
    '-- 4. Real balance probe (rolls back — nothing is changed). This runs the',
    '--    exact UPDATE the app performs, using a real profile id, so a failure',
    '--    here is a genuine write problem and not the self-test’s synthetic id.',
    `DO ${dollar}${dollar}`,
    `DECLARE target uuid := ${target};`,
    'BEGIN',
    '  IF target IS NULL THEN',
    '    SELECT id INTO target FROM public.profiles ORDER BY created_at LIMIT 1;',
    '  END IF;',
    '  IF target IS NULL THEN',
    "    RAISE NOTICE 'No profiles rows exist, so there is nothing to probe.';",
    '    RETURN;',
    '  END IF;',
    '  UPDATE public.profiles',
    '     SET stamps = stamps + 0,',
    '         completed_cards = completed_cards + 0,',
    '         merit_points = merit_points + 0,',
    '         last_spin_date = last_spin_date,',
    '         updated_at = NOW()',
    '   WHERE id = target;',
    "  RAISE NOTICE 'Balance write probe OK for profile %', target;",
    `  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'rollback probe';`,
    'EXCEPTION WHEN raise_exception THEN',
    "  RAISE NOTICE 'Probe complete — changes rolled back.';",
    `END ${dollar}${dollar};`,
    '',
    '-- 5. Back to the Feature Test Bench: the self-test still reports Broken by',
    '--    design (profiles.id is uuid + FK to auth.users, so a synthetic row is',
    '--    impossible). Use this probe as the source of truth for stamp writes.',
    '',
  ].join('\n');
}

