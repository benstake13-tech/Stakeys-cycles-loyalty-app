/**
 * App bridge — keeps the website + customer app's loyalty profiles and the
 * staff terminal's Supabase Auth logins linked on the same uuid.
 *
 * The bridge breaks when a member has a `profiles` row but no confirmed
 * `auth.users` login (the confirmation email never arrives), which makes every
 * sign-in return "invalid credentials". This module reads the bridge state and
 * hands staff the SQL that repairs it.
 */
import { supabase } from '../lib/supabase';

export interface BridgeDiagnostics {
  reachable: boolean;
  authLogins: number;
  unconfirmedLogins: number;
  loyaltyProfiles: number;
  profilesWithoutLogin: number;
  loginsWithoutProfile: number;
  error?: string;
}

const EMPTY: BridgeDiagnostics = {
  reachable: false,
  authLogins: 0,
  unconfirmedLogins: 0,
  loyaltyProfiles: 0,
  profilesWithoutLogin: 0,
  loginsWithoutProfile: 0,
};

/**
 * Probe the bridge. Tries the `bridge_diagnostics()` RPC (present once the
 * repair SQL has been run) and falls back to a read-only PostgREST count so the
 * button still reports *something* before the SQL is applied.
 */
export async function fetchBridgeDiagnostics(): Promise<BridgeDiagnostics> {
  try {
    const { data, error } = await supabase.rpc('bridge_diagnostics');
    if (!error && Array.isArray(data)) {
      const pick = (metric: string) =>
        Number(data.find((row: { metric: string }) => row.metric === metric)?.total ?? 0);
      return {
        reachable: true,
        authLogins: pick('auth_logins'),
        unconfirmedLogins: pick('unconfirmed_logins'),
        loyaltyProfiles: pick('loyalty_profiles'),
        profilesWithoutLogin: pick('profiles_without_login'),
        loginsWithoutProfile: pick('logins_without_profile'),
      };
    }
  } catch {
    // RPC missing (SQL not applied yet) — fall through to the count probe.
  }

  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    if (error) return { ...EMPTY, error: error.message };
    return { ...EMPTY, reachable: true, loyaltyProfiles: count ?? 0 };
  } catch (err: any) {
    return { ...EMPTY, error: err?.message || 'Bridge probe failed' };
  }
}

/**
 * True once the repair functions exist on the live project. Used to label the
 * button (Repair vs. Re-run).
 */
export async function bridgeRepairInstalled(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('bridge_diagnostics');
    return !error;
  } catch {
    return false;
  }
}
