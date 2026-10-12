import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('./src/lib/supabase', () => ({
  supabase: { auth: { getSession: hoisted.getSession } },
  SUPABASE_URL: 'https://lhojocpygcnkxvkrcuxh.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}));

import { repairAppBridge } from './src/utils/authHealth';

/** Minimal Response stand-in. */
function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  hoisted.getSession.mockReset();
  hoisted.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('repairAppBridge (client)', () => {
  it('posts to the repair endpoint with the bearer token and maps the report', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      expect(String(url)).toBe('/api/auth/repair-bridge');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer tok');
      return jsonResponse({
        success: true,
        confirmed: 4,
        created: 5,
        failed: 0,
        defaultPassword: 'Stakeys123!',
        before: { authLogins: 4, unconfirmedLogins: 4, loyaltyProfiles: 9, profilesWithoutLogin: 5, loginsWithoutProfile: 0 },
        after: { authLogins: 9, unconfirmedLogins: 0, loyaltyProfiles: 9, profilesWithoutLogin: 0, loginsWithoutProfile: 0 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await repairAppBridge();
    expect(res.success).toBe(true);
    expect(res.confirmed).toBe(4);
    expect(res.created).toBe(5);
    expect(res.message).toMatch(/confirmed 4 logins and created 5/i);
    expect(res.defaultPassword).toBe('Stakeys123!');
  });

  it('refuses without a session and never calls the network', async () => {
    hoisted.getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await repairAppBridge();
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/administrator/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the server error message on a refused repair', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: false, error: 'This account is not authorised.' }, false));
    vi.stubGlobal('fetch', fetchMock);

    const res = await repairAppBridge();
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not authorised/i);
  });

  it('reports a healthy bridge with nothing fixed', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: true, confirmed: 0, created: 0, failed: 0, defaultPassword: null })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await repairAppBridge();
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/already linked/i);
  });
});
