import { CollectedVoucher } from '../types/bikeShop';

/**
 * Single source of truth for the loyalty stamp card.
 *
 * The card is a fixed-length journey: stamps accumulate 1..STAMPS_PER_CARD and
 * are NEVER auto-reset. When the card is full the customer collects the reward,
 * which subtracts exactly one card's worth of stamps (a "rollover"), so any
 * stamps earned beyond the card carry into the next one.
 *
 * All card arithmetic lives here so the till, the customer portal and the
 * prize wheel cannot drift apart again.
 */
export const STAMPS_PER_CARD = 10;

/** The reward unlocked by completing a card. */
export const CARD_REWARD_TITLE = '£40 Workshop Service Credit';
export const CARD_REWARD_DESCRIPTION =
  'Eligible for £40 service (labour only, parts not included)';
export const CARD_REWARD_VALUE = 40;
export const CARD_REWARD_TERMS =
  'Eligible for £40 service (labour only, parts not included). Valid for 12 months on any workshop booking.';

/** Accepts the several date shapes that reach the app (Date, ISO string, Firestore Timestamp, null). */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    const d = (value as any).toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when both timestamps fall on the same local calendar day. */
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface StampEligibility {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}

/**
 * The 1-visit-per-day rule. `now` is injectable so the rule is deterministic in
 * tests; callers pass nothing and get the real clock.
 */
export function stampEligibility(
  lastStampedAt: unknown,
  now: Date = new Date()
): StampEligibility {
  const last = toDate(lastStampedAt);
  if (!last) return { allowed: true };

  if (isSameCalendarDay(last, now)) {
    const nextAllowedAt = new Date(last);
    nextAllowedAt.setDate(nextAllowedAt.getDate() + 1);
    nextAllowedAt.setHours(0, 0, 0, 0);
    return {
      allowed: false,
      reason: `Already stamped today at ${last.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}. 1 visit stamp allowed per calendar day.`,
      nextAllowedAt,
    };
  }

  return { allowed: true };
}

/** Convenience boolean form of {@link stampEligibility}. */
export function canStampToday(lastStampedAt: unknown, now?: Date): boolean {
  return stampEligibility(lastStampedAt, now).allowed;
}

export interface StampAward {
  stampsBefore: number;
  stampsAfter: number;
  /** A completed card is now waiting to be collected. */
  cardReady: boolean;
}

/**
 * Adds one visit stamp. The card is never reset here — a full card simply
 * becomes "ready to collect" so the reward is an explicit, auditable action.
 */
export function addVisitStamp(currentStamps: number): StampAward {
  const stampsBefore = Math.max(0, Math.floor(currentStamps || 0));
  const stampsAfter = stampsBefore + 1;
  return { stampsBefore, stampsAfter, cardReady: stampsAfter >= STAMPS_PER_CARD };
}

/** Result of a manual (staff) stamp adjustment. */
export interface StampAdjustment extends StampAward {
  /** Signed change actually applied after clamping. */
  delta: number;
}

/**
 * Clamps a manual adjustment into [0, STAMPS_PER_CARD]. Staff corrections never
 * mint tickets — tickets are only earned by completing a card.
 */
export function adjustStamps(currentStamps: number, delta: number): StampAdjustment {
  const stampsBefore = Math.max(0, Math.floor(currentStamps || 0));
  const stampsAfter = Math.max(0, Math.min(STAMPS_PER_CARD, stampsBefore + Math.floor(delta)));
  return { stampsBefore, stampsAfter, delta: stampsAfter - stampsBefore, cardReady: stampsAfter >= STAMPS_PER_CARD };
}

export interface CardCollection {
  stampsBefore: number;
  stampsAfter: number;
  cardsCollected: number;
}

/**
 * Collects every full card on the account, subtracting one card's worth of
 * stamps per reward. Returns `cardsCollected: 0` when the card is not full.
 */
export function collectFullCard(currentStamps: number): CardCollection {
  const stampsBefore = Math.max(0, Math.floor(currentStamps || 0));
  const cardsCollected = Math.floor(stampsBefore / STAMPS_PER_CARD);
  return {
    stampsBefore,
    stampsAfter: stampsBefore - cardsCollected * STAMPS_PER_CARD,
    cardsCollected,
  };
}

/** Builds the £40 service voucher minted when a card is collected. */
export function buildServiceVoucher(now: Date = new Date()): CollectedVoucher {
  return {
    id: `vouch-srv-${now.getTime()}-${Math.floor(Math.random() * 1000)}`,
    code: `STK-SRV40-${Math.floor(100000 + Math.random() * 900000)}`,
    title: CARD_REWARD_TITLE,
    description: CARD_REWARD_DESCRIPTION,
    value: CARD_REWARD_VALUE,
    type: 'service_credit',
    terms: CARD_REWARD_TERMS,
    claimedAt: now,
    status: 'available',
  };
}
