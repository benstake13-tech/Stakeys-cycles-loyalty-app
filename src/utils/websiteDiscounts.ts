/**
 * Website discount catalogue.
 *
 * The live `discount_codes` table is the source of truth, but the audience
 * column and the seeded visitor codes only exist once
 * `20261007_discount_code_audience.sql` has been applied. Until then the shop
 * would show "No active coupon codes" even though the public welcome offers
 * are part of the product. This module merges the curated public set in as a
 * fallback so the marketing site's coupon panel and cart always work.
 *
 * Dedupe is by CODE, so a code a staff member has edited (or disabled) in the
 * database is never overwritten or resurrected.
 */
import { PUBLIC_DISCOUNT_SET, generateDiscountSet } from './discountAudience';
import { DiscountAudience, DiscountCode } from '../types/bikeShop';

/** The curated website-visitor set, usable before the migration is applied. */
export const WEBSITE_DISCOUNT_FALLBACK: DiscountCode[] = generateDiscountSet(PUBLIC_DISCOUNT_SET);

const MEMBER_PREFIX = 'MEM-';
const PUBLIC_PREFIX = 'WEB-';

/**
 * Recover a code's audience when the live row does not carry one. Before
 * `20261007_discount_code_audience.sql` runs, the `audience` column does not
 * exist, so `upsertDiscountCodeToDb` strips it and every seeded code reads back
 * with `audience: undefined`. The curated sets use stable prefixes, so the tag
 * can be inferred from the code itself. Unknown codes stay undefined (open).
 */
export function inferAudience(code: DiscountCode): DiscountAudience | undefined {
  if (code.audience) return code.audience;
  const value = (code.code || '').toUpperCase();
  if (value.startsWith(MEMBER_PREFIX)) return 'member';
  if (value.startsWith(PUBLIC_PREFIX)) return 'public';
  return undefined;
}

/** Merge live codes with the curated public fallback, live rows winning. */
export function websiteDiscountCatalogue(live: DiscountCode[] | undefined | null): DiscountCode[] {
  const liveCodes = (live || []).map((c) => ({ ...c, audience: inferAudience(c) }));
  const known = new Set(liveCodes.map((c) => (c.code || '').toUpperCase()));
  const missing = WEBSITE_DISCOUNT_FALLBACK.filter((c) => !known.has(c.code.toUpperCase()));
  return [...liveCodes, ...missing];
}

/**
 * Read a discount code a visitor arrived with via a shared offer link
 * (`?code=WEB-5OFF`, or the `?promo=` alias). Returns an upper-cased code or
 * '' when none is present, so marketing can point a bio/SMS link straight at a
 * code without the shopper having to retype it.
 */
export function discountCodeFromSearch(search?: string): string {
  const qs =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
      ? window.location.search
      : '';
  try {
    const params = new URLSearchParams(qs);
    return (params.get('code') || params.get('promo') || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

/** Build the shareable offer link a coupon card copies (origin + `?code=`). */
export function discountShareUrl(code: string, origin?: string): string {
  const base =
    origin !== undefined
      ? origin
      : typeof window !== 'undefined'
      ? window.location.origin
      : '';
  const clean = String(code || '').trim().toUpperCase();
  return clean ? `${base}/?code=${encodeURIComponent(clean)}` : base;
}
