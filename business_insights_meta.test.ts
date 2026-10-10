import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetaInsights, refreshServerManaged, isServerManaged } from './src/utils/businessInsights';

/**
 * Meta Page insights regressions:
 *  - Graph rejects a user token for /{page}/insights (#190) — the Page token
 *    returned by me/accounts must be used instead.
 *  - Several legacy metrics (page_impressions, page_engaged_users,
 *    page_fan_adds) were retired and fail the whole call with #100.
 *  - The server can read Meta with its own META_SYSTEM_USER_TOKEN, so the tab
 *    works with no browser token at all.
 */
const h = vi.hoisted(() => ({ userToken: 'USER_TOKEN' as string | null }));

vi.mock('./src/utils/oauthService', () => ({
  getValidAccessToken: vi.fn(async () => h.userToken),
}));

const PAGE_TOKEN = 'PAGE_TOKEN_123';

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  h.userToken = 'USER_TOKEN';
  // Reset the module-level server-managed cache so tests don't leak into each other.
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ meta: { serverManaged: false } })));
  await refreshServerManaged();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchMetaInsights', () => {
  it('requests insights with the Page token and only supported metrics', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        calls.push({ url: String(url), body });
        if (body.path === 'me/accounts') {
          return jsonResponse({
            data: [{ id: 'p1', name: 'Stakeys', fan_count: 121, followers_count: 121, access_token: PAGE_TOKEN }],
          });
        }
        return jsonResponse({
          data: [
            { name: 'page_media_view', values: [{ value: 100 }, { value: 292 }] },
            { name: 'page_total_media_view_unique', values: [{ value: 25 }] },
            { name: 'page_post_engagements', values: [{ value: 1 }] },
            { name: 'page_follows', values: [{ value: 120 }, { value: 121 }] },
            { name: 'page_views_total', values: [{ value: 24 }] },
            { name: 'page_video_views', values: [{ value: 2 }] },
          ],
        });
      })
    );

    const result = await fetchMetaInsights();

    const accounts = calls.find((c) => c.body.path === 'me/accounts')!;
    expect(accounts.body.params.fields).toContain('access_token');

    const insights = calls.find((c) => String(c.body.path).endsWith('/insights'))!;
    expect(insights.body.path).toBe('p1/insights');
    // Page token, not the user token.
    expect(insights.body.accessToken).toBe(PAGE_TOKEN);
    const metric = insights.body.params.metric as string;
    expect(metric).not.toContain('page_impressions');
    expect(metric).not.toContain('page_engaged_users');
    expect(metric).not.toContain('page_fan_adds');
    expect(metric).toContain('page_media_view');

    // Most recent bucket in each series is used.
    const byLabel = Object.fromEntries(result.metrics.map((m) => [m.label, m.value]));
    expect(byLabel['Media Views']).toBe('292');
    expect(byLabel['Followers']).toBe('121');
    expect(result.live).toBe(true);
    expect(result.accountLabel).toBe('Stakeys');
  });

  it('falls back to fan_count for Followers when the insights metric is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (body.path === 'me/accounts') {
          return jsonResponse({ data: [{ id: 'p1', name: 'Stakeys', fan_count: 77, access_token: PAGE_TOKEN }] });
        }
        return jsonResponse({ data: [] });
      })
    );

    const result = await fetchMetaInsights();
    const followers = result.metrics.find((m) => m.label === 'Followers')!;
    expect(followers.value).toBe('77');
    expect(result.live).toBe(false);
    expect(result.message).toMatch(/no insights/i);
  });

  it('reports a clear message when Meta rejects the insights request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (body.path === 'me/accounts') {
          return jsonResponse({ data: [{ id: 'p1', name: 'Stakeys', access_token: PAGE_TOKEN }] });
        }
        return jsonResponse({ error: { message: 'The value must be a valid insights metric', code: 100 } }, false, 400);
      })
    );

    const result = await fetchMetaInsights();
    expect(result.live).toBe(false);
    expect(result.message).toMatch(/valid insights metric/i);
  });

  it('recovers when the batched metric list is rejected but most metrics still work', async () => {
    // Meta retires Page metrics on a rolling schedule; a single retired name
    // fails the whole batched call with #100. The fetch must retry per-metric
    // and keep the surviving series instead of blanking the panel.
    const RETIRED = 'page_total_media_view_unique';
    const metricCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (body.path === 'me/accounts') {
          return jsonResponse({ data: [{ id: 'p1', name: 'Stakeys', fan_count: 121, access_token: PAGE_TOKEN }] });
        }
        const metric = String(body.params.metric);
        metricCalls.push(metric);
        // The batched multi-metric request is rejected because one name is retired.
        if (metric.includes(',')) {
          return jsonResponse(
            { error: { message: 'The value must be a valid insights metric', code: 100 } },
            false,
            400
          );
        }
        if (metric === RETIRED) {
          return jsonResponse(
            { error: { message: 'The value must be a valid insights metric', code: 100 } },
            false,
            400
          );
        }
        return jsonResponse({ data: [{ name: metric, values: [{ value: 7 }] }] });
      })
    );

    const result = await fetchMetaInsights();

    expect(result.connected).toBe(true);
    expect(result.live).toBe(true);
    // The batched call was attempted first, then split per-metric.
    expect(metricCalls[0]).toContain(',');
    const byLabel = Object.fromEntries(result.metrics.map((m) => [m.label, m.value]));
    expect(byLabel['Media Views']).toBe('7');
    expect(byLabel['Page Views']).toBe('7');
    // The retired metric renders as an em dash, not a crash or a blank panel.
    expect(byLabel['Unique Viewers']).toBe('—');
    // The surviving data is still reported as live, and the drop is surfaced.
    expect(result.message).toMatch(/no longer supported/i);
  });

  it('does not fan out per-metric on a non-metric error such as an expired token', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        if (body.path === 'me/accounts') {
          return jsonResponse({ data: [{ id: 'p1', name: 'Stakeys', access_token: PAGE_TOKEN }] });
        }
        calls.push(String(body.params.metric));
        return jsonResponse({ error: { message: 'Error validating access token: Session has expired', code: 190 } }, false, 400);
      })
    );

    const result = await fetchMetaInsights();
    expect(result.live).toBe(false);
    // Only the single batched request — no per-metric retry storm.
    expect(calls).toHaveLength(1);
    expect(result.message).toMatch(/expired/i);
  });

  it('loads Meta with the server token when there is no browser token', async () => {
    h.userToken = null;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ meta: { serverManaged: true } })));
    await refreshServerManaged();
    expect(isServerManaged('meta')).toBe(true);

    const calls: Array<{ url: string; body: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        const body = init?.body ? JSON.parse(init.body) : {};
        calls.push({ url: String(url), body });
        if (body.path === 'me/accounts') {
          return jsonResponse({ data: [{ id: 'p1', name: 'Stakeys', fan_count: 121, access_token: PAGE_TOKEN }] });
        }
        return jsonResponse({ data: [{ name: 'page_follows', values: [{ value: 121 }] }] });
      })
    );

    const result = await fetchMetaInsights();
    expect(result.connected).toBe(true);
    expect(result.live).toBe(true);

    // The token is omitted so the server uses META_SYSTEM_USER_TOKEN itself;
    // the Page token still comes from me/accounts and is used for insights.
    const accounts = calls.find((c) => c.body.path === 'me/accounts')!;
    expect(accounts.body.accessToken).toBeNull();
    const insights = calls.find((c) => String(c.body.path).endsWith('/insights'))!;
    expect(insights.body.accessToken).toBe(PAGE_TOKEN);
  });

  it('still reports not connected when neither browser nor server token exists', async () => {
    h.userToken = null;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ meta: { serverManaged: false } })));
    await refreshServerManaged();
    expect(isServerManaged('meta')).toBe(false);

    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchMetaInsights();
    expect(result.connected).toBe(false);
    // Meta never asks the user to link — it reports the server token is missing.
    expect(result.message).toMatch(/server-side Meta token/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
