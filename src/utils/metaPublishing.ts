import { ShopPromotion } from '../types/bikeShop';
import { promotionOfferText } from './performanceInsights';

/**
 * Composing and publishing shop promotions to the Facebook Page and the linked
 * Instagram account. The caption builder is pure so it can be unit-tested; the
 * publish/history calls go through our server proxy which holds the Page token.
 */

export type SocialTarget = 'facebook' | 'instagram';

export interface ComposedPost {
  message: string;
  hashtags: string[];
  /** Public image URL (required by Instagram; optional for Facebook). */
  imageUrl?: string;
}

const DEFAULT_HASHTAGS = [
  '#StakeysCycles',
  '#BikeRepair',
  '#CyclingLife',
  '#LocalBikeShop',
  '#BikeService',
];

const CTA = "Book online or call the workshop — we'll get you rolling.";

/** Formats a YYYY-MM-DD as e.g. "3 Nov". */
function shortDate(value: string): string {
  const [y, m, d] = String(value || '').split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Builds the caption for a promotion. Deterministic (no clock, no randomness) so
 * the exact copy is asserted in tests and staff always see what will be posted.
 */
export function composePromotionPost(
  promo: ShopPromotion,
  options: { shopName?: string; origin?: string; hashtags?: string[] } = {}
): ComposedPost {
  const shopName = options.shopName || "Stakey's Cycles";
  const offer = promotionOfferText(promo);
  const hashtags = options.hashtags?.length ? options.hashtags : DEFAULT_HASHTAGS;

  const lines: string[] = [];
  lines.push(`🚲 ${promo.title} — ${offer}`);
  if (promo.subtitle) lines.push(promo.subtitle);

  const window =
    promo.startDate && promo.endDate
      ? `📅 ${shortDate(promo.startDate)} – ${shortDate(promo.endDate)}`
      : '';
  if (window) lines.push(window);

  if (promo.code) lines.push(`🎟️ Use code ${promo.code}`);

  if (promo.termsAndConditions?.length) {
    lines.push('');
    lines.push(...promo.termsAndConditions.map((t) => `• ${t}`));
  }

  lines.push('');
  lines.push(CTA);
  if (options.origin) lines.push(options.origin.replace(/\/+$/, ''));
  lines.push('');
  lines.push(hashtags.join(' '));

  return {
    message: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    hashtags,
    imageUrl: promo.imageUrl,
  };
}

export interface PublishResult {
  ok: boolean;
  id?: string;
  target?: SocialTarget;
  error?: string;
}

/** Publishes a composed post to one target via the server proxy. */
export async function publishToMeta(
  target: SocialTarget,
  post: ComposedPost
): Promise<PublishResult> {
  try {
    const res = await fetch('/api/meta/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message: post.message, imageUrl: post.imageUrl }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data?.error;
      return {
        ok: false,
        target,
        error: typeof err === 'string' ? err : err?.message || data?.message || 'Publish failed',
      };
    }
    return { ok: true, id: data?.id, target };
  } catch (err: any) {
    return { ok: false, target, error: err?.message || 'Publish failed' };
  }
}

export interface PostHistoryEntry {
  id: string;
  target: SocialTarget;
  message: string;
  permalink?: string;
  createdAt: string;
}

/** Recent posts published to the Page (and its linked Instagram account). */
export async function fetchPostHistory(): Promise<PostHistoryEntry[]> {
  try {
    const res = await fetch('/api/meta/posts');
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.posts) ? data.posts : [];
  } catch {
    return [];
  }
}
