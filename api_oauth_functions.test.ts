import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The OAuth token exchange and business-insights proxy live in both server.ts
 * (dev) and the Vercel functions under api/. These tests pin the production
 * functions so the deployed Growth tab behaves like the dev server.
 */
import { resolveProvider, exchangeToken, exchangeMetaLongLived } from './api/oauth/_shared.js';
import tokenHandler from './api/oauth/token.js';
import refreshHandler from './api/oauth/refresh.js';
import insightsHandler from './api/business/insights.js';
import statusHandler from './api/business/status.js';

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

const ENV = { VITE_META_APP_ID: '61595029330806', META_APP_SECRET: 's3cret', VITE_GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' };

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveProvider', () => {
  it('rejects an unknown provider', () => {
    const r = resolveProvider('tiktok', ENV) as any;
    expect(r.error.status).toBe(400);
  });

  it('reports a missing server secret (browser id present, secret absent)', () => {
    const r = resolveProvider('meta', { VITE_META_APP_ID: '61595029330806' }) as any;
    expect(r.error.status).toBe(500);
    expect(String(r.error.body.error)).toMatch(/not configured/i);
  });

  it('accepts the VITE_ or bare client id, and requires the secret', () => {
    expect((resolveProvider('meta', ENV) as any).clientId).toBe('61595029330806');
    expect((resolveProvider('meta', { META_APP_ID: 'bare', META_APP_SECRET: 'x' }) as any).clientId).toBe('bare');
  });
});

describe('exchangeToken', () => {
  it('posts a urlencoded body and passes the JSON back', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: any) => ({ ok: true, status: 200, json: async () => ({ access_token: 'AT' }) }));
    vi.stubGlobal('fetch', fetchMock);

    const out = await exchangeToken('https://graph.facebook.com/v21.0/oauth/access_token', new URLSearchParams({ code: 'c' }));
    expect(out.ok).toBe(true);
    expect(out.data.access_token).toBe('AT');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('graph.facebook.com');
    expect((init as any).headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});

describe('api/oauth/token handler', () => {
  it('rejects non-POST with 405', async () => {
    const res = mockRes();
    await tokenHandler({ method: 'GET', body: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 for an unknown provider', async () => {
    const res = mockRes();
    await tokenHandler({ method: 'POST', body: { provider: 'x' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('exchanges the code and returns tokens (network mocked)', async () => {
    process.env.VITE_META_APP_ID = ENV.VITE_META_APP_ID;
    process.env.META_APP_SECRET = ENV.META_APP_SECRET;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'AT', expires_in: 3600 }) })));

    const res = mockRes();
    await tokenHandler(
      { method: 'POST', body: { provider: 'meta', code: 'c', codeVerifier: 'v', redirectUri: 'https://x/oauth/callback' } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.access_token).toBe('AT');
  });

  it('swaps the Meta short-lived token for a long-lived one', async () => {
    process.env.VITE_META_APP_ID = ENV.VITE_META_APP_ID;
    process.env.META_APP_SECRET = ENV.META_APP_SECRET;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes('fb_exchange_token')) {
          return { ok: true, status: 200, json: async () => ({ access_token: 'LONG_LIVED', expires_in: 5184000 }) };
        }
        return { ok: true, status: 200, json: async () => ({ access_token: 'SHORT', expires_in: 3600 }) };
      })
    );
    const res = mockRes();
    await tokenHandler({ method: 'POST', body: { provider: 'meta', code: 'c' } }, res);
    expect(res.body.access_token).toBe('LONG_LIVED');
    expect(calls.some((u) => u.includes('fb_exchange_token'))).toBe(true);
  });

  it('passes a provider error through with its upstream status', async () => {
    process.env.VITE_META_APP_ID = ENV.VITE_META_APP_ID;
    process.env.META_APP_SECRET = ENV.META_APP_SECRET;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) })));

    const res = mockRes();
    await tokenHandler({ method: 'POST', body: { provider: 'meta', code: 'bad' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });
});

describe('api/oauth/refresh handler', () => {
  it('exchanges the refresh token (network mocked)', async () => {
    process.env.VITE_META_APP_ID = ENV.VITE_META_APP_ID;
    process.env.META_APP_SECRET = ENV.META_APP_SECRET;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'NEW' }) })));
    const res = mockRes();
    await refreshHandler({ method: 'POST', body: { provider: 'meta', refreshToken: 'rt' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.access_token).toBe('NEW');
  });
});

describe('exchangeMetaLongLived', () => {
  it('requests a long-lived token via fb_exchange_token', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ access_token: 'LL' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await exchangeMetaLongLived('appid', 'secret', 'short');
    expect(out.access_token).toBe('LL');
    expect(String(fetchMock.mock.calls[0][0])).toContain('grant_type=fb_exchange_token');
  });

  it('returns null when the swap fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'x' }) })));
    expect(await exchangeMetaLongLived('a', 's', 't')).toBeNull();
  });
});

describe('api/business/insights handler', () => {
  it('requires an access token when the server holds none', async () => {
    delete process.env.META_SYSTEM_USER_TOKEN;
    const res = mockRes();
    await insightsHandler({ method: 'POST', body: { provider: 'meta' } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not_connected');
  });

  it('falls back to META_SYSTEM_USER_TOKEN for Meta when the browser sends none', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS_TOKEN';
    const fetchMock = vi.fn(async (url: string, init: any) => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'p1', name: 'Stakeys' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const res = mockRes();
    await insightsHandler({ method: 'POST', body: { provider: 'meta', path: 'me/accounts', params: {} } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].name).toBe('Stakeys');
    // The server credential is used as the bearer token.
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer SYS_TOKEN');
    delete process.env.META_SYSTEM_USER_TOKEN;
  });

  it('does not use the Meta server token for other providers', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS_TOKEN';
    const res = mockRes();
    await insightsHandler({ method: 'POST', body: { provider: 'google', path: 'accounts', params: {} } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not_connected');
    delete process.env.META_SYSTEM_USER_TOKEN;
  });

  it('proxies the Meta Graph API and passes the error envelope through', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Token expired', code: 190 } }) })));
    const res = mockRes();
    await insightsHandler(
      { method: 'POST', body: { provider: 'meta', accessToken: 'AT', path: 'me/accounts', params: {} } },
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toBe('Token expired');
  });

  it('returns Meta page rows on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: 'p1', name: 'Stakeys', fan_count: 42 }] }) })));
    const res = mockRes();
    await insightsHandler(
      { method: 'POST', body: { provider: 'meta', accessToken: 'AT', path: 'me/accounts', params: {} } },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].name).toBe('Stakeys');
  });
});

describe('api/business/status handler', () => {
  it('reports serverManaged=true only when META_SYSTEM_USER_TOKEN is set', async () => {
    delete process.env.META_SYSTEM_USER_TOKEN;
    let res = mockRes();
    statusHandler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.meta.serverManaged).toBe(false);

    process.env.META_SYSTEM_USER_TOKEN = 'SYS';
    res = mockRes();
    statusHandler({ method: 'GET' }, res);
    expect(res.body.meta.serverManaged).toBe(true);
    delete process.env.META_SYSTEM_USER_TOKEN;
  });

  it('rejects non-GET', async () => {
    const res = mockRes();
    statusHandler({ method: 'POST' }, res);
    expect(res.statusCode).toBe(405);
  });
});
