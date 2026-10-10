/**
 * Vercel serverless function — Google Wallet "Save to Google Wallet" link.
 *
 * Builds a signed loyalty JWT for the signed-in member and returns the save
 * URL. Returns 503 when Google Wallet is not configured, so the client can
 * degrade gracefully. The service-account key is read from server env only.
 */
import { buildGoogleWalletSaveUrl, resolveWalletConfig } from './_shared.js';

export default function handler(req, res) {
  const cfg = resolveWalletConfig();
  if (!cfg.google.configured) {
    res.status(503).json({ error: 'Google Wallet is not configured on this deployment.' });
    return;
  }
  try {
    const member = (req.body && req.body.member) || {};
    const url = buildGoogleWalletSaveUrl(member);
    res.status(200).json({ url });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Could not build the Google Wallet pass.' });
  }
}
