/**
 * Vercel serverless function — recent Facebook Page posts, for the promotion
 * publish-history panel.
 */
import { resolveManagedPage, fetchPagePosts } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
