/**
 * Server-side Meta publishing helpers (Vercel functions + dev server).
 *
 * The Growth tab reads Meta with `META_SYSTEM_USER_TOKEN`; publishing uses the
 * SAME credential, but Graph requires a *Page* access token for `/{page}/feed`
 * and `/{ig}/media`. We resolve the Page (and its linked Instagram business
 * account) from the system-user token server-side, so no Page token ever reaches
 * the browser.
 *
 * NOTE: a Facebook app in Development mode can only publish to Pages/IG accounts
 * whose admins have a role on the app, and posts are not public until the app
 * passes App Review for pages_manage_posts + instagram_content_publish. See
 * docs/META_PUBLISHING.md.
 */

export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Resolves the Page id + name + linked IG account from the system-user token. */
export async function resolveManagedPage(token, pageId) {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account');
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) return { error: { status: response.status, data } };

  const pages = data?.data || [];
  const page = pageId ? pages.find((p) => String(p.id) === String(pageId)) : pages[0];
  if (!page) return { error: { status: 404, data: { error: 'No Facebook Page is linked to this token' } } };

  let igId = page.instagram_business_account?.id;
  let igUsername;
  if (!igId) {
    // Some tokens omit the inline field; ask the Page directly.
    const igUrl = new URL(`${GRAPH_BASE}/${page.id}`);
    igUrl.searchParams.set('fields', 'instagram_business_account{id,username}');
    const igResp = await fetch(igUrl.toString(), {
      headers: { Authorization: `Bearer ${page.access_token}` },
    });
    const igData = await igResp.json().catch(() => null);
    igId = igData?.instagram_business_account?.id;
    igUsername = igData?.instagram_business_account?.username;
  }

  return { page, igId, igUsername };
}

/** Publishes a text/photo post to the Page feed. Returns the new post id. */
export async function publishToPage(pageToken, pageId, message, imageUrl) {
  const endpoint = imageUrl ? 'photos' : 'feed';
  const body = new URLSearchParams({ message });
  if (imageUrl) body.set('url', imageUrl);

  const response = await fetch(`${GRAPH_BASE}/${pageId}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await response.json();
  // Photo posts return { id, post_id }; the feed returns { id }.
  if (!response.ok) return { error: { status: response.status, data } };
  return { id: data.post_id || data.id };
}

/**
 * Publishes to Instagram via the two-step container flow. Instagram requires a
 * publicly reachable image URL — it cannot accept an upload — so `imageUrl` is
 * mandatory here.
 */
export async function publishToInstagram(igId, pageToken, message, imageUrl) {
  if (!imageUrl) {
    return { error: { status: 400, data: { error: 'Instagram posts require a public image URL' } } };
  }

  const create = await fetch(`${GRAPH_BASE}/${igId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ image_url: imageUrl, caption: message }).toString(),
  });
  const created = await create.json();
  if (!create.ok || !created?.id) {
    return { error: { status: create.status, data: created } };
  }

  const publish = await fetch(`${GRAPH_BASE}/${igId}/media_publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ creation_id: created.id }).toString(),
  });
  const published = await publish.json();
  if (!publish.ok) return { error: { status: publish.status, data: published } };
  return { id: published.id };
}

/** Recent Page posts for the publish-history panel. */
export async function fetchPagePosts(pageToken, pageId, limit = 12) {
  const url = new URL(`${GRAPH_BASE}/${pageId}/published_posts`);
  url.searchParams.set('fields', 'id,message,created_time,permalink_url');
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pageToken}` } });
  const data = await response.json();
  if (!response.ok) return { error: { status: response.status, data } };
  return {
    posts: (data?.data || []).map((p) => ({
      id: p.id,
      target: 'facebook',
      message: p.message || '',
      permalink: p.permalink_url,
      createdAt: p.created_time,
    })),
  };
}
