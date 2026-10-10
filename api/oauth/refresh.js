/**
 * Vercel serverless function — OAuth 2.0 refresh-token exchange.
 *
 * Mirrors server.ts `/api/oauth/refresh` for the production (static Vercel)
 * deployment. The client secret is server-only and never reaches the browser.
 */
import { resolveProvider, exchangeToken } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, refreshToken } = req.body || {};
  const resolved = resolveProvider(provider);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  try {
    const params = new URLSearchParams({
      client_id: resolved.clientId,
      client_secret: resolved.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const { status, ok, data } = await exchangeToken(resolved.cfg.tokenUrl, params);
    if (!ok) return res.status(status).json(data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('OAuth refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
}
