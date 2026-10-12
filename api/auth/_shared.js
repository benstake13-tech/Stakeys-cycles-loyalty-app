/**
 * Shared server helpers for the `/api/auth/*` family.
 *
 * Jobs, all server-only:
 *   1. `health` — a public, read-only snapshot of the Supabase Auth backend so
 *      the app can tell "the sign-in service is down" apart from "this password
 *      is wrong" BEFORE a customer ever sees a misleading "invalid credentials".
 *   2. `provision-member` — an admin-gated repair that (re)creates a confirmed
 *      member login using the service-role key, so fixing "customers can't sign
 *      in" no longer requires a manual trip to the Supabase SQL Editor.
 *   3. `repair-bridge` — the one-click version of the same fix: it reads the
 *      bridge report, confirms every unconfirmed login and backfills a login for
 *      every member profile that has none, all in one request.
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
    // Both are the "customers can't sign in" class of outage: sign-ups that can
    // never confirm, and logins that already exist but are stuck unconfirmed.
    needsEmailConfirmation: emailEnabled && !mailerAutoconfirm,
    hasServiceRole,
    adminConfigured,
    // True when a blocker that produces "customers can't sign in" is present.
    needsAttention: !reachable || disableSignup || (emailEnabled && !mailerAutoconfirm),
    oneClickRepairAvailable: Boolean(hasServiceRole && adminConfigured),
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
 * The password handed to members whose login is backfilled in bulk. Exported so
 * the caller can tell the operator exactly which password to relay.
 */
export const BRIDGE_DEFAULT_PASSWORD = 'Stakeys123!';

/** Lists every Supabase Auth login via the service-role Admin API. */
export async function fetchAuthAdminUsers({ url, serviceKey, fetchImpl = fetch }) {
  const res = await fetchImpl(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`Could not list member logins (${res.status}).`);
  const body = await res.json().catch(() => ({}));
  return Array.isArray(body?.users) ? body.users : [];
}

/** Lists loyalty profiles via PostgREST (service-role bypasses RLS). */
export async function fetchLoyaltyProfiles({ url, serviceKey, fetchImpl = fetch }) {
  const res = await fetchImpl(`${url}/rest/v1/profiles?select=id,email,display_name,role&limit=5000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`Could not read loyalty profiles (${res.status}).`);
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

const normEmail = (value) => String(value || '').trim().toLowerCase();

/**
 * Counts the bridge gaps between the two stores, mirroring the SQL
 * `bridge_diagnostics()` so the server can report the same numbers.
 */
export function summarizeBridge(profiles, users) {
  const authById = new Map(users.map((u) => [String(u.id), u]));
  const authEmailSet = new Set(users.map((u) => normEmail(u.email)).filter(Boolean));
  const profilePairs = profiles.map((p) => ({ id: String(p.id), email: normEmail(p.email) }));

  const profilesWithoutLogin = profilePairs.filter(
    (p) => p.email && !authById.has(p.id) && !authEmailSet.has(p.email)
  ).length;

  const loginsWithoutProfile = users.filter((u) => {
    const id = String(u.id);
    const email = normEmail(u.email);
    return !profilePairs.some((p) => p.id === id || (email && p.email === email));
  }).length;

  const unconfirmedLogins = users.filter((u) => !u.email_confirmed_at).length;

  return {
    authLogins: users.length,
    unconfirmedLogins,
    loyaltyProfiles: profiles.length,
    profilesWithoutLogin,
    loginsWithoutProfile,
  };
}

/**
 * Plans the repair: for every loyalty profile that can sign in, keep the uuid
 * (`profiles.id === auth.users.id`) and create the missing login with that id.
 */
export function buildBridgeRepairPlan(profiles) {
  const plan = [];
  for (const p of profiles) {
    const email = normEmail(p.email);
    if (!email || !email.includes('@')) continue;
    plan.push({
      id: String(p.id),
      email,
      displayName: p.display_name || email.split('@')[0],
    });
  }
  return plan;
}

/** Confirms one existing login (sets email_confirmed_at) via the Admin API. */
async function confirmLogin({ url, serviceKey, userId, fetchImpl }) {
  const res = await fetchImpl(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_confirm: true }),
  });
  return res.status >= 200 && res.status < 300;
}

/** Creates one confirmed login, reusing the profile uuid so the stores match. */
async function createLogin({ url, serviceKey, id, email, displayName, password, fetchImpl }) {
  const res = await fetchImpl(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, role: 'customer' },
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.status >= 200 && res.status < 300, status: res.status, error: body?.msg || body?.error_description };
}

/**
 * One-click bridge repair. Confirms every unconfirmed login and creates a
 * confirmed login for every member profile that has none — reusing the profile
 * uuid so `profiles.id === auth.users.id`. Returns before/after counts plus a
 * per-member result list. Throws only when a store cannot be read at all.
 */
export async function repairAppBridge({
  url,
  serviceKey,
  defaultPassword = BRIDGE_DEFAULT_PASSWORD,
  fetchImpl = fetch,
}) {
  const [profiles, users] = await Promise.all([
    fetchLoyaltyProfiles({ url, serviceKey, fetchImpl }),
    fetchAuthAdminUsers({ url, serviceKey, fetchImpl }),
  ]);
  const before = summarizeBridge(profiles, users);

  const authById = new Map(users.map((u) => [String(u.id), u]));
  const authByEmail = new Map(users.map((u) => [normEmail(u.email), u]).filter(([e]) => e));
  const results = [];
  let confirmed = 0;
  let created = 0;
  let failed = 0;

  // 1. Confirm existing logins that are stuck unconfirmed.
  for (const user of users) {
    if (user.email_confirmed_at) continue;
    const ok = await confirmLogin({ url, serviceKey, userId: String(user.id), fetchImpl });
    if (ok) confirmed += 1;
    else failed += 1;
    results.push({ email: normEmail(user.email), action: 'confirm', ok });
  }

  // 2. Backfill a confirmed login for every profile that has none.
  for (const item of buildBridgeRepairPlan(profiles)) {
    if (authById.has(item.id) || authByEmail.has(item.email)) continue;
    const out = await createLogin({ ...item, url, serviceKey, password: defaultPassword, fetchImpl });
    if (out.ok) created += 1;
    else failed += 1;
    results.push({ email: item.email, action: 'create', ok: out.ok, error: out.error });
  }

  const [profilesAfter, usersAfter] = await Promise.all([
    fetchLoyaltyProfiles({ url, serviceKey, fetchImpl }),
    fetchAuthAdminUsers({ url, serviceKey, fetchImpl }),
  ]);
  const after = summarizeBridge(profilesAfter, usersAfter);

  return {
    before,
    after,
    confirmed,
    created,
    failed,
    results,
    // Only hand back the shared password when a login was actually created.
    defaultPassword: created > 0 ? defaultPassword : null,
  };
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
