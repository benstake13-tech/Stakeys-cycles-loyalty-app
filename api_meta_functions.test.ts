import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveManagedPage, publishToPage, publishToInstagram, fetchPagePosts } from './api/meta/_shared.js';
import publishHandler from './api/meta/publish.js';
import postsHandler from './api/meta/posts.js';

/**
 * The publishing path resolves the Page (and its linked Instagram account) from
 * the server-managed system-user token, so the browser never holds a Page token.
 * These tests pin the Graph calls for the production Vercel functions.
 */

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const ok = (body: any) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: any) => ({ ok: false, status, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.META_SYSTEM_USER_TOKEN;
});

describe('resolveManagedPage', () => {
  it('returns the first Page and its linked Instagram account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ok({
          data: [
            {
              id: 'page_1',
              name: "Stakey's cycles",
              access_token: 'PAGE_TOKEN',
              instagram_business_account: { id: 'ig_1' },
            },
          ],
        })
      )
    );
    const r = await resolveManagedPage('SYS', undefined);
    expect(r.page.id).toBe('page_1');
    expect(r.igId).toBe('ig_1');
  });

  it('errors when no Page is linked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ data: [] })));
    const r = await resolveManagedPage('SYS', undefined);
    expect(r.error?.status).toBe(404);
  });
});

describe('publishToPage', () => {
  it('uses /photos when an image is supplied and returns post_id', async () => {
    const calls: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        calls.push({ url: String(url), body: init.body });
        return ok({ id: 'photo_1', post_id: 'page_1_photo_1' });
      })
    );
    const r = await publishToPage('PAGE_TOKEN', 'page_1', 'hello', 'https://img/x.jpg');
    expect(calls[0].url).toContain('/page_1/photos');
    expect(r.id).toBe('page_1_photo_1');
  });

  it('uses /feed when there is no image', async () => {
    const calls: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return ok({ id: 'post_1' });
      })
    );
    const r = await publishToPage('PAGE_TOKEN', 'page_1', 'hello', undefined);
    expect(calls[0]).toContain('/page_1/feed');
    expect(r.id).toBe('post_1');
  });
});

describe('publishToInstagram', () => {
  it('rejects a post without a public image URL', async () => {
    const r = await publishToInstagram('ig_1', 'PAGE_TOKEN', 'hi', undefined);
    expect(r.error?.status).toBe(400);
  });

  it('creates a container then publishes it', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return String(url).includes('media_publish') ? ok({ id: 'ig_post_1' }) : ok({ id: 'container_1' });
      })
    );
    const r = await publishToInstagram('ig_1', 'PAGE_TOKEN', 'hi', 'https://img/x.jpg');
    expect(calls).toEqual([
      expect.stringContaining('/ig_1/media'),
      expect.stringContaining('/ig_1/media_publish'),
    ]);
    expect(r.id).toBe('ig_post_1');
  });
});

describe('fetchPagePosts', () => {
  it('shapes published_posts into history entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ok({
          data: [
            { id: 'p1', message: 'Hello', created_time: '2026-10-08T09:00:00+0000', permalink_url: 'https://fb/p1' },
          ],
        })
      )
    );
    const r = await fetchPagePosts('PAGE_TOKEN', 'page_1');
    expect(r.posts[0]).toMatchObject({ id: 'p1', target: 'facebook', permalink: 'https://fb/p1' });
  });
});

describe('publish handler', () => {
  it('401s when the server token is absent', async () => {
    const res = mockRes();
    await publishHandler({ method: 'POST', body: { target: 'facebook', message: 'hi' } }, res);
    expect(res.statusCode).toBe(401);
  });

  it('400s on a bad target', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS';
    const res = mockRes();
    await publishHandler({ method: 'POST', body: { target: 'tiktok', message: 'hi' } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('publishes to Instagram via the linked account', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('me/accounts')) return ok({ data: [{ id: 'page_1', name: 'S', access_token: 'PT', instagram_business_account: { id: 'ig_1' } }] });
        if (u.includes('media_publish')) return ok({ id: 'ig_post_1' });
        return ok({ id: 'container_1' });
      })
    );
    const res = mockRes();
    await publishHandler({ method: 'POST', body: { target: 'instagram', message: 'hi', imageUrl: 'https://img/x.jpg' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 'ig_post_1', target: 'instagram' });
  });

  it('404s when Instagram is not linked', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS';
    vi.stubGlobal('fetch', vi.fn(async () => ok({ data: [{ id: 'page_1', access_token: 'PT' }] })));
    const res = mockRes();
    await publishHandler({ method: 'POST', body: { target: 'instagram', message: 'hi', imageUrl: 'x' } }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('posts handler', () => {
  it('returns an empty list when the token is absent', async () => {
    const res = mockRes();
    await postsHandler({ method: 'GET', query: {} }, res);
    expect(res.body).toEqual({ posts: [] });
  });

  it('returns the Page posts', async () => {
    process.env.META_SYSTEM_USER_TOKEN = 'SYS';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('me/accounts')) return ok({ data: [{ id: 'page_1', name: 'Stakeys', access_token: 'PT' }] });
        return ok({ data: [{ id: 'p1', message: 'Hi', created_time: 't', permalink_url: 'l' }] });
      })
    );
    const res = mockRes();
    await postsHandler({ method: 'GET', query: {} }, res);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.page.name).toBe('Stakeys');
  });
});
