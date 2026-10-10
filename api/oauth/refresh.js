/**
 * Vercel serverless function — OAuth 2.0 refresh-token exchange.
 *
 * Mirrors server.ts `/api/oauth/refresh` for the production (static Vercel)
 * deployment. The client secret is server-only and never reaches the browser.
 */
import { resolveProvider, exchangeToken, exchangeMetaLongLived } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, refreshToken } = req.body || {};
  const resolved = resolveProvider(provider);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  try {
    // Meta has no refresh-token grant. Treat the supplied token as a short-lived
    // token and swap it for a fresh long-lived one; failure falls through to a
    // clear error so the UI can prompt a re-authorise.
    if (provider === 'meta') {
      const longLived = await exchangeMetaLongLived(
        resolved.clientId,
        resolved.clientSecret,
        refreshToken
      );
      if (!longLived) return res.status(400).json({ error: 'Token refresh failed' });
      return res.status(200).json(longLived);
    }

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
