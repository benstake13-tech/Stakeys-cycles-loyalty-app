import { OAuthProvider, getValidAccessToken } from './oauthService';

export interface BusinessMetric {
  label: string;
  value: string;
  delta?: number; // percentage change vs previous period
  hint?: string;
}

export interface BusinessInsights {
  provider: OAuthProvider;
  connected: boolean;
  live: boolean; // true when values came from the provider API
  accountLabel?: string;
  windowLabel: string;
  metrics: BusinessMetric[];
  message?: string;
}

const WINDOW_LABEL = 'Last 28 days';

function fmt(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** Calls our server-side proxy which attaches the bearer token to provider APIs. */
async function proxyFetch(provider: OAuthProvider, path: string, params: Record<string, string> = {}) {
  const token = await getValidAccessToken(provider);
  if (!token) return { ok: false, data: null as any, error: 'not_connected' };

  const res = await fetch('/api/business/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, accessToken: token, path, params }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, data, error: data?.error || 'request_failed' };
  return { ok: true, data, error: null };
}

export async function fetchGoogleInsights(): Promise<BusinessInsights> {
  const accounts = await proxyFetch('google', 'accounts');
  if (!accounts.ok) {
    return offline('google', accounts.error === 'not_connected' ? 'Not connected' : 'Google API unavailable', accounts.error);
  }

  const accountList: any[] = accounts.data?.accounts || [];
  const accountLabel = accountList[0]?.accountName || 'Google Business Profile';

  // Business Profile Performance API needs a location; fetch the first one.
  const locationName = accountList[0]?.name
    ? accounts.data?.locations?.[0]?.name
    : undefined;

  const metricsResp = await proxyFetch('google', 'performance', {
    location: locationName || '',
  });

  const live = Boolean(metricsResp.ok && metricsResp.data?.metrics);
  const m = metricsResp.data?.metrics || {};

  return {
    provider: 'google',
    connected: true,
    live,
    accountLabel,
    windowLabel: WINDOW_LABEL,
    metrics: [
      { label: 'Profile Views', value: fmt(m.profileViews), delta: m.profileViewsDelta, hint: 'Searches + Maps views' },
      { label: 'Website Clicks', value: fmt(m.websiteClicks), delta: m.websiteClicksDelta },
      { label: 'Direction Requests', value: fmt(m.directionRequests), delta: m.directionRequestsDelta },
      { label: 'Calls', value: fmt(m.calls), delta: m.callsDelta },
      { label: 'Search Views', value: fmt(m.searchViews), hint: 'Google Search impressions' },
      { label: 'Maps Views', value: fmt(m.mapsViews), hint: 'Google Maps impressions' },
    ].filter((x) => live || x.value !== '—' || !live),
    message: live ? undefined : 'Connected, but no performance rows were returned for this location.',
  };
}

export async function fetchMetaInsights(): Promise<BusinessInsights> {
  const pages = await proxyFetch('meta', 'me/accounts');
  if (!pages.ok) {
    return offline('meta', pages.error === 'not_connected' ? 'Not connected' : 'Meta API unavailable', pages.error);
  }

  const page = (pages.data?.data || [])[0];
  if (!page) {
    return {
      provider: 'meta',
      connected: true,
      live: false,
      windowLabel: WINDOW_LABEL,
      metrics: [],
      message: 'No Facebook Page is linked to this account.',
    };
  }

  const insights = await proxyFetch('meta', `${page.id}/insights`, {
    metric: 'page_impressions,page_engaged_users,page_post_engagements,page_follows',
    period: 'days_28',
  });

  const rows: any[] = insights.data?.data || [];
  const byName: Record<string, number> = {};
  rows.forEach((row) => {
    const value = row?.values?.[0]?.value ?? row?.values?.[0]?.value?.value;
    if (typeof value === 'number') byName[row.name] = value;
  });

  return {
    provider: 'meta',
    connected: true,
    live: rows.length > 0,
    accountLabel: page.name || 'Meta Business Page',
    windowLabel: WINDOW_LABEL,
    metrics: [
      { label: 'Page Impressions', value: fmt(byName.page_impressions), hint: 'Times your Page content was seen' },
      { label: 'Engaged Users', value: fmt(byName.page_engaged_users) },
      { label: 'Post Engagements', value: fmt(byName.page_post_engagements) },
      { label: 'New Follows', value: fmt(byName.page_follows) },
      { label: 'Fans / Likes', value: fmt(page.fan_count), hint: 'Total Page likes' },
    ],
    message: rows.length ? undefined : 'Connected, but Meta returned no insights for this Page.',
  };
}

function offline(provider: OAuthProvider, accountLabel: string, error?: string | null): BusinessInsights {
  return {
    provider,
    connected: false,
    live: false,
    accountLabel,
    windowLabel: WINDOW_LABEL,
    metrics: [],
    message:
      error === 'not_connected'
        ? 'Authorise with the provider to load live performance data.'
        : `Could not reach the ${provider === 'google' ? 'Google' : 'Meta'} API${error ? ` (${error})` : ''}.`,
  };
}

export async function fetchInsights(provider: OAuthProvider): Promise<BusinessInsights> {
  try {
    return provider === 'google' ? await fetchGoogleInsights() : await fetchMetaInsights();
  } catch (err: any) {
    return offline(provider, 'Unavailable', err?.message);
  }
}
