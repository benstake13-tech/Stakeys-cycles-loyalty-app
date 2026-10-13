#!/usr/bin/env node
/**
 * Repair member sign-in against a live Supabase project, using the Admin API.
 *
 * WHY THIS EXISTS
 * The live project has email confirmation on with no working mailer, so new
 * signups 500 ("Error sending confirmation email") and pre-existing members
 * whose stored password no longer matches get `invalid_credentials`. Neither is
 * fixable from the browser: passwords are hashed in `auth.users` and only a
 * service-role call can (re)set them. This script is that privileged call.
 *
 * The service-role key is read from the environment and never written to disk,
 * logged, or bundled. Run it server-side only.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-member-logins.mjs status
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-member-logins.mjs list [filter]
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-member-logins.mjs reset <email> [password]
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-member-logins.mjs reset-all [password]
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/repair-member-logins.mjs links [filter]
 *
 * `reset`/`reset-all` set a confirmed password. `links` emits one-time recovery
 * links (type=recovery) that a customer can open to set their own password —
 * the right flow when SMTP is dead, since the owner can send the link directly.
 */
import { randomBytes } from 'node:crypto';
import { resolveSupabaseUrl, resolveServiceKey } from '../api/auth/_shared.js';

const url = resolveSupabaseUrl().replace(/\/+$/, '');
const { key: serviceKey, source } = resolveServiceKey();

if (!serviceKey) {
  console.error(
    'Missing service-role key. Set SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API).'
  );
  process.exit(2);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function api(path, init = {}) {
  const res = await fetch(`${url}${path}`, { headers, ...init });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function strongPassword() {
  return `Stk-${randomBytes(9).toString('base64url')}`;
}

async function listUsers() {
  const users = [];
  for (let page = 1; page <= 50; page += 1) {
    const { ok, body } = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!ok) throw new Error(`list users failed (${body?.msg || body?.message || 'unknown'})`);
    const batch = Array.isArray(body) ? body : body.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function repairUser(user, password) {
  const { ok, status, body } = await api(`/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    body: JSON.stringify({ password, email_confirm: true }),
  });
  return { ok, status, error: body?.msg || body?.message };
}

async function main() {
  const [command, arg1, arg2] = process.argv.slice(2);
  console.log(`project: ${url}   service key source: ${source}`);

  if (command === 'status') {
    const settings = await api('/auth/v1/settings').catch(() => ({ body: null }));
    const users = await listUsers();
    const confirmed = users.filter((u) => u.email_confirmed_at || u.confirmed_at).length;
    console.log('auth settings:', JSON.stringify(settings.body));
    console.log(`members: ${users.length}  confirmed: ${confirmed}  unconfirmed: ${users.length - confirmed}`);
    return;
  }

  if (command === 'list') {
    const filter = (arg1 || '').toLowerCase();
    const users = await listUsers();
    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      if (filter && !email.includes(filter)) continue;
      const confirmed = Boolean(u.email_confirmed_at || u.confirmed_at);
      console.log(`${confirmed ? '✓' : '✗'} ${u.email}  id=${u.id}  last_sign_in=${u.last_sign_in_at || 'never'}`);
    }
    return;
  }

  if (command === 'reset') {
    if (!arg1) throw new Error('usage: reset <email> [password]');
    const email = arg1.toLowerCase();
    const users = await listUsers();
    const user = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (!user) throw new Error(`no member with email ${email}`);
    const password = arg2 || strongPassword();
    const r = await repairUser(user, password);
    if (!r.ok) throw new Error(`repair failed (${r.status}): ${r.error || 'unknown'}`);
    console.log(`repaired ${email}\n  temporary password: ${password}`);
    return;
  }

  if (command === 'reset-all') {
    const password = arg1 || strongPassword();
    const users = await listUsers();
    let fixed = 0;
    for (const u of users) {
      const r = await repairUser(u, password);
      if (r.ok) fixed += 1;
      else console.error(`  ! ${u.email}: ${r.status} ${r.error || ''}`);
    }
    console.log(`repaired ${fixed}/${users.length} members\n  shared temporary password: ${password}`);
    return;
  }

  if (command === 'links') {
    const filter = (arg1 || '').toLowerCase();
    const users = await listUsers();
    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      if (filter && !email.includes(filter)) continue;
      const { ok, body } = await api('/auth/v1/admin/generate_link', {
        method: 'POST',
        body: JSON.stringify({ type: 'recovery', email: u.email }),
      });
      if (!ok) {
        console.error(`  ! ${u.email}: ${body?.msg || body?.message || 'link failed'}`);
        continue;
      }
      console.log(`${u.email}\t${body?.action_link || body?.properties?.action_link || '(no link)'}`);
    }
    return;
  }

  console.error('unknown command. use: status | list | reset | reset-all | links');
  process.exit(2);
}

main().catch((err) => {
  console.error(`ERROR: ${err?.message || err}`);
  process.exit(1);
});
