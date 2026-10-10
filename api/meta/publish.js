/**
 * Vercel serverless function — publish a promotion to the Facebook Page and/or
 * the linked Instagram business account.
 *
 * Uses the server-managed `META_SYSTEM_USER_TOKEN`; the browser never sees a
 * Page token. Returns the created post id(s) so the UI can link to them.
 */
import {
  resolveManagedPage,
  publishToPage,
  publishToInstagram,
} from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return res.status(401).json({ error: 'not_configured' });

  const { target, message, imageUrl, pageId } = req.body || {};
  if (!target || !['facebook', 'instagram'].includes(target)) {
    return res.status(400).json({ error: 'target must be facebook or instagram' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const resolved = await resolveManagedPage(token, pageId);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.data);
    }
    const { page, igId } = resolved;

    if (target === 'instagram') {
      if (!igId) return res.status(404).json({ error: 'No Instagram account is linked to the Page' });
      const result = await publishToInstagram(igId, page.access_token, message, imageUrl);
      if (result.error) return res.status(result.error.status).json(result.error.data);
      return res.status(200).json({ id: result.id, target: 'instagram' });
    }

    const result = await publishToPage(page.access_token, page.id, message, imageUrl);
    if (result.error) return res.status(result.error.status).json(result.error.data);
    return res.status(200).json({ id: result.id, target: 'facebook' });
  } catch (error) {
    console.error('Meta publish error:', error);
    return res.status(500).json({ error: 'Publish failed' });
  }
}
