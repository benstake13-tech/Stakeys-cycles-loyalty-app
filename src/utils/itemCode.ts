import type { WebProduct } from '../types/websiteContent';

/**
 * Canonical way to encode/decode an item-for-sale identifier inside a QR code or
 * barcode printed onto a bike / part on the shop floor.
 *
 * Payload shape: `ITEM-<id>|urn:stakeys:item:ITEM-<id>`
 * `normalizeItemCode` also accepts a bare token or any text/URL that merely
 * contains the token, so a label printed by a third-party app still resolves.
 */
export const STAKEYS_ITEM_URN_PREFIX = 'urn:stakeys:item:';
export const STAKEYS_ITEM_CODE_PREFIX = 'ITEM-';

/**
 * Item codes are derived from the product id so a label stays stable across
 * reprints. Only alphanumerics survive, keeping the code barcode-friendly.
 */
export function itemCodeForProduct(productId: string): string {
  const clean = (productId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${STAKEYS_ITEM_CODE_PREFIX}${clean}`;
}

/** The scannable payload embedded in an item's QR code. */
export function encodeItemCode(productId: string): string {
  const code = itemCodeForProduct(productId);
  return `${code}|${STAKEYS_ITEM_URN_PREFIX}${code}`;
}

/**
 * Extracts an item code from arbitrary scanned text. Handles raw tokens
 * (`ITEM-ABC123`), our encoded payload, and URLs / JSON that merely contain it.
 */
export function normalizeItemCode(raw: string): string {
  if (!raw) return '';
  const value = raw.trim();
  const urnIdx = value.indexOf(STAKEYS_ITEM_URN_PREFIX);
  if (urnIdx >= 0) {
    return value
      .slice(urnIdx + STAKEYS_ITEM_URN_PREFIX.length)
      .split(/[|&?#\s]/)[0]
      .toUpperCase();
  }
  const match = value.match(/ITEM[-_ ]?[A-Z0-9]{3,}/i);
  if (match) {
    const body = match[0].replace(/[^A-Z0-9]/gi, '').toUpperCase().replace(/^ITEM/, '');
    return `${STAKEYS_ITEM_CODE_PREFIX}${body}`;
  }
  return '';
}

/** Resolves a scanned item code back to the live product, or null. */
export function resolveItemByCode(raw: string, products: WebProduct[]): WebProduct | null {
  const code = normalizeItemCode(raw);
  if (!code) return null;
  const wanted = code.replace(/[^A-Z0-9]/g, '');
  return (
    (products || []).find((p) => itemCodeForProduct(p.id) === code) ||
    (products || []).find(
      (p) => itemCodeForProduct(p.id).replace(/[^A-Z0-9]/g, '') === wanted
    ) ||
    null
  );
}
