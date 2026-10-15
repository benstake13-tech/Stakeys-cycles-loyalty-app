import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_TESTS } from './src/utils/featureDiagnostics';

const test = FEATURE_TESTS.find((item) => item.id === 'push-server-dispatch')!;

afterEach(() => vi.unstubAllGlobals());

describe('OneSignal notification endpoint diagnostic', () => {
  it('checks the POST-only route with GET and never creates a notification', async () => {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => ({
      status: 405,
      ok: false,
      headers: { get: (name: string) => name.toLowerCase() === 'allow' ? 'POST' : null },
      json: async () => ({ error: 'Method not allowed' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await test.run();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'GET' });
    expect(result.status).toBe('pass');
    expect(result.detail).toMatch(/no notification was sent/i);
  });
});
