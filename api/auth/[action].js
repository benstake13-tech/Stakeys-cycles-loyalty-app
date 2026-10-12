/**
 * Vercel serverless function — Supabase Auth backend (dispatched by action).
 *
 * One function serves `/api/auth/*` to stay within the Vercel Serverless
 * Function budget (Hobby allows 12 per deployment). The action is the dynamic
 * path segment (`/api/auth/health` → `req.query.action === 'health'`).
 *
 *   GET  /api/auth/health            → public, read-only backend snapshot
 *   POST /api/auth/provision-member  → admin-gated member login repair
 *
 * The service-role key is server-only and never returned to the client.
 */
import {
  resolveSupabaseUrl,
  resolveServiceKey,
  resolveAnonKey,
  resolveAdminEmails,
  buildAuthHealth,
  fetchAuthSettings,
  authoriseAdmin,
  provisionMemberLogin,
} from './_shared.js';

async function authHealth(_req, res) {
  const url = resolveSupabaseUrl();
  const anonKey = resolveAnonKey();
  const settings = await fetchAuthSettings(url, anonKey);
  const hasServiceRole = Boolean(resolveServiceKey().key);
  const adminConfigured = resolveAdminEmails().size > 0;

  const health = buildAuthHealth({
    reachable: Boolean(settings),
    settings,
    hasServiceRole,
    adminConfigured,
  });

  // Never let a CDN/browser cache a live backend probe.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(health);
}

async function authProvisionMember(req, res) {
  const url = resolveSupabaseUrl();
  const anonKey = resolveAnonKey();
  const { key: serviceKey } = resolveServiceKey();

  const authHeader = String(req.headers?.authorization || '');
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const auth = await authoriseAdmin({
    url,
    anonKey,
    accessToken,
    adminEmails: resolveAdminEmails(),
  });
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!serviceKey) {
    return res.status(503).json({
      error: 'Member repair is not configured on the server.',
      hint: 'Set SUPABASE_SERVICE_ROLE_KEY in the deployment environment (server-only).',
    });
  }

  const { email, password, metadata, userId } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'A valid member email is required.' });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'A password of at least 6 characters is required.' });
  }

  const result = await provisionMemberLogin({
    url,
    serviceKey,
    email: cleanEmail,
    password: String(password),
    metadata,
    existingUserId: userId ? String(userId) : undefined,
  });

  const ok = result.status >= 200 && result.status < 300;
  return res.status(ok ? 200 : result.status).json({
    success: ok,
    ...(ok
      ? { email: cleanEmail, userId: result.body?.id }
      : { error: result.body?.msg || result.body?.error_description || 'The login could not be provisioned.' }),
  });
}

export default async function authHandler(req, res) {
  const action = req.query?.action;
  try {
    if (action === 'health') return await authHealth(req, res);
    if (action === 'provision-member') return await authProvisionMember(req, res);
    return res.status(404).json({ error: `Unknown auth action: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Unexpected auth server error.' });
  }
}
