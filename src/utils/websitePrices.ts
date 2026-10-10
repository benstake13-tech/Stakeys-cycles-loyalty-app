/**
 * Pure helpers for the website price list shared by the staff CMS and the till.
 *
 * Price-list items store a human display string (e.g. "£20", "£15 – £40",
 * "£5 per item"). The till needs a single numeric figure to quote and bill, so
 * each item may also carry an explicit `unitPrice`. When it does not, we fall
 * back to parsing the display string — but only when it is a single, unambiguous
 * figure, so a range or a "per item" price is never mis-billed.
 */
import type { WebPriceItem } from '../types/websiteContent';

/** Extracts a clean single figure from a display price, or undefined. */
export function parseUnitPrice(price: string | undefined | null): number | undefined {
  if (!price) return undefined;
  const text = price.trim();
  // A range ("£15 – £40", "£60 – £90+") or a multi-option price is ambiguous.
  if (/[–—-]/.test(text.replace(/^[£\s]*/, ''))) return undefined;
  if (/\bor\b|\/|per\b|each\b|adult|child/i.test(text)) return undefined;
  const match = text.match(/£\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** The billable unit price for a price-list item, explicit first, else parsed. */
export function billableUnitPrice(item: Pick<WebPriceItem, 'price' | 'unitPrice'>): number | undefined {
  if (typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)) return item.unitPrice;
  return parseUnitPrice(item.price);
}
