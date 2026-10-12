import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchAuthHealth } from './authHealth';
import { SUPABASE_URL } from '../lib/supabase';

/** Minimal Response stand-in for the two endpoints we call. */
function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchAuthHealth', () => {
  it('prefers the server endpoint when it is deployed and healthy', async () => {
    const serverBody = {
      reachable: true,
      signupsEnabled: true,
      emailAuthEnabled: true,
      mailerAutoconfirm: true,
      needsEmailConfirmation: false,
      hasServiceRole: true,
      adminConfigured: true,
      needsAttention: false,
    };
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toBe('/api/auth/health');
      return jsonResponse(serverBody);
    });
    vi.stubGlobal('fetch', fetchMock);

    const health = await fetchAuthHealth();
    expect(health).toEqual(serverBody);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Supabase settings when the endpoint is not deployed (404)', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('/api/auth/health')) return jsonResponse({}, false);
      return jsonResponse({ external: { email: true }, mailer_autoconfirm: false, disable_signup: false });
    });
    vi.stubGlobal('fetch', fetchMock);

    const health = await fetchAuthHealth();
    expect(calls[0]).toContain('/api/auth/health');
    expect(calls[1]).toBe(`${SUPABASE_URL}/auth/v1/settings`);
    // email on + autoconfirm off = a blocker that makes every login fail.
    expect(health?.reachable).toBe(true);
    expect(health?.needsEmailConfirmation).toBe(true);
    expect(health?.needsAttention).toBe(true);
  });

  it('reports no attention needed when autoconfirm is on, via the direct probe', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/health')) throw new Error('offline');
      return jsonResponse({ external: { email: true }, mailer_autoconfirm: true, disable_signup: false });
    });
    vi.stubGlobal('fetch', fetchMock);

    const health = await fetchAuthHealth();
    expect(health?.needsAttention).toBe(false);
    expect(health?.mailerAutoconfirm).toBe(true);
  });

  it('returns null when neither source is reachable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchAuthHealth()).toBeNull();
  });
});
