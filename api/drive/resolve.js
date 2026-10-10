/**
 * Vercel serverless function — resolve a Google Drive share link.
 *
 * Mirrors server.ts `/api/drive/resolve`. Turns any pasted Drive link into a
 * direct-renderable URL so staff can paste a link instead of hunting for the
 * file id. Needs no API key (pure string parsing).
 */
import { resolveDriveLink } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const resolved = resolveDriveLink(req.query.url);
    return res.status(200).json(resolved);
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'No Drive file id found in that link' });
  }
}
