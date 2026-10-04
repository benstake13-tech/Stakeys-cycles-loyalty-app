import { UserProfile } from '../types/bikeShop';

/**
 * Canonical way to encode/decode a membership identifier inside a QR code or barcode.
 * We support both a bare token (`STK-123456`) and a compact URL form
 * (`STK-123456|urn:stakeys:membership`) so scans from third-party apps still resolve.
 */
export const STAKEYS_URN_PREFIX = 'urn:stakeys:membership:';

/** Loyalty balances carried on a member pass (mirrors UserProfile). */
export interface MembershipBalance {
  stamps: number;
  tickets: number;
  points: number;
}

/** Reads the loyalty balances off a profile with sane numeric fallbacks. */
export function membershipBalance(user: {
  stamps?: number;
  tickets?: number;
  points?: number;
}): MembershipBalance {
  return {
    stamps: Number(user?.stamps) || 0,
    tickets: Number(user?.tickets) || 0,
    points: Number(user?.points) || 0,
  };
}

export function encodeMembership(membershipNumber: string | undefined): string {
  const token = (membershipNumber || '').toUpperCase().replace(/\s+/g, '');
  return `${token}|${STAKEYS_URN_PREFIX}${token}`;
}

/**
 * Full pass payload: the scannable membership token plus the rider's live
 * loyalty balances. The balances ride along as query params so a scan works
 * offline / before the till has fetched the roster, while `normalizeScannedCode`
 * still resolves the same membership number.
 */
export function encodeMembershipPayload(
  membershipNumber: string | undefined,
  balance?: MembershipBalance
): string {
  const base = encodeMembership(membershipNumber);
  if (!balance) return base;
  const { stamps, tickets, points } = membershipBalance(balance);
  return `${base}?s=${stamps}&t=${tickets}&p=${points}`;
}

/**
 * Extracts the balances from a scanned pass payload. Returns `undefined` for a
 * bare token / legacy code that carries no balances.
 */
export function parseMembershipPayload(raw: string): MembershipBalance | undefined {
  if (!raw) return undefined;
  const match = raw.match(/[?&]s=(\d+)&t=(\d+)&p=(\d+)/i);
  if (!match) return undefined;
  return { stamps: Number(match[1]), tickets: Number(match[2]), points: Number(match[3]) };
}

/**
 * Extracts a membership number from arbitrary scanned text. Handles:
 *  - raw tokens: STK-839201
 *  - our encoded payload: STK-839201|urn:stakeys:membership:STK-839201
 *  - URLs / JSON that merely contain the token
 *  - full profile URLs like https://.../member/STK-839201
 */
export function normalizeScannedCode(raw: string): string {
  if (!raw) return '';
  const value = raw.trim();
  const urnIdx = value.indexOf(STAKEYS_URN_PREFIX);
  if (urnIdx >= 0) {
    return value.slice(urnIdx + STAKEYS_URN_PREFIX.length).split(/[|&?#\s]/)[0].toUpperCase();
  }
  const match = value.match(/STK[- ]?\d{4,8}/i);
  if (match) return match[0].toUpperCase().replace(/\s+/g, '-');
  // Fall back to the last path/query segment (e.g. /member/ABC123)
  const segment = value.split(/[/?#=&|]/).filter(Boolean).pop();
  return (segment || value).toUpperCase();
}

export type CustomerMatch =
  | { status: 'match'; customer: UserProfile }
  | { status: 'multiple'; customers: UserProfile[] }
  | { status: 'none' };

/**
 * Resolves a scanned code to a customer using membership number, uid, or name/email.
 * Falls back to fuzzy partial matches so a partially-occluded barcode still resolves.
 */
export function resolveCustomer(rawCode: string, users: UserProfile[]): CustomerMatch {
  const clean = normalizeScannedCode(rawCode);
  if (!clean) return { status: 'none' };

  const customers = (users || []).filter((u) => u.role === 'customer');

  const exact = customers.filter(
    (u) =>
      (u.membershipNumber || '').toUpperCase() === clean ||
      (u.uid || '').toUpperCase() === clean
  );
  if (exact.length === 1) return { status: 'match', customer: exact[0] };
  if (exact.length > 1) return { status: 'multiple', customers: exact };

  const partial = customers.filter(
    (u) =>
      (u.membershipNumber || '').toUpperCase().includes(clean) ||
      clean.includes((u.membershipNumber || '').toUpperCase() || '\u0000') ||
      (u.displayName || '').toUpperCase().includes(clean) ||
      (u.email || '').toUpperCase().includes(clean)
  );
  if (partial.length === 1) return { status: 'match', customer: partial[0] };
  if (partial.length > 1) return { status: 'multiple', customers: partial };

  return { status: 'none' };
}
