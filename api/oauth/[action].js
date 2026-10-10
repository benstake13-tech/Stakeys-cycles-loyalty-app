/**
 * Vercel serverless function — OAuth 2.0 (dispatched by action).
 *
 * One function serves `/api/oauth/*` (token / refresh) to stay within the Vercel
 * Serverless Function budget (Hobby allows 12 per deployment). The action is the
 * dynamic path segment (`/api/oauth/token` → `req.query.action === 'token'`), so
 * client URLs are unchanged. Client secrets are server-only.
 */
import { resolveProvider, exchangeToken, exchangeMetaLongLived } from './_shared.js';

async function oauthToken(req, res) {
  const { provider, code, codeVerifier, redirectUri } = req.body || {};
  const resolved = resolveProvider(provider);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  try {
    const params = new URLSearchParams({
      client_id: resolved.clientId,
      client_secret: resolved.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const { status, ok, data } = await exchangeToken(resolved.cfg.tokenUrl, params);
    if (!ok) return res.status(status).json(data);

    // Meta: upgrade to a ~60-day long-lived token (no refresh grant exists).
    if (provider === 'meta' && data?.access_token) {
      const longLived = await exchangeMetaLongLived(
        resolved.clientId,
        resolved.clientSecret,
        data.access_token
      );
      if (longLived) return res.status(200).json(longLived);
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}

async function oauthRefresh(req, res) {
  const { provider, refreshToken } = req.body || {};
  const resolved = resolveProvider(provider);
  if (resolved.error) return res.status(resolved.error.status).json(resolved.error.body);

  try {
    // Meta has no refresh-token grant: treat the supplied token as short-lived
    // and swap it for a fresh long-lived one.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const action = String(req.query.action || '');
  if (action === 'token') return oauthToken(req, res);
  if (action === 'refresh') return oauthRefresh(req, res);
  return res.status(404).json({ error: 'Unknown oauth action' });
}
