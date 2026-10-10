/**
 * Vercel serverless function — Google Drive catalogue (dispatched by action).
 *
 * One function serves `/api/drive/*` (list / resolve) so the deployment stays
 * within the Vercel Serverless Function budget (Hobby allows 12 per deployment;
 * each file under `api/` counts as one). The action is the dynamic path segment
 * (`/api/drive/list` → `req.query.action === 'list'`), so client URLs are
 * unchanged. The Drive API key stays server-side.
 */
import { resolveDriveKey, listDriveFolder, resolveDriveLink } from './_shared.js';

async function driveList(req, res) {
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

function driveResolve(req, res) {
  try {
    return res.status(200).json(resolveDriveLink(req.query.url));
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'No Drive file id found in that link' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const action = String(req.query.action || '');
  if (action === 'list') return driveList(req, res);
  if (action === 'resolve') return driveResolve(req, res);
  return res.status(404).json({ error: 'Unknown drive action' });
}
