import { UserProfile, CollectedVoucher } from '../types/bikeShop';
import { STAMPS_PER_CARD, toDate } from './loyaltyCard';

/**
 * Proactive "almost there" nudges for the customer app.
 *
 * Pure and deterministic (`now` injectable) so the customer portal can render a
 * banner and the rules can be unit-tested without a database. Thresholds live
 * here as constants so product can tune them in one place.
 */

/** Surface a stamp nudge when the customer is within this many stamps of a full card. */
export const NUDGE_STAMPS_WITHIN = 2;

/** Surface an expiry nudge when a reward lapses within this many days. */
export const NUDGE_EXPIRY_DAYS = 30;

/** Service vouchers are valid for this many months from the date they were claimed. */
export const VOUCHER_VALID_MONTHS = 12;

export type NudgeTone = 'emerald' | 'amber' | 'rose';

/** Where a nudge's call-to-action should route. */
export type NudgeTarget = 'stamps' | 'wallet' | 'refer';

export interface RewardNudge {
  id: string;
  title: string;
  detail: string;
  tone: NudgeTone;
  cta: string;
  target: NudgeTarget;
}

/** Add whole months to a date without the month-length edge cases of setMonth. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(targetMonth);
  // Clamp to the last valid day of the resulting month (e.g. 31 Jan + 1mo -> 28/29 Feb).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** When a collected voucher lapses (claimedAt + validity window). */
export function voucherExpiry(voucher: CollectedVoucher): Date | null {
  const claimed = toDate(voucher.claimedAt);
  if (!claimed) return null;
  return addMonths(claimed, VOUCHER_VALID_MONTHS);
}

/** Whole days from `now` until `date` (negative when already past). */
export function daysUntil(date: Date, now: Date): number {
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Every active nudge for a customer, most urgent first. Returns an empty array
 * when there is nothing worth interrupting the customer about.
 */
export function buildRewardNudges(user: UserProfile | null | undefined, now: Date = new Date()): RewardNudge[] {
  if (!user) return [];
  const nudges: RewardNudge[] = [];

  const stamps = Math.max(0, Math.floor(user.stamps || 0));
  const remaining = STAMPS_PER_CARD - stamps;
  if (remaining > 0 && remaining <= NUDGE_STAMPS_WITHIN) {
    nudges.push({
      id: 'stamps-almost',
      title: `Only ${remaining} stamp${remaining === 1 ? '' : 's'} to your £40 reward`,
      detail: `You're ${remaining} visit${remaining === 1 ? '' : 's'} away from a full loyalty card.`,
      tone: 'emerald',
      cta: 'View loyalty pass',
      target: 'stamps',
    });
  }

  const vouchers = user.serviceVouchers || [];
  for (const v of vouchers) {
    if (v.status !== 'available') continue;
    const expiry = voucherExpiry(v);
    if (!expiry) continue;
    const days = daysUntil(expiry, now);
    if (days < 0) {
      nudges.push({
        id: `voucher-expired-${v.id}`,
        title: 'A reward has expired',
        detail: `${v.title} lapsed on ${expiry.toLocaleDateString()}.`,
        tone: 'rose',
        cta: 'Open wallet',
        target: 'wallet',
      });
    } else if (days <= NUDGE_EXPIRY_DAYS) {
      nudges.push({
        id: `voucher-expiring-${v.id}`,
        title: `${v.title} expires soon`,
        detail: `Use it within ${days} day${days === 1 ? '' : 's'} — worth £${v.value}.`,
        tone: 'amber',
        cta: 'Open wallet',
        target: 'wallet',
      });
    }
  }

  const pendingRewards = (user.referralRewards || []).filter((r) => r.status === 'earned');
  if (pendingRewards.length > 0) {
    const total = pendingRewards.reduce((sum, r) => sum + (r.amount || 0), 0);
    nudges.push({
      id: 'referral-credit-unused',
      title: `£${total} referral credit ready to use`,
      detail: 'Apply your earned referral credit to your next workshop booking.',
      tone: 'emerald',
      cta: 'View rewards',
      target: 'refer',
    });
  }

  // Most urgent first: expired/rose, then amber, then emerald.
  const rank: Record<NudgeTone, number> = { rose: 0, amber: 1, emerald: 2 };
  return nudges.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
