/**
 * Vercel serverless function — Apple Wallet `.pkpass`.
 *
 * Signs and returns a loyalty pass for the member named in `?membership=`.
 * The Pass Type ID certificate and key are read from server-only env vars;
 * nothing secret is ever returned to the client. Returns 503 when Apple Wallet
 * is not configured so the client can degrade gracefully (its button is hidden
 * in that case anyway).
 */
import { buildApplePass, resolveWalletConfig } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cfg = resolveWalletConfig();
  if (!cfg.apple.configured) {
    return res.status(503).json({ error: 'Apple Wallet is not configured on this deployment.' });
  }

  const membership = String(req.query.membership || '').trim();
  if (!membership) {
    return res.status(400).json({ error: 'membership is required' });
  }

  try {
    const member = {
      membershipNumber: membership,
      displayName: String(req.query.name || 'Stakeys Member'),
      stamps: Number(req.query.stamps) || 0,
      points: Number(req.query.points) || 0,
    };
    const pass = await buildApplePass(member);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${membership}.pkpass"`);
    return res.status(200).send(pass);
  } catch (err) {
    console.error('Apple Wallet pass error:', err);
    return res.status(500).json({ error: err?.message || 'Could not build the Apple Wallet pass.' });
  }
}
