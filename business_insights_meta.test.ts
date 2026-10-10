import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetaInsights } from './src/utils/businessInsights';

/**
 * Meta Page insights regressions:
 *  - Graph rejects a user token for /{page}/insights (#190) — the Page token
 *    returned by me/accounts must be used instead.
 *  - Several legacy metrics (page_impressions, page_engaged_users,
 *    page_fan_adds) were retired and fail the whole call with #100.
 */
vi.mock('./src/utils/oauthService', () => ({
  getValidAccessToken: vi.fn(async () => 'USER_TOKEN'),
}));

const PAGE_TOKEN = 'PAGE_TOKEN_123';

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  vi.restoreAllMocks();
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
});
