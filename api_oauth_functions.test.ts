import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The OAuth token exchange and business-insights proxy live in both server.ts
 * (dev) and the Vercel functions under api/. These tests pin the production
 * functions so the deployed Growth tab behaves like the dev server.
 */
import { resolveProvider, exchangeToken } from './api/oauth/_shared.js';
import tokenHandler from './api/oauth/token.js';
import refreshHandler from './api/oauth/refresh.js';
import insightsHandler from './api/business/insights.js';

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

describe('api/business/insights handler', () => {
  it('requires an access token', async () => {
    const res = mockRes();
    await insightsHandler({ method: 'POST', body: { provider: 'meta' } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not_connected');
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
