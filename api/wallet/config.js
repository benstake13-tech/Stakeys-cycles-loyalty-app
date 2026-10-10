/**
 * Vercel serverless function — Wallet pass availability.
 *
 * Reports, per provider, whether Apple Wallet and/or Google Wallet are
 * configured on this deployment. The client uses this to show or hide the "Add
 * to Wallet" buttons, so an unconfigured deployment never shows a dead control.
 * No secrets are returned — only booleans and non-secret public identifiers.
 */
import { resolveWalletConfig } from './_shared.js';

export default function handler(_req, res) {
  const cfg = resolveWalletConfig();
  res.status(200).json({
    apple: { configured: cfg.apple.configured, passTypeId: cfg.apple.passTypeId },
    google: { configured: cfg.google.configured, issuerId: cfg.google.issuerId },
  });
}
