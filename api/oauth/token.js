/**
 * Vercel serverless function — OAuth 2.0 (Authorization Code + PKCE) token
 * exchange.
 *
 * Mirrors server.ts `/api/oauth/token` for the production (static Vercel)
 * deployment, so the deployed site's Growth tab can authorise Google / Meta.
 * The client secret is server-only and never reaches the browser.
 */
import { resolveProvider, exchangeToken } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    return res.status(200).json(data);
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}
