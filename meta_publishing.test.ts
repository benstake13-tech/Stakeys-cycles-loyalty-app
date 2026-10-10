import { describe, it, expect, vi, afterEach } from 'vitest';
import { composePromotionPost, publishToMeta, fetchPostHistory } from './src/utils/metaPublishing';
import type { ShopPromotion } from './src/types/bikeShop';

/**
 * The caption builder is deterministic so staff always see exactly what will be
 * posted; the publish/history calls are pinned so the UI contract with the
 * server proxy can't drift.
 */

const promo = (over: Partial<ShopPromotion> = {}): ShopPromotion =>
  ({
    id: 'p1',
    title: 'Autumn Tune-Up',
    subtitle: 'Keep rolling through the leaves',
    code: 'AUTUMN10',
    discountPercentage: 10,
    badgeText: '10% off',
    status: 'active',
    startDate: '2026-10-01',
    endDate: '2026-11-30',
    termsAndConditions: ['One per customer', 'Book before 30 Nov'],
    eligibleCategories: [],
    bgGradient: '',
    ...over,
  }) as ShopPromotion;

afterEach(() => vi.unstubAllGlobals());

describe('composePromotionPost', () => {
  it('composes a caption with the offer, window, code, terms and hashtags', () => {
    const post = composePromotionPost(promo(), { origin: 'https://stakeys.example/' });
    expect(post.message).toContain('🚲 Autumn Tune-Up — 10% off');
    expect(post.message).toContain('Keep rolling through the leaves');
    expect(post.message).toContain('📅 1 Oct – 30 Nov');
    expect(post.message).toContain('🎟️ Use code AUTUMN10');
    expect(post.message).toContain('• One per customer');
    expect(post.message).toContain('https://stakeys.example');
    expect(post.message).toMatch(/#StakeysCycles/);
    // No double trailing slash from the origin.
    expect(post.message).not.toContain('example//');
    expect(post.hashtags.length).toBeGreaterThan(0);
  });

  it('omits the code line when there is no code', () => {
    const post = composePromotionPost(promo({ code: '' }));
    expect(post.message).not.toContain('Use code');
  });

  it('accepts custom hashtags', () => {
    const post = composePromotionPost(promo(), { hashtags: ['#Custom'] });
    expect(post.message).toContain('#Custom');
    expect(post.message).not.toContain('#StakeysCycles');
  });

  it('carries the promotion image through', () => {
    const post = composePromotionPost(promo({ imageUrl: 'https://cdn.example/x.jpg' }));
    expect(post.imageUrl).toBe('https://cdn.example/x.jpg');
  });
});

describe('publishToMeta', () => {
  it('posts target/message/imageUrl and returns the id', async () => {
    const calls: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: any) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) });
        return { ok: true, status: 200, json: async () => ({ id: 'post_1', target: 'facebook' }) };
      })
    );
    const result = await publishToMeta('facebook', { message: 'hi', hashtags: [], imageUrl: 'https://img/x.jpg' });
    expect(result).toEqual({ ok: true, id: 'post_1', target: 'facebook' });
    expect(calls[0].url).toBe('/api/meta/publish');
    expect(calls[0].body).toMatchObject({ target: 'facebook', message: 'hi', imageUrl: 'https://img/x.jpg' });
  });

  it('surfaces the Graph error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Instagram posts require a public image URL' } }),
      }))
    );
    const result = await publishToMeta('instagram', { message: 'hi', hashtags: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Instagram posts require a public image URL');
  });
});

describe('fetchPostHistory', () => {
  it('returns the posts array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ posts: [{ id: '1', target: 'facebook', message: 'hey', createdAt: '2026-10-08T09:00:00+0000' }] }),
      }))
    );
    const posts = await fetchPostHistory();
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('1');
  });

  it('returns an empty list when the endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    expect(await fetchPostHistory()).toEqual([]);
  });
});
