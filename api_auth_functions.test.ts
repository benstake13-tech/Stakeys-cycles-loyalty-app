import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveServiceKey,
  resolveAnonKey,
  resolveSupabaseUrl,
  parseAdminEmails,
  buildAuthHealth,
  fetchAuthSettings,
  authoriseAdmin,
  provisionMemberLogin,
  summarizeBridge,
  buildBridgeRepairPlan,
  repairAppBridge,
} from './api/auth/_shared.js';
import authHandler from './api/auth/[action].js';

const healthHandler = (req: any, res: any) =>
  authHandler({ ...req, query: { ...(req?.query || {}), action: 'health' } }, res);
const provisionHandler = (req: any, res: any) =>
  authHandler({ ...req, query: { ...(req?.query || {}), action: 'provision-member' } }, res);
const repairHandler = (req: any, res: any) =>
  authHandler({ ...req, query: { ...(req?.query || {}), action: 'repair-bridge' } }, res);

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ADMIN_EMAILS;
});

describe('auth server config resolution', () => {
  it('finds the service key under any accepted env name', () => {
    expect(resolveServiceKey({ SUPABASE_SERVICE_ROLE_KEY: 'a' }).key).toBe('a');
    expect(resolveServiceKey({ SERVICE_ROLE_KEY: 'b' }).source).toBe('SERVICE_ROLE_KEY');
    expect(resolveServiceKey({}).key).toBeNull();
  });

  it('trims whitespace and wrapping quotes from a pasted key', () => {
    expect(resolveServiceKey({ SUPABASE_SERVICE_ROLE_KEY: '  "abc"  ' }).key).toBe('abc');
  });

  it('resolves the supabase url with a safe default', () => {
    expect(resolveSupabaseUrl({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBe('https://x.supabase.co');
    expect(resolveSupabaseUrl({})).toMatch(/supabase\.co$/);
  });

  it('parses the admin allowlist to lowercase and drops blanks', () => {
    const set = parseAdminEmails('Ben@Stakeys.co.uk, workshop@x.co ');
    expect(set.has('ben@stakeys.co.uk')).toBe(true);
    expect(set.has('workshop@x.co')).toBe(true);
    expect(set.size).toBe(2);
    expect(resolveAnonKey({ VITE_SUPABASE_ANON_KEY: 'anon' })).toBe('anon');
  });
});

describe('buildAuthHealth', () => {
  it('flags attention when signup needs email confirmation but mailer is off', () => {
    const h = buildAuthHealth({
      reachable: true,
      settings: { mailer_autoconfirm: false, external: { email: true } },
      hasServiceRole: false,
      adminConfigured: false,
    });
    expect(h.needsAttention).toBe(true);
    expect(h.needsEmailConfirmation).toBe(true);
  });

  it('is healthy when autoconfirm is on', () => {
    const h = buildAuthHealth({
      reachable: true,
      settings: { mailer_autoconfirm: true, external: { email: true } },
      hasServiceRole: true,
      adminConfigured: true,
    });
    expect(h.needsAttention).toBe(false);
    expect(h.mailerAutoconfirm).toBe(true);
  });

  it('flags attention when the backend is unreachable', () => {
    expect(buildAuthHealth({ reachable: false, settings: null, hasServiceRole: false, adminConfigured: false }).needsAttention).toBe(true);
  });
});

describe('fetchAuthSettings', () => {
  it('returns parsed settings on success', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: false }) }));
    const out = await fetchAuthSettings('https://p.supabase.co', 'anon', fetchImpl as any);
    expect(out).toEqual({ mailer_autoconfirm: false });
  });

  it('returns null (never throws) on a failed call', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await fetchAuthSettings('https://p.supabase.co', 'anon', fetchImpl as any)).toBeNull();
  });
});

describe('authoriseAdmin', () => {
  const adminEmails = parseAdminEmails('boss@stakeys.co.uk');

  it('rejects when no admin allowlist is configured', async () => {
    const out = await authoriseAdmin({ url: 'u', anonKey: 'a', accessToken: 't', adminEmails: new Set() });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(503);
  });

  it('rejects a token whose user is not in the allowlist', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ email: 'random@x.co' }) }));
    const out = await authoriseAdmin({ url: 'u', anonKey: 'a', accessToken: 't', adminEmails, fetchImpl: fetchImpl as any });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(403);
  });

  it('accepts a verified admin token', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ email: 'Boss@Stakeys.co.uk' }) }));
    const out = await authoriseAdmin({ url: 'u', anonKey: 'a', accessToken: 't', adminEmails, fetchImpl: fetchImpl as any });
    expect(out).toEqual({ ok: true, email: 'boss@stakeys.co.uk' });
  });
});

describe('provisionMemberLogin', () => {
  it('creates a new confirmed user when no id is supplied', async () => {
    const calls: any[] = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { status: 200, json: async () => ({ id: 'new-1' }) };
    });
    const out = await provisionMemberLogin({
      url: 'https://p.supabase.co',
      serviceKey: 'svc',
      email: 'a@b.co',
      password: 'secret1',
      metadata: {},
      existingUserId: undefined,
      fetchImpl: fetchImpl as any,
    });
    expect(out.status).toBe(200);
    expect(calls[0].url).toBe('https://p.supabase.co/auth/v1/admin/users');
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.email_confirm).toBe(true);
    expect(sent.password).toBe('secret1');
  });

  it('updates an existing user in place to preserve profiles.id === auth.users.id', async () => {
    const calls: any[] = [];
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { status: 200, json: async () => ({ id: 'u-9' }) };
    });
    await provisionMemberLogin({
      url: 'https://p.supabase.co',
      serviceKey: 'svc',
      email: 'a@b.co',
      password: 'secret1',
      metadata: {},
      existingUserId: 'u-9',
      fetchImpl: fetchImpl as any,
    });
    expect(calls[0].url).toBe('https://p.supabase.co/auth/v1/admin/users/u-9');
    expect(calls[0].init.method).toBe('PUT');
  });
});

describe('auth handler', () => {
  it('serves a 200 health snapshot with no-store caching', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ mailer_autoconfirm: false, external: { email: true } }),
    } as any);
    const res = mockRes();
    await healthHandler({ headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.needsAttention).toBe(true);
  });

  it('404s an unknown action', async () => {
    const res = mockRes();
    await authHandler({ headers: {}, query: { action: 'nope' } }, res);
    expect(res.statusCode).toBe(404);
  });

  it('rejects a provision request with no bearer token', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    const res = mockRes();
    await provisionHandler({ headers: {}, query: {}, body: { email: 'a@b.co', password: 'secret1' } }, res);
    expect(res.statusCode).toBe(401);
  });

  it('reports a missing service-role key after the caller is authorised', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'boss@stakeys.co.uk' }),
    } as any);
    const res = mockRes();
    await provisionHandler(
      { headers: { authorization: 'Bearer tok' }, query: {}, body: { email: 'a@b.co', password: 'secret1' } },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.body.hint).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('provisions a member when authorised and the key is present', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ email: 'boss@stakeys.co.uk' }) } as any;
      return { status: 200, json: async () => ({ id: 'new-1' }) } as any;
    });
    const res = mockRes();
    await provisionHandler(
      { headers: { authorization: 'Bearer tok' }, query: {}, body: { email: 'A@B.co', password: 'secret1' } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, email: 'a@b.co' });
  });
});

describe('bridge summary + repair plan', () => {
  const profiles = [
    { id: 'p1', email: 'Linked@Example.com', display_name: 'Linked Member' },
    { id: 'p2', email: 'orphan@example.com', display_name: 'Orphan' },
    { id: 'p3', email: '', display_name: 'No email' },
  ];

  it('counts members with no login, keyed on id or email', () => {
    const users = [{ id: 'p1', email: 'linked@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' }];
    const out = summarizeBridge(profiles, users);
    expect(out.loyaltyProfiles).toBe(3);
    expect(out.authLogins).toBe(1);
    // p2 has neither a matching id nor a matching email; p3 has no email at all.
    expect(out.profilesWithoutLogin).toBe(1);
    expect(out.loginsWithoutProfile).toBe(0);
  });

  it('flags unconfirmed logins and logins with no profile', () => {
    const users = [
      { id: 'p1', email: 'linked@example.com', email_confirmed_at: null },
      { id: 'x9', email: 'ghost@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
    ];
    const out = summarizeBridge(profiles, users);
    expect(out.unconfirmedLogins).toBe(1);
    expect(out.loginsWithoutProfile).toBe(1);
  });

  it('plans a login per email-bearing profile, normalising the address', () => {
    const plan = buildBridgeRepairPlan(profiles);
    expect(plan.map((p) => p.email)).toEqual(['linked@example.com', 'orphan@example.com']);
    expect(plan[0]).toMatchObject({ id: 'p1', displayName: 'Linked Member' });
    expect(plan[1].displayName).toBe('Orphan');
  });
});

describe('repairAppBridge (one-click)', () => {
  it('confirms stuck logins and backfills a login for every member without one', async () => {
    const profilesBefore = [
      { id: 'p1', email: 'a@x.co', display_name: 'A' },
      { id: 'p2', email: 'b@x.co', display_name: 'B' },
    ];
    const calls: any[] = [];

    const fetchImpl = vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (String(url).includes('/rest/v1/profiles')) {
        return { ok: true, json: async () => profilesBefore } as any;
      }
      if (String(url).includes('/admin/users?page')) {
        const created = calls.some((c) => String(c.url).endsWith('/admin/users') && c.init?.method === 'POST');
        const confirmed = calls.some((c) => String(c.url).includes('/admin/users/p1') && c.init?.method === 'PUT');
        const users = [
          { id: 'p1', email: 'a@x.co', email_confirmed_at: confirmed ? '2026-02-02T00:00:00Z' : null },
          ...(created ? [{ id: 'p2', email: 'b@x.co', email_confirmed_at: '2026-02-02T00:00:00Z' }] : []),
        ];
        return { ok: true, json: async () => ({ users }) } as any;
      }
      // admin PUT (confirm) / POST (create)
      return { status: 200, json: async () => ({ id: 'p2' }) } as any;
    });

    const out = await repairAppBridge({ url: 'https://p.supabase.co', serviceKey: 'svc', fetchImpl: fetchImpl as any });

    expect(out.before.profilesWithoutLogin).toBe(1);
    expect(out.confirmed).toBe(1);
    expect(out.created).toBe(1);
    expect(out.failed).toBe(0);
    expect(out.after.profilesWithoutLogin).toBe(0);
    expect(out.after.unconfirmedLogins).toBe(0);
    // The new login reuses the profile's uuid so the two stores line up.
    const createCall = calls.find((c) => String(c.url).endsWith('/admin/users') && c.init?.method === 'POST');
    expect(JSON.parse(createCall.init.body).id).toBe('p2');
    expect(out.defaultPassword).toBeTruthy();
  });

  it('reports a healthy bridge with nothing to change and no password handed back', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('/rest/v1/profiles')) {
        return { ok: true, json: async () => [{ id: 'p1', email: 'a@x.co', display_name: 'A' }] } as any;
      }
      return {
        ok: true,
        json: async () => ({ users: [{ id: 'p1', email: 'a@x.co', email_confirmed_at: '2026-01-01T00:00:00Z' }] }),
      } as any;
    });
    const out = await repairAppBridge({ url: 'https://p.supabase.co', serviceKey: 'svc', fetchImpl: fetchImpl as any });
    expect(out.confirmed).toBe(0);
    expect(out.created).toBe(0);
    expect(out.defaultPassword).toBeNull();
  });

  it('throws when a store cannot be read at all', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as any);
    await expect(
      repairAppBridge({ url: 'https://p.supabase.co', serviceKey: 'svc', fetchImpl: fetchImpl as any })
    ).rejects.toThrow(/Could not/);
  });
});

describe('repair-bridge action', () => {
  it('rejects a caller with no bearer token', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    const res = mockRes();
    await repairHandler({ headers: {}, query: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('reports a missing service-role key after the caller is authorised', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'boss@stakeys.co.uk' }),
    } as any);
    const res = mockRes();
    await repairHandler({ headers: { authorization: 'Bearer tok' }, query: {}, body: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.hint).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('runs the repair when authorised with a service key', async () => {
    process.env.ADMIN_EMAILS = 'boss@stakeys.co.uk';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => ({ email: 'boss@stakeys.co.uk' }) } as any;
      if (u.includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ id: 'p1', email: 'a@x.co' }] } as any;
      if (u.includes('/admin/users?page')) {
        return { ok: true, json: async () => ({ users: [{ id: 'p1', email: 'a@x.co', email_confirmed_at: null }] }) } as any;
      }
      return { status: 200, json: async () => ({}) } as any;
    });
    const res = mockRes();
    await repairHandler({ headers: { authorization: 'Bearer tok' }, query: {}, body: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.repairedBy).toBe('boss@stakeys.co.uk');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
});
