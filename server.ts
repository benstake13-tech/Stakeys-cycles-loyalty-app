import 'dotenv/config';
import express from 'express';
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  resolveManagedPage,
  publishToPage,
  publishToInstagram,
  fetchPagePosts,
} from './api/meta/_shared.js';
import { resolveWalletConfig, buildGoogleWalletSaveUrl } from './api/wallet/_shared.js';

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

function resolveOAuth(provider: string) {
  const cfg = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG];
  if (!cfg) return { error: { status: 400, body: { error: 'Unknown provider' } } };
  const clientId = cfg.clientId();
  const clientSecret = cfg.clientSecret();
  if (!clientId || !clientSecret) {
    return { error: { status: 500, body: { error: `${provider} OAuth is not configured on the server` } } };
  }
  return { cfg, clientId, clientSecret };
}

/**
 * Meta has no refresh-token grant; swap a short-lived token for a ~60-day
 * long-lived one via `fb_exchange_token`. Best-effort (null on failure).
 */
async function exchangeMetaLongLived(clientId: string, clientSecret: string, shortToken: string) {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('fb_exchange_token', shortToken);
  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    if (!response.ok || !data?.access_token) return null;
    return data;
  } catch {
    return null;
  }
}

  app.post('/api/oauth/token', async (req, res) => {
    const { provider, code, codeVerifier, redirectUri } = req.body || {};
    const resolved = resolveOAuth(provider);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);
    const { cfg, clientId, clientSecret } = resolved;

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

      if (provider === 'meta' && data?.access_token) {
        const longLived = await exchangeMetaLongLived(clientId, clientSecret, data.access_token);
        if (longLived) return res.json(longLived);
      }
      res.json(data);
    } catch (error) {
      console.error('OAuth token exchange error:', error);
      res.status(500).json({ error: 'Token exchange failed' });
    }
  });

  app.post('/api/oauth/refresh', async (req, res) => {
    const { provider, refreshToken } = req.body || {};
    const resolved = resolveOAuth(provider);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);
    const { cfg, clientId, clientSecret } = resolved;

    try {
      if (provider === 'meta') {
        const longLived = await exchangeMetaLongLived(clientId, clientSecret, refreshToken);
        if (!longLived) return res.status(400).json({ error: 'Token refresh failed' });
        return res.json(longLived);
      }

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

    // Meta can run from the server-managed system-user token, so a missing browser
    // token only means "not connected" for providers without a server credential.
    const token =
      provider === 'meta' ? (accessToken || process.env.META_SYSTEM_USER_TOKEN || null) : accessToken;
    if (!token) return res.status(401).json({ error: 'not_connected' });

    const authHeader = { Authorization: `Bearer ${token}` };

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

  /**
   * Which providers can be read without a browser token because the server
   * holds a credential (Meta via META_SYSTEM_USER_TOKEN). Returns a boolean
   * only — never the token.
   */
  app.get('/api/business/status', (_req, res) => {
    res.json({ meta: { serverManaged: Boolean(process.env.META_SYSTEM_USER_TOKEN) } });
  });

  /* ------------------------------------------------------------------ *
   * Meta publishing. Reads AND writes use the server-managed system-user
   * token; the Page token is resolved server-side and never sent to the
   * browser. Mirrors api/meta/*.js for the static Vercel deployment.
   * ------------------------------------------------------------------ */
  app.post('/api/meta/publish', async (req, res) => {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) return res.status(401).json({ error: 'not_configured' });

    const { target, message, imageUrl, pageId } = req.body || {};
    if (!target || !['facebook', 'instagram'].includes(target)) {
      return res.status(400).json({ error: 'target must be facebook or instagram' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    try {
      const resolved = await resolveManagedPage(token, pageId);
      if (resolved.error) return res.status(resolved.error.status).json(resolved.error.data);
      const { page, igId } = resolved;

      if (target === 'instagram') {
        if (!igId) return res.status(404).json({ error: 'No Instagram account is linked to the Page' });
        const result = await publishToInstagram(igId, page.access_token, message, imageUrl);
        if (result.error) return res.status(result.error.status).json(result.error.data);
        return res.json({ id: result.id, target: 'instagram' });
      }

      const result = await publishToPage(page.access_token, page.id, message, imageUrl);
      if (result.error) return res.status(result.error.status).json(result.error.data);
      return res.json({ id: result.id, target: 'facebook' });
    } catch (error) {
      console.error('Meta publish error:', error);
      res.status(500).json({ error: 'Publish failed' });
    }
  });

  app.get('/api/meta/posts', async (req, res) => {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) return res.json({ posts: [] });
    try {
      const resolved = await resolveManagedPage(token, req.query?.pageId);
      if (resolved.error) return res.status(resolved.error.status).json(resolved.error.data);
      const result = await fetchPagePosts(resolved.page.access_token, resolved.page.id);
      if (result.error) return res.status(result.error.status).json(result.error.data);
      res.json({ posts: result.posts, page: { id: resolved.page.id, name: resolved.page.name } });
    } catch (error) {
      console.error('Meta posts error:', error);
      res.json({ posts: [] });
    }
  });

  /* ------------------------------------------------------------------ *
   * OneSignal web push. The REST API key is server-only; the browser sends
   * the target (profile, email subscription or tag segment) and we dispatch
   * server-to-server so pushes arrive even when the app is closed.
   * ------------------------------------------------------------------ */
  const REST_KEY_ENV_NAMES = ['ONESIGNAL_REST_API_KEY', 'ONESIGNAL_API_KEY', 'VITE_ONESIGNAL_REST_API_KEY'];
  const ONESIGNAL_APP_ID = () => process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
  const resolveRestKey = (): { key: string | null; source: string | null } => {
    for (const name of REST_KEY_ENV_NAMES) {
      const raw = process.env[name];
      if (typeof raw === 'string' && raw.trim()) {
        return { key: raw.trim().replace(/^["']|["']$/g, ''), source: name };
      }
    }
    return { key: null, source: null };
  };

  app.get('/api/onesignal/config', (_req, res) => {
    const { key, source } = resolveRestKey();
    res.json({
      appId: ONESIGNAL_APP_ID() || null,
      serverPush: Boolean(ONESIGNAL_APP_ID() && key),
      restKeyEnv: source,
      restKeyEnvNames: REST_KEY_ENV_NAMES,
    });
  });

  /* ------------------------------------------------------------------ *
   * Wallet passes (dev mirror of the Vercel functions). Reports whether
   * Apple/Google Wallet are configured; the Google endpoint returns a signed
   * "Save to Google Wallet" URL. Signing secrets stay server-side.
   * ------------------------------------------------------------------ */
  app.get('/api/wallet/config', (_req, res) => {
    const cfg = resolveWalletConfig();
    res.json({
      apple: { configured: cfg.apple.configured, passTypeId: cfg.apple.passTypeId },
      google: { configured: cfg.google.configured, issuerId: cfg.google.issuerId },
    });
  });

  app.post('/api/wallet/google', (req, res) => {
    const cfg = resolveWalletConfig();
    if (!cfg.google.configured) {
      res.status(503).json({ error: 'Google Wallet is not configured on this deployment.' });
      return;
    }
    try {
      const member = (req.body && req.body.member) || {};
      res.json({ url: buildGoogleWalletSaveUrl(member) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not build the Google Wallet pass.' });
    }
  });


  app.post('/api/onesignal/notify', async (req, res) => {
    const { title, body, url, externalUserId, email, segment, tag } = req.body || {};
    const appId = ONESIGNAL_APP_ID();
    const { key: apiKey } = resolveRestKey();
    if (!appId || !apiKey) {
      return res.status(500).json({ error: 'OneSignal server push is not configured' });
    }

    // OneSignal allows exactly one targeting method per message. The
    // click-through origin follows the request unless APP_ORIGIN overrides it.
    const origin =
      process.env.APP_ORIGIN ||
      `${req.headers['x-forwarded-proto'] || req.protocol || 'https'}://${req.headers['x-forwarded-host'] || req.get('host')}`;
    const message: Record<string, any> = {
      app_id: appId,
      headings: { en: title || 'Stakey’s Cycles' },
      contents: { en: body || '' },
      url: url || origin,
    };
    if (externalUserId) {
      // Target a signed-in profile's push subscriptions.
      message.include_aliases = { external_id: [String(externalUserId)] };
      message.target_channel = 'push';
    } else if (tag?.key && tag?.value) {
      // e.g. every device tagged with owner_email = the workshop Gmail.
      // `relation` is required by OneSignal; without it the filter is accepted
      // but matches nobody (delivered to 0 devices).
      message.filters = [{ field: 'tag', key: String(tag.key), relation: '=', value: String(tag.value) }];
    } else if (email) {
      // Email channel subscription (requires the Email channel to be set up).
      message.include_email_tokens = [String(email)];
      message.target_channel = 'email';
    } else {
      message.included_segments = [String(segment || 'Subscribed Users')];
    }

    try {
      const upstream = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      const data = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json(data);
    } catch (error: any) {
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

  /* ------------------------------------------------------------------ *
   * Google Drive image catalogue.
   *
   * Staff keep product / gallery / advert images in public Drive folders.
   * Listing a folder needs an API key; serving the bytes does not. This
   * proxy keeps the key server-side and normalises Drive's response so the
   * client only ever sees {id, name, thumbnailUrl, directUrl, mimeType}.
   *
   * Requires a public folder and a key with the Drive API enabled:
   *   GOOGLE_DRIVE_API_KEY (falls back to GOOGLE_BUSINESS_API_KEY)
   * ------------------------------------------------------------------ */
  const driveKey = () =>
    process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_BUSINESS_API_KEY;

  const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
  const DRIVE_IMAGE_MIMES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif',
  ];

  const driveThumbnail = (id: string, size: number) =>
    `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;

  app.get('/api/drive/list', async (req, res) => {
    const key = driveKey();
    if (!key) {
      return res.status(500).json({ error: 'Google Drive API key not configured' });
    }
    const folderId = String(req.query.folderId || '').trim();
    if (!folderId) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    try {
      // Page through the folder so a big stock folder is fully returned.
      const files: any[] = [];
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `'${folderId}' in parents and trashed = false`,
          key,
          fields: 'nextPageToken, files(id, name, mimeType, imageMediaMetadata(width, height))',
          pageSize: '1000',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
        const data = await response.json();
        if (!response.ok) {
          return res.status(response.status).json({ error: data?.error?.message || 'Drive list failed' });
        }
        files.push(...(data.files || []));
        pageToken = data.nextPageToken;
      } while (pageToken);

      const images = files
        .filter((f) => f.mimeType !== DRIVE_FOLDER_MIME && DRIVE_IMAGE_MIMES.includes(f.mimeType))
        .map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          width: f.imageMediaMetadata?.width,
          height: f.imageMediaMetadata?.height,
          thumbnailUrl: driveThumbnail(f.id, 400),
          directUrl: driveThumbnail(f.id, 1600),
        }));

      // Sub-folders, so the picker can drill into "Bikes / Parts / ...".
      const folders = files
        .filter((f) => f.mimeType === DRIVE_FOLDER_MIME)
        .map((f) => ({ id: f.id, name: f.name }));

      res.json({ folderId, images, folders });
    } catch (error) {
      console.error('Drive list error:', error);
      res.status(500).json({ error: 'Failed to list Drive folder' });
    }
  });

  // Turn any Drive share link into a direct-renderable URL, so staff can paste
  // a link instead of hunting for the file id.
  app.get('/api/drive/resolve', (req, res) => {
    const url = String(req.query.url || '');
    const match =
      url.match(/\/file\/d\/([-\w]{10,})/) ||
      url.match(/[?&]id=([-\w]{10,})/) ||
      url.match(/\/folders\/([-\w]{10,})/);
    if (!match) {
      return res.status(400).json({ error: 'No Drive file id found in that link' });
    }
    const id = match[1];
    res.json({ id, directUrl: driveThumbnail(id, 1600), thumbnailUrl: driveThumbnail(id, 400) });
  });

  // Static surface previews (website / staff / customer) built with
  // VITE_SURFACE + a /preview/<surface>/ base, so all three can be reviewed
  // side by side from this single dev port.
  app.use('/preview', express.static(path.join(__dirname, 'preview'), { extensions: ['html'] }));

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
