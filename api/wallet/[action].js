/**
 * Vercel serverless function — Wallet passes (dispatched by action).
 *
 * One function serves the whole `/api/wallet/*` family so the deployment stays
 * within the Vercel Serverless Function budget (Hobby allows 12 per deployment;
 * each file under `api/` counts as one). The action is the dynamic path segment
 * (`/api/wallet/config` → `req.query.action === 'config'`), so the client URLs
 * are unchanged. All signing material stays server-side and is never returned.
 */
import { resolveWalletConfig, buildGoogleWalletSaveUrl, buildApplePass } from './_shared.js';

function walletConfig(res) {
  const cfg = resolveWalletConfig();
  return res.status(200).json({
    apple: { configured: cfg.apple.configured, passTypeId: cfg.apple.passTypeId },
    google: { configured: cfg.google.configured, issuerId: cfg.google.issuerId },
  });
}

function walletGoogle(res, member) {
  const cfg = resolveWalletConfig();
  if (!cfg.google.configured) {
    return res.status(503).json({ error: 'Google Wallet is not configured on this deployment.' });
  }
  try {
    return res.status(200).json({ url: buildGoogleWalletSaveUrl(member || {}) });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Could not build the Google Wallet pass.' });
  }
}

async function walletApple(req, res) {
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

export default async function handler(req, res) {
  const action = String(req.query.action || '');
  if (action === 'config') return walletConfig(res);
  if (action === 'google') return walletGoogle(res, (req.body && req.body.member) || {});
  if (action === 'apple') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return walletApple(req, res);
  }
  return res.status(404).json({ error: 'Unknown wallet action' });
}
