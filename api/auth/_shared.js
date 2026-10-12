/**
 * Shared server helpers for the `/api/auth/*` family.
 *
 * Two jobs, both server-only:
 *   1. `health` — a public, read-only snapshot of the Supabase Auth backend so
 *      the app can tell "the sign-in service is down" apart from "this password
 *      is wrong" BEFORE a customer ever sees a misleading "invalid credentials".
 *   2. `provision-member` — an admin-gated repair that (re)creates a confirmed
 *      member login using the service-role key, so fixing "customers can't sign
 *      in" no longer requires a manual trip to the Supabase SQL Editor.
 *
 * The service-role key is read from the environment and NEVER returned to the
 * client. Only presence is reported.
 */

const DEFAULT_SUPABASE_URL = 'https://lhojocpygcnkxvkrcuxh.supabase.co';

const SERVICE_KEY_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'SERVICE_ROLE_KEY',
];

const ANON_KEY_ENV_NAMES = ['VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'];

function read(env, name) {
  const raw = env[name];
  return typeof raw === 'string' && raw.trim() ? raw.trim().replace(/^["']|["']$/g, '') : null;
}

export function resolveSupabaseUrl(env = process.env) {
  return read(env, 'SUPABASE_URL') || read(env, 'VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
}

/** Finds the service-role key under any accepted env name (value never logged). */
export function resolveServiceKey(env = process.env) {
  for (const name of SERVICE_KEY_ENV_NAMES) {
    const value = read(env, name);
    if (value) return { key: value, source: name };
  }
  return { key: null, source: null };
}

export function resolveAnonKey(env = process.env) {
  for (const name of ANON_KEY_ENV_NAMES) {
    const value = read(env, name);
    if (value) return value;
  }
  return null;
}

/** Normalises the comma/space-separated admin allowlist into a lowercase Set. */
export function parseAdminEmails(raw) {
  return new Set(
    String(raw || '')
      .split(/[\s,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function resolveAdminEmails(env = process.env) {
  return parseAdminEmails(read(env, 'ADMIN_EMAILS') || read(env, 'VITE_ADMIN_EMAILS') || '');
}

/**
 * Builds the read-only health snapshot. `settings` is the parsed body of
 * GoTrue's `/auth/v1/settings`; pass `null` when that call failed.
 *
 * The important signal is `needsEmailConfirmation && !mailerAutoconfirm`:
 * with `mailer_autoconfirm:false` and no working SMTP, every signup fails with
 * "Error sending confirmation email" and no new customer can ever sign in.
 */
export function buildAuthHealth({ reachable, settings, hasServiceRole, adminConfigured }) {
  const s = settings || {};
  const mailerAutoconfirm = Boolean(s?.mailer_autoconfirm);
  const emailEnabled = Boolean(s?.external?.email);
  const disableSignup = Boolean(s?.disable_signup);

  return {
    reachable,
    signupsEnabled: !disableSignup,
    emailAuthEnabled: emailEnabled,
    mailerAutoconfirm,
    needsEmailConfirmation: emailEnabled && !mailerAutoconfirm,
    hasServiceRole,
    adminConfigured,
    // True when a blocker that produces "customers can't sign in" is present.
    needsAttention: !reachable || disableSignup || (emailEnabled && !mailerAutoconfirm),
  };
}

/** Fetch GoTrue settings. Returns null on any failure (never throws). */
export async function fetchAuthSettings(url, anonKey, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${url}/auth/v1/settings`, {
      headers: anonKey ? { apikey: anonKey } : {},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verifies the caller's Supabase access token and confirms their email is in
 * the admin allowlist. Returns `{ ok: true, email }` or `{ ok: false, status, error }`.
 * Never trusts a client-supplied email — it is read from the verified user.
 */
export async function authoriseAdmin({ url, anonKey, accessToken, adminEmails, fetchImpl = fetch }) {
  if (!adminEmails || adminEmails.size === 0) {
    return { ok: false, status: 503, error: 'Admin access is not configured (set ADMIN_EMAILS on the server).' };
  }
  if (!accessToken) {
    return { ok: false, status: 401, error: 'Missing bearer token.' };
  }
  try {
    const res = await fetchImpl(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey || '', Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: 401, error: 'Invalid or expired session.' };
    const user = await res.json();
    const email = String(user?.email || '').toLowerCase();
    if (!email || !adminEmails.has(email)) {
      return { ok: false, status: 403, error: 'This account is not authorised to repair member logins.' };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, status: 502, error: 'Could not verify the session.' };
  }
}

/**
 * (Re)creates or repairs a confirmed member login via the GoTrue Admin API.
 * Reuses the profile uuid when supplied so `profiles.id === auth.users.id`,
 * matching the SQL repair's invariant. Returns `{ status, body }`.
 */
export async function provisionMemberLogin({
  url,
  serviceKey,
  email,
  password,
  metadata,
  existingUserId,
  fetchImpl = fetch,
}) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // If the user id is known (existing profile), update in place (confirm + set
  // password); otherwise create a new confirmed user.
  if (existingUserId) {
    const res = await fetchImpl(`${url}/auth/v1/admin/users/${existingUserId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password, email_confirm: true, user_metadata: metadata || {} }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }

  const res = await fetchImpl(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata || {},
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
