import { googleShared } from './_googleShared.js';
import { googleInsights } from './_google.js';
/**
 * Vercel serverless function — business metrics (dispatched by action).
 *
 * One function serves `/api/business/*` (insights / status) to stay within the
 * Vercel Serverless Function budget (Hobby allows 12 per deployment). The action
 * is the dynamic path segment (`/api/business/insights` →
 * `req.query.action === 'insights'`), so client URLs are unchanged.
 *
 * - `status`: reports which providers can be read from a server-held credential
 *   (currently Meta via `META_SYSTEM_USER_TOKEN`) without a browser OAuth login.
 * - `insights`: proxies provider metric APIs server-to-server, so the browser's
 *   access token is never exposed to third-party scripts. Provider errors
 *   (including the Graph `{ error: { … } }` envelope) pass through with their
 *   upstream status so the UI can show a reason.
 */

const GRAPH_VERSION = 'v21.0';

function businessStatus(_req, res) {
  return res.status(200).json({
    meta: { serverManaged: Boolean(process.env.META_SYSTEM_USER_TOKEN) },
  });
}

/**
 * Resolves the Meta credential: the browser-supplied token when present, else
 * the server-managed `META_SYSTEM_USER_TOKEN`. The latter lets the Growth tab
 * read Page insights with no Facebook login — the credential never reaches the
 * browser.
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

async function businessInsights(req, res) {
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

export default async function handler(req, res) {
  const action = String(req.query.action || '');
  if (action === 'google-shared') return googleShared(req, res);
  if (action === 'status') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return businessStatus(req, res);
  }
  if (action === 'insights') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return businessInsights(req, res);
  }
  return res.status(404).json({ error: 'Unknown business action' });
}
