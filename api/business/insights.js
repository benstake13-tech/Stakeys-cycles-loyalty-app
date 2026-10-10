/**
 * Vercel serverless function — business insights proxy.
 *
 * Mirrors server.ts `/api/business/insights` for the production (static Vercel)
 * deployment. The browser sends its OAuth access token; we call the provider
 * API server-to-server so the token is never exposed to third-party scripts.
 * Provider errors (including the Graph `{ error: { … } }` envelope) are passed
 * straight through with their upstream status so the UI can show a reason.
 */

const GRAPH_VERSION = 'v21.0';

/**
 * Resolves the Meta credential: the browser-supplied token when present, else
 * the server-managed `META_SYSTEM_USER_TOKEN` (a Business Manager system-user
 * token). The latter lets the Growth tab read Page insights with no Facebook
 * login at all — the credential never reaches the browser.
 */
function resolveMetaToken(accessToken) {
  return accessToken || process.env.META_SYSTEM_USER_TOKEN || null;
}

async function metaInsights(apiPath, params, authHeader) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${apiPath}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const response = await fetch(url.toString(), { headers: authHeader });
  const data = await response.json();
  return { status: response.status, data };
}

async function googleInsights(apiPath, params, authHeader) {
  if (apiPath === 'accounts') {
    const response = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: authHeader }
    );
    const data = await response.json();
    if (!response.ok) return { status: response.status, data };

    const accountName = data?.accounts?.[0]?.name;
    if (accountName) {
      try {
        const locResp = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
          { headers: authHeader }
        );
        const locData = await locResp.json();
        data.locations = locData.locations || [];
      } catch {
        data.locations = [];
      }
    }
    return { status: 200, data };
  }

  if (apiPath === 'performance') {
    const location = params.location;
    if (!location) return { status: 400, data: { error: 'no_location' } };

    const end = new Date();
    const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);
    const daily = [
      'CALL_CLICKS',
      'WEBSITE_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    ];
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${location}:fetchMultiDailyMetricsTimeSeries`
    );
    daily.forEach((m) => url.searchParams.append('dailyMetrics', m));
    url.searchParams.set('dailyRange.startDate.year', String(start.getFullYear()));
    url.searchParams.set('dailyRange.startDate.month', String(start.getMonth() + 1));
    url.searchParams.set('dailyRange.startDate.day', String(start.getDate()));
    url.searchParams.set('dailyRange.endDate.year', String(end.getFullYear()));
    url.searchParams.set('dailyRange.endDate.month', String(end.getMonth() + 1));
    url.searchParams.set('dailyRange.endDate.day', String(end.getDate()));

    const response = await fetch(url.toString(), { headers: authHeader });
    const data = await response.json();
    if (!response.ok) return { status: response.status, data };

    const sums = {};
    for (const series of data?.multiDailyMetricTimeSeries || []) {
      for (const m of series.dailyMetricTimeSeries || []) {
        const total = (m.timeSeries?.datedValues || []).reduce(
          (acc, dv) => acc + Number(dv.value || 0),
          0
        );
        sums[m.dailyMetric] = (sums[m.dailyMetric] || 0) + total;
      }
    }
    const search =
      (sums.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (sums.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
    const maps =
      (sums.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (sums.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);
    return {
      status: 200,
      data: {
        metrics: {
          profileViews: search + maps,
          websiteClicks: sums.WEBSITE_CLICKS,
          directionRequests: sums.BUSINESS_DIRECTION_REQUESTS,
          calls: sums.CALL_CLICKS,
          searchViews: search,
          mapsViews: maps,
        },
      },
    };
  }

  return { status: 400, data: { error: 'Unknown google path' } };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, accessToken, path: apiPath, params = {} } = req.body || {};

  // Meta can run from the server-managed system-user token, so a missing browser
  // token only means "not connected" for providers without a server credential.
  const token = provider === 'meta' ? resolveMetaToken(accessToken) : accessToken;
  if (!token) return res.status(401).json({ error: 'not_connected' });
  const authHeader = { Authorization: `Bearer ${token}` };

  try {
    if (provider === 'meta') {
      const { status, data } = await metaInsights(apiPath, params, authHeader);
      return res.status(status).json(data);
    }
    if (provider === 'google') {
      const { status, data } = await googleInsights(apiPath, params, authHeader);
      return res.status(status).json(data);
    }
    return res.status(400).json({ error: 'Unknown provider' });
  } catch (error) {
    console.error('Business insights proxy error:', error);
    return res.status(500).json({ error: 'Upstream request failed' });
  }
}
