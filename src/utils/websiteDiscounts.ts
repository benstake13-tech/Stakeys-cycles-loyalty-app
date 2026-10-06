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
import { DiscountCode } from '../types/bikeShop';

/** The curated website-visitor set, usable before the migration is applied. */
export const WEBSITE_DISCOUNT_FALLBACK: DiscountCode[] = generateDiscountSet(PUBLIC_DISCOUNT_SET);

/** Merge live codes with the curated public fallback, live rows winning. */
export function websiteDiscountCatalogue(live: DiscountCode[] | undefined | null): DiscountCode[] {
  const liveCodes = live || [];
  const known = new Set(liveCodes.map((c) => (c.code || '').toUpperCase()));
  const missing = WEBSITE_DISCOUNT_FALLBACK.filter((c) => !known.has(c.code.toUpperCase()));
  return [...liveCodes, ...missing];
}
