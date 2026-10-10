/**
 * Vercel serverless function — Google Drive folder listing.
 *
 * Mirrors server.ts `/api/drive/list`. Keeps the Drive API key server-side and
 * normalises the response so the client only sees renderable image/folder data.
 */
import { resolveDriveKey, listDriveFolder } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = resolveDriveKey();
  if (!key) {
    return res.status(500).json({ error: 'Google Drive API key not configured' });
  }

  const folderId = String(req.query.folderId || '').trim();
  if (!folderId) {
    return res.status(400).json({ error: 'folderId is required' });
  }

  try {
    const { images, folders } = await listDriveFolder(folderId, key);
    return res.status(200).json({ folderId, images, folders });
  } catch (err) {
    return res.status(err?.status || 500).json({ error: err?.message || 'Failed to list Drive folder' });
  }
}
