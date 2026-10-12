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
} from './api/auth/_shared.js';
import authHandler from './api/auth/[action].js';

const healthHandler = (req: any, res: any) =>
  authHandler({ ...req, query: { ...(req?.query || {}), action: 'health' } }, res);
const provisionHandler = (req: any, res: any) =>
  authHandler({ ...req, query: { ...(req?.query || {}), action: 'provision-member' } }, res);

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
