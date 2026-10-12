/**
 * Client for the `/api/auth/*` backend, resolved against the app's real API
 * origin (so it also works inside the packaged native app).
 */
import { apiUrl } from './apiBase';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

export interface AuthHealth {
  reachable: boolean;
  signupsEnabled: boolean;
  emailAuthEnabled: boolean;
  mailerAutoconfirm: boolean;
  needsEmailConfirmation: boolean;
  hasServiceRole: boolean;
  adminConfigured: boolean;
  needsAttention: boolean;
  /** Server reports it holds a service-role key AND an admin allowlist. */
  oneClickRepairAvailable?: boolean;
}

/** The two counts the one-click repair reconciles, before and after. */
export interface BridgeCounts {
  authLogins: number;
  unconfirmedLogins: number;
  loyaltyProfiles: number;
  profilesWithoutLogin: number;
  loginsWithoutProfile: number;
}

export interface BridgeRepairResult {
  success: boolean;
  message: string;
  confirmed?: number;
  created?: number;
  failed?: number;
  before?: BridgeCounts;
  after?: BridgeCounts;
  /** Only present when logins were created — the shared starter password. */
  defaultPassword?: string | null;
}

/** Shape of GoTrue's public `/auth/v1/settings` response (the fields we use). */
interface GoTrueSettings {
  mailer_autoconfirm?: boolean;
  disable_signup?: boolean;
  external?: { email?: boolean };
}

/**
 * Build the health snapshot straight from Supabase's own public settings
 * endpoint, using the baked-in anon key. This reproduces the server's logic
 * client-side so the app can still tell "the sign-in service is misconfigured"
 * apart from "wrong password" even on a deployment that only shipped the static
 * bundle (no `/api/auth/health` function). Never throws.
 */
async function fetchSettingsDirectly(): Promise<AuthHealth | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const s = (await res.json()) as GoTrueSettings;
    const emailEnabled = Boolean(s?.external?.email);
    const mailerAutoconfirm = Boolean(s?.mailer_autoconfirm);
    const disableSignup = Boolean(s?.disable_signup);
    return {
      reachable: true,
      signupsEnabled: !disableSignup,
      emailAuthEnabled: emailEnabled,
      mailerAutoconfirm,
      needsEmailConfirmation: emailEnabled && !mailerAutoconfirm,
      hasServiceRole: false,
      adminConfigured: false,
      needsAttention: disableSignup || (emailEnabled && !mailerAutoconfirm),
      oneClickRepairAvailable: false,
    };
  } catch {
    return null;
  }
}

/**
 * Public backend snapshot, used to tell a genuine wrong-password apart from a
 * server-side outage or a project misconfigured for email confirmation.
 *
 * Tries the server's `/api/auth/health` first (it can also report whether the
 * repair path is configured), then falls back to probing Supabase directly so
 * the diagnosis keeps working on an older deployment. Returns null only when
 * neither source is reachable, so callers never block sign-in on a missing
 * probe.
 */
export async function fetchAuthHealth(): Promise<AuthHealth | null> {
  try {
    const res = await fetch(apiUrl('/api/auth/health'), { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as AuthHealth;
      if (data && typeof data.reachable === 'boolean') return data;
    }
  } catch {
    /* fall through to the direct probe */
  }
  return fetchSettingsDirectly();
}

/**
 * Admin-gated repair: create/confirm a member login using the service-role key
 * held by the server. Requires an active session whose email is in the server's
 * ADMIN_EMAILS allowlist (the server verifies the bearer token itself).
 */
export async function provisionMemberLogin(
  email: string,
  password: string,
  opts: { userId?: string; metadata?: Record<string, unknown> } = {}
): Promise<{ success: boolean; message?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { success: false, message: 'Sign in as an administrator to repair member logins.' };
  }
  try {
    const res = await fetch(apiUrl('/api/auth/provision-member'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, userId: opts.userId, metadata: opts.metadata }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success) {
      return { success: false, message: body?.error || `Repair failed (${res.status}).` };
    }
    return { success: true, message: `Login repaired for ${body.email}.` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not reach the repair service.' };
  }
}

/**
 * One-click bridge repair. Runs the whole fix server-side — confirms every stuck
 * login and backfills a login for every member profile that has none — so the
 * operator does not have to copy SQL into the Supabase editor. Admin-gated: the
 * server verifies the caller's bearer token against its ADMIN_EMAILS allowlist.
 */
export async function repairAppBridge(): Promise<BridgeRepairResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return { success: false, message: 'Sign in as an administrator to repair the bridge.' };
  }
  try {
    const res = await fetch(apiUrl('/api/auth/repair-bridge'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.success) {
      return { success: false, message: body?.error || `Bridge repair failed (${res.status}).` };
    }
    const fixed = (body.confirmed || 0) + (body.created || 0);
    const message =
      fixed > 0
        ? `Bridge repaired — confirmed ${body.confirmed || 0} login${body.confirmed === 1 ? '' : 's'} and created ${body.created || 0}. Every member can now sign in.`
        : 'Bridge already linked — every member has a confirmed login.';
    return {
      success: true,
      message,
      confirmed: body.confirmed,
      created: body.created,
      failed: body.failed,
      before: body.before,
      after: body.after,
      defaultPassword: body.defaultPassword ?? null,
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not reach the bridge repair service.' };
  }
}
