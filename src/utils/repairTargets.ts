/**
 * Maps a failing Feature Test Bench area/test to the service that can fix it and
 * the concrete action to take: open the Supabase SQL Editor with copy-ready
 * repair SQL, open the OneSignal dashboard / run the push repair, check email
 * settings, or nothing at all for pure client-side logic.
 *
 * Pure and dependency-light so it can be unit-tested; the UI wires the actual
 * side effects (clipboard, navigation, the push-repair runner).
 */
import { getStoredSupabaseUrl } from '../supabase';
import { getConfiguredAppId } from './pushNotifications';
import { generateProfileBalanceProbeSql, generateRepairSqlForTables } from './schemaSync';
import type { FeatureArea } from './featureDiagnostics';

export type RepairService = 'supabase' | 'onesignal' | 'email' | 'none';

export interface RepairTargetInput {
  area: FeatureArea;
  tables?: string[];
  /** The specific failing test id, when known, so a precise fix can be offered. */
  id?: string;
}

export interface RepairTarget {
  service: RepairService;
  /** Button label for the primary action. */
  label: string;
  /** One-line explanation shown next to the action. */
  hint: string;
  tables: string[];
  /** External dashboard/console to open, when the service has one. */
  openUrl?: string;
  /** Returns the repair SQL to copy (Supabase areas only). */
  copySql?: () => string;
}

/** The Supabase SQL Editor deep link for the configured project. */
export function supabaseSqlEditorUrl(): string {
  const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
  return `https://supabase.com/dashboard/project/${host || 'your-project'}/sql`;
}

/** The OneSignal dashboard deep link, scoped to the app when one is configured. */
export function oneSignalDashboardUrl(appId?: string): string {
  const id = String(appId ?? getConfiguredAppId() ?? '').trim();
  return id ? `https://dashboard.onesignal.com/apps/${id}` : 'https://dashboard.onesignal.com/apps';
}

/** Areas whose failures are almost always a Supabase schema/data drift. */
const SUPABASE_AREAS: FeatureArea[] = [
  'connectivity',
  'loyalty',
  'bookings',
  'till',
  'members',
  'garage',
  'prizes',
  'content',
  'settings',
];

export function resolveRepairTarget({ area, tables = [], id }: RepairTargetInput): RepairTarget {
  if (area === 'reach') {
    return {
      service: 'onesignal',
      label: 'Repair push notifications',
      hint: 'Runs the push repair chain (permission, subscription, sign-in) and opens the OneSignal dashboard for server settings.',
      tables,
      openUrl: oneSignalDashboardUrl(),
    };
  }

  if (area === 'email') {
    return {
      service: 'email',
      label: 'Check email delivery',
      hint: 'Confirm the owner email and the transactional-email provider, then send a test email.',
      tables,
    };
  }

  if (area === 'scanner' || area === 'logic') {
    return {
      service: 'none',
      label: 'No external service',
      hint: 'This area is pure client-side logic — a failure means a code regression, not a service problem.',
      tables,
    };
  }

  if (!SUPABASE_AREAS.includes(area)) {
    return {
      service: 'none',
      label: 'No external service',
      hint: 'No automated repair is available for this area.',
      tables,
    };
  }

  // Supabase schema/data drift — offer the focused repair SQL.
  const balanceProbe = id === 'profile-balance-write';
  return {
    service: 'supabase',
    label: 'Open Supabase SQL Editor',
    hint: 'Copy the repair SQL, paste it into the SQL Editor and Run (safe to re-run), then test again.',
    tables,
    openUrl: supabaseSqlEditorUrl(),
    copySql: () =>
      balanceProbe ? generateProfileBalanceProbeSql() : generateRepairSqlForTables(tables),
  };
}
