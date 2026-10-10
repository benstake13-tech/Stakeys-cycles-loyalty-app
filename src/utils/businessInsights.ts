import { OAuthProvider, getValidAccessToken } from './oauthService';
import {
  MetaPoint,
  buildMetaTimeline,
  META_DAILY_METRICS,
} from './performanceInsights';

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

/** Pulls a readable message out of a provider error body (Graph `{error:{…}}`, plain string, …). */
function errorMessage(data: any, fallback: string): string {
  const e = data?.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') return e.message || e.error_user_msg || e.type || fallback;
  if (typeof e === 'number') return fallback;
  return fallback;
}

/** Providers whose credential may live on the server (no browser OAuth needed). */
const SERVER_MANAGED: Partial<Record<OAuthProvider, boolean>> = {};

/** Probes the server for provider credentials it holds (e.g. META_SYSTEM_USER_TOKEN). */
export async function refreshServerManaged(): Promise<void> {
  try {
    const res = await fetch('/api/business/status');
    if (!res.ok) return;
    const data = await res.json();
    SERVER_MANAGED.meta = Boolean(data?.meta?.serverManaged);
  } catch {
    // Non-fatal: the popup flow still works when the probe fails.
  }
}

export function isServerManaged(provider: OAuthProvider): boolean {
  return Boolean(SERVER_MANAGED[provider]);
}

/**
 * Calls our server-side proxy which attaches the bearer token to provider APIs.
 * When the provider is server-managed the token is omitted and the server uses
 * its own credential.
 */
async function proxyFetch(
  provider: OAuthProvider,
  path: string,
  params: Record<string, string> = {},
  overrideToken?: string | null
) {
  // Meta Page insights reject a user token (#190 "must be called with a Page
  // Access Token"), so callers pass the Page token resolved from `me/accounts`.
  // When a server credential exists (Meta via META_SYSTEM_USER_TOKEN) prefer it
  // and ignore any stale browser token, so the panel just shows results.
  let token: string | null | undefined = overrideToken;
  if (!token) {
    token = isServerManaged(provider) ? null : await getValidAccessToken(provider);
  }
  if (!token && !isServerManaged(provider)) {
    return { ok: false, data: null as any, error: 'not_connected' };
  }

  const res = await fetch('/api/business/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, accessToken: token, path, params }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Surface the Graph `{ error: … }` envelope (or proxy error) verbatim so the
    // UI can show e.g. "no Page linked", "missing read_insights scope", "token expired".
    return { ok: false, data, error: errorMessage(data, 'request_failed') };
  }
  return { ok: true, data, error: null };
}

/**
 * True when Graph rejected the call because a metric name is invalid/retired.
 * Meta retires Page metrics on a rolling schedule and answers with #100
 * "The value must be a valid insights metric".
 */
function isInvalidMetricError(data: any): boolean {
  const e = data?.error;
  const message = String((e && typeof e === 'object' ? e.message : e) || '').toLowerCase();
  const code = e && typeof e === 'object' ? e.code : undefined;
  return (
    (code === 100 || message.includes('#100')) &&
    (message.includes('valid insights metric') ||
      message.includes('insights metric') ||
      message.includes('invalid metric'))
  );
}

/**
 * Reads Page metric series, surviving Meta's rolling metric retirements.
 *
 * Graph fails the WHOLE batched call with #100 when even one requested metric
 * has been retired, which is why the Growth tab keeps breaking: every time Meta
 * retires a Page metric the single batched request returns nothing. When — and
 * only when — the batch fails that way, we retry each metric on its own and keep
 * the ones this Page/version still serves, so one retired metric can no longer
 * blank out the whole panel. Any other error (auth, rate limit) is returned
 * untouched so the UI can show the real reason.
 */
async function fetchMetaMetricRows(
  pageId: string,
  pageToken: string | undefined,
  period: string
): Promise<{ rows: any[]; ok: boolean; error: string | null }> {
  const metrics = META_DAILY_METRICS.split(',');

  const batched = await proxyFetch('meta', `${pageId}/insights`, { metric: META_DAILY_METRICS, period }, pageToken);
  if (batched.ok && !isInvalidMetricError(batched.data)) {
    return { rows: batched.data?.data || [], ok: true, error: null };
  }
  if (batched.ok || !isInvalidMetricError(batched.data)) {
    return { rows: [], ok: false, error: batched.error };
  }

  const rows: any[] = [];
  const unavailable: string[] = [];
  await Promise.all(
    metrics.map(async (metric) => {
      const one = await proxyFetch('meta', `${pageId}/insights`, { metric, period }, pageToken);
      if (one.ok) rows.push(...(one.data?.data || []));
      else unavailable.push(metric);
    })
  );

  // When some metrics survive, report which ones this Page/version dropped;
  // when none do, keep the original Graph error so the UI shows the real cause.
  if (unavailable.length === metrics.length) {
    return { rows: [], ok: false, error: batched.error };
  }
  return {
    rows,
    ok: true,
    error: unavailable.length ? `${unavailable.join(', ')} no longer supported by this API version` : null,
  };
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
  const pages = await proxyFetch('meta', 'me/accounts', {
    fields: 'id,name,fan_count,followers_count,access_token',
  });
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

  // Insights must be requested with the PAGE token (a user token is rejected
  // with #190). `me/accounts` returns one per Page; fall back to the user token
  // only if Meta omitted it so the request still surfaces a real API error.
  const pageToken: string | undefined = page.access_token;

  // Read the metric series tolerantly: Meta retires Page metrics on a rolling
  // schedule and a single retired name fails the whole batched call with #100.
  const insights = await fetchMetaMetricRows(page.id, pageToken, 'days_28');

  const rows: any[] = insights.rows;
  const byName: Record<string, number> = {};
  rows.forEach((row) => {
    // days_28 metrics return a series; take the most recent bucket. Some rows
    // shape the payload as { value: { value: n } }.
    const last = row?.values?.[row.values.length - 1];
    const value = last?.value ?? last?.value?.value;
    if (typeof value === 'number') byName[row.name] = value;
  });

  return {
    provider: 'meta',
    connected: true,
    live: rows.length > 0,
    accountLabel: page.name || 'Meta Business Page',
    windowLabel: WINDOW_LABEL,
    metrics: [
      { label: 'Media Views', value: fmt(byName.page_media_view), hint: 'Times your Page content was displayed' },
      { label: 'Unique Viewers', value: fmt(byName.page_total_media_view_unique) },
      { label: 'Post Engagements', value: fmt(byName.page_post_engagements) },
      { label: 'Page Views', value: fmt(byName.page_views_total) },
      { label: 'Video Views', value: fmt(byName.page_video_views) },
      { label: 'Followers', value: fmt(byName.page_follows ?? page.followers_count ?? page.fan_count), hint: 'Total Page followers' },
    ],
    message: rows.length
      ? insights.error || undefined
      : insights.ok
        ? insights.error || 'Connected, but Meta returned no insights for this Page.'
        : `Connected, but Meta rejected the insights request${insights.error ? ` (${insights.error})` : ''}.`,
  };
}

export interface MetaTimelineResult {
  connected: boolean;
  live: boolean;
  pageName?: string;
  pageId?: string;
  followers?: number;
  igUsername?: string;
  igFollowers?: number;
  igMediaCount?: number;
  timeline: MetaPoint[];
  message?: string;
}

/**
 * Detailed Meta series for the Business Stats charts: per-day Facebook Page
 * metrics aligned onto one timeline, plus the linked Instagram account's
 * follower/media counts. Falls back to the server-managed token when the browser
 * has none (mirrors `fetchMetaInsights`).
 */
export async function fetchMetaTimeline(): Promise<MetaTimelineResult> {
  const empty: MetaTimelineResult = { connected: false, live: false, timeline: [] };

  const pages = await proxyFetch('meta', 'me/accounts', {
    fields: 'id,name,fan_count,followers_count,access_token,instagram_business_account{id,username}',
  });
  if (!pages.ok) {
    return { ...empty, message: pages.error === 'not_connected' ? 'Not connected' : 'Meta API unavailable' };
  }

  const page = (pages.data?.data || [])[0];
  if (!page) return { ...empty, connected: true, message: 'No Facebook Page is linked to this account.' };

  const pageToken: string | undefined = page.access_token;

  const daily = await fetchMetaMetricRows(page.id, pageToken, 'day');
  const timeline = daily.ok ? buildMetaTimeline(daily.rows) : [];

  // Instagram counts come from the linked business account; ignore failures so
  // the Facebook charts still render if IG is not reachable.
  let igUsername: string | undefined;
  let igFollowers: number | undefined;
  let igMediaCount: number | undefined;
  const igId = page.instagram_business_account?.id;
  if (igId) {
    const ig = await proxyFetch(
      'meta',
      igId,
      { fields: 'username,followers_count,media_count' },
      pageToken
    );
    if (ig.ok) {
      igUsername = ig.data?.username;
      igFollowers = ig.data?.followers_count;
      igMediaCount = ig.data?.media_count;
    }
  }

  return {
    connected: true,
    live: timeline.length > 0,
    pageName: page.name,
    pageId: page.id,
    followers: page.followers_count ?? page.fan_count,
    igUsername,
    igFollowers,
    igMediaCount,
    timeline,
    message: timeline.length ? undefined : 'Connected, but Meta returned no daily insights for this Page.',
  };
}

function offline(provider: OAuthProvider, accountLabel: string, error?: string | null): BusinessInsights {
  // Meta is read with a server-side credential (META_SYSTEM_USER_TOKEN), so it
  // never asks the user to link an account — it either returns results or states
  // that the server token is missing. Google still uses the OAuth popup.
  const notConnectedMessage =
    provider === 'meta'
      ? 'Meta results aren’t available yet — the server-side Meta token isn’t set.'
      : 'Authorise with the provider to load live performance data.';
  return {
    provider,
    connected: false,
    live: false,
    accountLabel,
    windowLabel: WINDOW_LABEL,
    metrics: [],
    message:
      error === 'not_connected'
        ? notConnectedMessage
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
