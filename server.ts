import 'dotenv/config';
import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  /* ------------------------------------------------------------------ *
   * OAuth 2.0 (Authorization Code + PKCE) token exchange.
   * Client secrets live only here (server env), never in the browser.
   * ------------------------------------------------------------------ */
  const OAUTH_CONFIG = {
    google: {
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: () => process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    },
    meta: {
      tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
      clientId: () => process.env.VITE_META_APP_ID || process.env.META_APP_ID,
      clientSecret: () => process.env.META_APP_SECRET,
    },
  } as const;

  app.post('/api/oauth/token', async (req, res) => {
    const { provider, code, codeVerifier, redirectUri } = req.body || {};
    const cfg = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG];
    if (!cfg) return res.status(400).json({ error: 'Unknown provider' });
    const clientId = cfg.clientId();
    const clientSecret = cfg.clientSecret();
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: `${provider} OAuth is not configured on the server` });
    }

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      const response = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      res.json(data);
    } catch (error) {
      console.error('OAuth token exchange error:', error);
      res.status(500).json({ error: 'Token exchange failed' });
    }
  });

  app.post('/api/oauth/refresh', async (req, res) => {
    const { provider, refreshToken } = req.body || {};
    const cfg = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG];
    if (!cfg) return res.status(400).json({ error: 'Unknown provider' });
    const clientId = cfg.clientId();
    const clientSecret = cfg.clientSecret();
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: `${provider} OAuth is not configured on the server` });
    }

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });
      const response = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json(data);
      res.json(data);
    } catch (error) {
      console.error('OAuth refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  /* ------------------------------------------------------------------ *
   * Business insights proxy. The browser sends its access token; we call
   * the provider API so it is never exposed to third-party scripts.
   * ------------------------------------------------------------------ */
  app.post('/api/business/insights', async (req, res) => {
    const { provider, accessToken, path: apiPath, params = {} } = req.body || {};
    if (!accessToken) return res.status(401).json({ error: 'not_connected' });

    const authHeader = { Authorization: `Bearer ${accessToken}` };

    try {
      if (provider === 'meta') {
        const url = new URL(`https://graph.facebook.com/v21.0/${apiPath}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const response = await fetch(url.toString(), { headers: authHeader });
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      if (provider === 'google') {
        if (apiPath === 'accounts') {
          const response = await fetch(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            { headers: authHeader }
          );
          const data = await response.json();
          if (!response.ok) return res.status(response.status).json(data);

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
          return res.json(data);
        }

        if (apiPath === 'performance') {
          const location = params.location;
          if (!location) return res.status(400).json({ error: 'no_location' });

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
          if (!response.ok) return res.status(response.status).json(data);

          const sums: Record<string, number> = {};
          for (const series of data?.multiDailyMetricTimeSeries || []) {
            for (const m of series.dailyMetricTimeSeries || []) {
              const total = (m.timeSeries?.datedValues || []).reduce(
                (acc: number, dv: any) => acc + Number(dv.value || 0),
                0
              );
              sums[m.dailyMetric] = (sums[m.dailyMetric] || 0) + total;
            }
          }
          const search =
            (sums.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (sums.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);
          const maps =
            (sums.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (sums.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0);
          return res.json({
            metrics: {
              profileViews: search + maps,
              websiteClicks: sums.WEBSITE_CLICKS,
              directionRequests: sums.BUSINESS_DIRECTION_REQUESTS,
              calls: sums.CALL_CLICKS,
              searchViews: search,
              mapsViews: maps,
            },
          });
        }

        return res.status(400).json({ error: 'Unknown google path' });
      }

      res.status(400).json({ error: 'Unknown provider' });
    } catch (error) {
      console.error('Business insights proxy error:', error);
      res.status(500).json({ error: 'Upstream request failed' });
    }
  });

  /* ------------------------------------------------------------------ *
   * OneSignal push. The REST API key is server-only; the browser sends the
   * target user/tag and we dispatch server-to-server so pushes arrive even
   * when the app is closed.
   * ------------------------------------------------------------------ */
  const ONESIGNAL_APP_ID = () => process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_KEY = () => process.env.ONESIGNAL_REST_API_KEY;

  app.get('/api/onesignal/config', (_req, res) => {
    res.json({
      appId: ONESIGNAL_APP_ID() || null,
      safariWebId: process.env.ONESIGNAL_SAFARI_WEB_ID || null,
      serverPush: Boolean(ONESIGNAL_APP_ID() && ONESIGNAL_REST_KEY()),
    });
  });

  app.post('/api/onesignal/notify', async (req, res) => {
    const { title, body, externalUserId, subscriptionId, url, tagFilter } = req.body || {};
    const appId = ONESIGNAL_APP_ID();
    const restKey = ONESIGNAL_REST_KEY();
    if (!appId || !restKey) {
      return res.status(500).json({ error: 'OneSignal server push is not configured' });
    }

    try {
      const payload: Record<string, any> = {
        app_id: appId,
        headings: { en: title || 'Stakey’s Cycles' },
        contents: { en: body || '' },
        ...(url ? { url } : {}),
      };
      if (subscriptionId) {
        payload.include_subscription_ids = [subscriptionId];
      } else if (externalUserId) {
        payload.include_aliases = { external_id: [externalUserId] };
        payload.target_channel = 'push';
      } else if (tagFilter?.key && tagFilter?.value != null) {
        payload.filters = [
          { field: 'tag', key: tagFilter.key, relation: '=', value: String(tagFilter.value) },
        ];
      } else {
        payload.included_segments = ['Subscribed Users'];
      }

      const response = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${restKey}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('OneSignal push error:', error);
      res.status(500).json({ error: 'Push dispatch failed' });
    }
  });

  // Legacy Google Business proxy retained for the existing Business tab.
  app.get('/api/google-business', async (req, res) => {
    const apiKey = process.env.GOOGLE_BUSINESS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key not configured' });
    try {
      const response = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts?alt=json&key=${apiKey}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      res.json(await response.json());
    } catch (error) {
      console.error('Proxy Error:', error);
      res.status(500).json({ error: 'Failed to fetch business data' });
    }
  });

  // Vite dev middleware is registered LAST so the /api/* routes above take
  // precedence over the SPA history fallback.
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startServer();
