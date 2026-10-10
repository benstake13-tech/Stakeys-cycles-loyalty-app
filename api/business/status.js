/**
 * Vercel serverless function — provider capability probe.
 *
 * Tells the Growth tab which providers can be read without a browser OAuth
 * token because the server holds a credential (currently only Meta via
 * `META_SYSTEM_USER_TOKEN`). The token itself is never returned — only a
 * boolean — so the client can render a "connected" state with no popup.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    meta: { serverManaged: Boolean(process.env.META_SYSTEM_USER_TOKEN) },
  });
}
