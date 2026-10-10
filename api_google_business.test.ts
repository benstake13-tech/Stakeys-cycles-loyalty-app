import { describe, it, expect, afterEach, vi } from 'vitest';
import handler from './api/google-business.js';

/**
 * The Business Profile proxy must keep GOOGLE_BUSINESS_API_KEY server-side and
 * pass the upstream JSON (or a clear error) straight through.
 */

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_BUSINESS_API_KEY;
});

describe('google business handler', () => {
  it('responds 405 for a non-GET request', async () => {
    const res = mockRes();
    await handler({ method: 'POST' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('responds 500 when the API key is not configured', async () => {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/API Key not configured/i);
  });

  it('proxies the upstream JSON and never leaks the key', async () => {
    process.env.GOOGLE_BUSINESS_API_KEY = 'super-secret-key';
    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calledUrl = url;
      return { ok: true, status: 200, json: async () => ({ accounts: [{ name: 'accounts/1' }] }) };
    }));

    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.accounts[0].name).toBe('accounts/1');
    expect(calledUrl).toContain('mybusinessbusinessinformation.googleapis.com');
    // The key is sent to Google, not to the client.
    expect(JSON.stringify(res.body)).not.toContain('super-secret-key');
  });

  it('responds 500 when the upstream call fails', async () => {
    process.env.GOOGLE_BUSINESS_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/Failed to fetch/i);
  });
});
