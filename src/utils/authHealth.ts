/**
 * Client for the `/api/auth/*` backend, resolved against the app's real API
 * origin (so it also works inside the packaged native app).
 */
import { apiUrl } from './apiBase';
import { supabase } from '../lib/supabase';

export interface AuthHealth {
  reachable: boolean;
  signupsEnabled: boolean;
  emailAuthEnabled: boolean;
  mailerAutoconfirm: boolean;
  needsEmailConfirmation: boolean;
  hasServiceRole: boolean;
  adminConfigured: boolean;
  needsAttention: boolean;
}

/**
 * Public backend snapshot. Returns null when the endpoint is unreachable (e.g.
 * an older deployment without this function), so callers never block sign-in on
 * a missing probe.
 */
export async function fetchAuthHealth(): Promise<AuthHealth | null> {
  try {
    const res = await fetch(apiUrl('/api/auth/health'), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as AuthHealth;
    return data && typeof data.reachable === 'boolean' ? data : null;
  } catch {
    return null;
  }
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
