/**
 * Vercel serverless function — Meta publishing (dispatched by action).
 *
 * One function serves `/api/meta/*` (posts / publish) to stay within the Vercel
 * Serverless Function budget (Hobby allows 12 per deployment). The action is the
 * dynamic path segment (`/api/meta/publish` → `req.query.action === 'publish'`),
 * so client URLs are unchanged. Publishing uses the server-managed
 * `META_SYSTEM_USER_TOKEN`; the browser never sees a Page token.
 */
import {
  resolveManagedPage,
  fetchPagePosts,
  publishToPage,
  publishToInstagram,
} from './_shared.js';

async function metaPosts(req, res) {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return res.status(200).json({ posts: [] });

  try {
    const resolved = await resolveManagedPage(token, req.query?.pageId);
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.data);

    const result = await fetchPagePosts(resolved.page.access_token, resolved.page.id);
    if (result.error) return res.status(result.error.status).json(result.error.data);
    return res.status(200).json({ posts: result.posts, page: { id: resolved.page.id, name: resolved.page.name } });
  } catch (error) {
    console.error('Meta posts error:', error);
    return res.status(500).json({ posts: [] });
  }
}

async function metaPublish(req, res) {
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
    if (resolved.error) return res.status(resolved.error.status).json(resolved.error.data);
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

export default async function handler(req, res) {
  const action = String(req.query.action || '');
  if (action === 'posts') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return metaPosts(req, res);
  }
  if (action === 'publish') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return metaPublish(req, res);
  }
  return res.status(404).json({ error: 'Unknown meta action' });
}
