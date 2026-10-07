/**
 * Refer a Friend.
 *
 * A customer shares a link carrying their referral code. A friend who signs up
 * and books a full service with that code gets £15 off; once the friend's
 * booking is approved the referrer earns a £5 credit.
 *
 * The reward values and the meaning of a "full service" live here as pure data
 * and helpers so the booking flow, the customer portal and the staff overview
 * all agree, and so the logic can be unit-tested without a database.
 */
import { ReferralRecord, ReferralReward, ServiceBooking } from '../types/bikeShop';

/** £ the referrer earns when a referred friend's booking is approved. */
export const REFERRER_REWARD = 5;

/** £ off a full service for the referred friend. */
export const FRIEND_REWARD = 15;

/**
 * A friend reward only applies to a "full service" — a whole-bike workshop
 * service, not a single-symptom repair or a safety check. Matched on the
 * service id and the headline shown to the customer.
 */
const FULL_SERVICE_SERVICE_IDS = new Set([
  'cycle-overhaul',
  'ebike-complete',
  'scooter-overhaul',
]);

const FULL_SERVICE_KEYWORDS = [
  'full pro overhaul',
  'full service',
  'full health check',
  'electrical & mechanical service',
];

/** True when a booking counts as a full service for the £15 friend reward. */
export function isFullService(serviceId?: string, serviceTitle?: string): boolean {
  if (serviceId && FULL_SERVICE_SERVICE_IDS.has(serviceId)) return true;
  const title = String(serviceTitle || '').toLowerCase();
  return FULL_SERVICE_KEYWORDS.some((kw) => title.includes(kw));
}

/** Strip a code down to its comparable form (case/separator insensitive). */
export function normaliseReferralCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Tidy a code for display: upper-case and no stray spaces, hyphens kept. */
export function formatReferralCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/** A stable, readable referral code for a customer, e.g. `STK-REF-4821`. */
export function buildReferralCode(seed?: string | number): string {
  const digits =
    seed !== undefined
      ? String(seed).replace(/\D/g, '').slice(-6).padStart(6, '0')
      : String(Math.floor(100000 + Math.random() * 900000));
  return `STK-REF-${digits}`;
}

/** The shareable link for a referral code, pointing at the public site. */
export function buildReferralLink(code: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://www.stakeyswheels.co.uk');
  return `${base.replace(/\/+$/, '')}/?ref=${encodeURIComponent(formatReferralCode(code))}`;
}

/** Read a `?ref=` code from a URL query string (or the current page). */
export function referralCodeFromSearch(search?: string): string {
  const qs =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
      ? window.location.search
      : '';
  try {
    const code = new URLSearchParams(qs).get('ref') || '';
    // Keep the human-readable formatting (e.g. STK-REF-123456) for display;
    // matching is done on the normalised form elsewhere.
    return formatReferralCode(code);
  } catch {
    return '';
  }
}

/** Find the referral record that owns a code (case/format insensitive). */
export function findReferralByCode(
  code: string,
  records: ReferralRecord[]
): ReferralRecord | null {
  const clean = normaliseReferralCode(code);
  if (!clean) return null;
  return (records || []).find((r) => normaliseReferralCode(r.code) === clean) || null;
}

/** Find a customer's own referral record. */
export function findReferralByOwner(
  uid: string,
  records: ReferralRecord[]
): ReferralRecord | null {
  if (!uid) return null;
  return (records || []).find((r) => r.ownerUid === uid) || null;
}

/**
 * Whether the referred friend's reward can still be used: the code is live,
 * the booking is a full service, the friend is a genuinely new customer (did
 * not own the code), and the reward has not already been redeemed.
 */
export function friendRewardEligible(opts: {
  booking: Pick<ServiceBooking, 'serviceId' | 'serviceTitle' | 'customerId' | 'referralCode'>;
  ownerUid?: string;
  friendReward?: { status: 'issued' | 'redeemed' } | null;
}): { ok: boolean; reason?: string } {
  const { booking, ownerUid, friendReward } = opts;
  if (!booking.referralCode) return { ok: false, reason: 'No referral code on this booking.' };
  if (ownerUid && booking.customerId && booking.customerId === ownerUid) {
    return { ok: false, reason: 'A referral code cannot be used on the referrer’s own booking.' };
  }
  if (!isFullService(booking.serviceId, booking.serviceTitle)) {
    return { ok: false, reason: `The £${FRIEND_REWARD} referral reward only applies to a full service.` };
  }
  if (friendReward && friendReward.status === 'redeemed') {
    return { ok: false, reason: 'This referral reward has already been used.' };
  }
  return { ok: true };
}

/** The fixed-£ friend reward, ready to describe on the booking screen. */
export function describeFriendReward(): string {
  return `£${FRIEND_REWARD} off a full service`;
}

/** The referrer's thank-you, ready to describe in the portal. */
export function describeReferrerReward(): string {
  return `£${REFERRER_REWARD} credit`;
}

/**
 * Fold an approved booking into a referral record: mark the friend's £15 reward
 * as redeemed and append the referrer's £5 credit. Pure and idempotent — returns
 * `null` when this booking has already been paid so the caller does not double-pay.
 */
export function applyReferralReward(
  owner: ReferralRecord,
  booking: Pick<
    ServiceBooking,
    'id' | 'customerId' | 'customerName' | 'customerEmail' | 'serviceId' | 'serviceTitle'
  >,
  now: string
): { record: ReferralRecord; reward: ReferralReward } | null {
  const friends = [...owner.referredFriends];
  const idx = friends.findIndex(
    (f) =>
      f.bookingId === booking.id ||
      (booking.customerId && f.friendUid === booking.customerId) ||
      f.friendEmail === booking.customerEmail
  );

  if (idx >= 0 && friends[idx].rewardGranted && friends[idx].bookingId === booking.id) {
    return null;
  }

  const friendEntry =
    idx >= 0
      ? { ...friends[idx] }
      : {
          friendUid: booking.customerId,
          friendName: booking.customerName,
          friendEmail: booking.customerEmail,
          joinedAt: now,
          bookingApproved: false,
          rewardGranted: false,
        };

  friendEntry.bookingId = booking.id;
  friendEntry.bookingApproved = true;
  friendEntry.rewardGranted = true;
  friendEntry.friendReward = {
    code: `STK-REF15-${booking.id}`,
    discount: FRIEND_REWARD,
    status: 'redeemed',
    issuedAt: now,
    redeemedAt: now,
  };

  if (idx >= 0) friends[idx] = friendEntry;
  else friends.push(friendEntry);

  const reward: ReferralReward = {
    id: `refrw-${booking.id}`,
    amount: REFERRER_REWARD,
    status: 'earned',
    friendName: booking.customerName,
    earnedAt: now,
  };
  const alreadyHasReward = owner.rewards.some((rw) => rw.id === reward.id);
  const rewards = alreadyHasReward ? owner.rewards : [...owner.rewards, reward];

  return {
    record: {
      ...owner,
      referredFriends: friends,
      rewards,
      rewardsEarned: rewards.filter((rw) => rw.status !== 'pending').length,
    },
    reward,
  };
}
