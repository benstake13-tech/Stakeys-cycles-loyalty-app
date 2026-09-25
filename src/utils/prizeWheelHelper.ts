import { UserProfile, PrizeWheel, PrizeWheelSegment } from '../types/bikeShop';

export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SpinEligibility {
  canSpin: boolean;
  hasEnoughTickets: boolean;
  ticketCost: number;
  userTickets: number;
  ticketsNeeded: number;
  isWeeklyCooldownActive: boolean;
  timeRemainingMs: number;
  timeRemainingFormatted: string;
  nextEligibleDate: Date | null;
  reason?: string;
}

/**
 * Validates if the customer is eligible to spin the wheel:
 * 1. Has enough tickets (>= wheel.ticketCost, default 1)
 * 2. 1 spin per week per user rule
 */
export function checkSpinEligibility(
  user: UserProfile | null | undefined,
  wheel: PrizeWheel | null | undefined
): SpinEligibility {
  const ticketCost = wheel?.ticketCost !== undefined ? wheel.ticketCost : 0;
  const userTickets = user?.tickets ?? 0;
  const hasEnoughTickets = ticketCost === 0 || userTickets >= ticketCost;
  const ticketsNeeded = Math.max(0, ticketCost - userTickets);

  if (!user) {
    return {
      canSpin: false,
      hasEnoughTickets: false,
      ticketCost,
      userTickets: 0,
      ticketsNeeded: ticketCost,
      isWeeklyCooldownActive: false,
      timeRemainingMs: 0,
      timeRemainingFormatted: '',
      nextEligibleDate: null,
      reason: 'Please sign in to spin the prize wheel.',
    };
  }

  // Check 1-spin-per-week cooldown
  let isWeeklyCooldownActive = false;
  let timeRemainingMs = 0;
  let nextEligibleDate: Date | null = null;
  let timeRemainingFormatted = '';

  if (user.lastSpunAt) {
    const lastSpunTime =
      typeof user.lastSpunAt === 'string'
        ? new Date(user.lastSpunAt).getTime()
        : user.lastSpunAt?.toDate
        ? user.lastSpunAt.toDate().getTime()
        : new Date(user.lastSpunAt).getTime();

    const now = Date.now();
    const elapsed = now - lastSpunTime;

    if (elapsed < ONE_WEEK_MS) {
      isWeeklyCooldownActive = true;
      timeRemainingMs = ONE_WEEK_MS - elapsed;
      nextEligibleDate = new Date(lastSpunTime + ONE_WEEK_MS);

      const days = Math.floor(timeRemainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor(
        (timeRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
      );
      const minutes = Math.floor((timeRemainingMs % (60 * 60 * 1000)) / (60 * 1000));

      if (days > 0) {
        timeRemainingFormatted = `${days}d ${hours}h`;
      } else if (hours > 0) {
        timeRemainingFormatted = `${hours}h ${minutes}m`;
      } else {
        timeRemainingFormatted = `${Math.max(1, minutes)}m`;
      }
    }
  }

  if (isWeeklyCooldownActive) {
    return {
      canSpin: false,
      hasEnoughTickets,
      ticketCost,
      userTickets,
      ticketsNeeded,
      isWeeklyCooldownActive: true,
      timeRemainingMs,
      timeRemainingFormatted,
      nextEligibleDate,
      reason: `Weekly Limit: 1 spin per week per rider. Next spin unlocks in ${timeRemainingFormatted}.`,
    };
  }

  if (!hasEnoughTickets) {
    return {
      canSpin: false,
      hasEnoughTickets: false,
      ticketCost,
      userTickets,
      ticketsNeeded,
      isWeeklyCooldownActive: false,
      timeRemainingMs: 0,
      timeRemainingFormatted: '',
      nextEligibleDate: null,
      reason: `Insufficient tickets. This wheel requires ${ticketCost} ticket${
        ticketCost > 1 ? 's' : ''
      } (you have ${userTickets}). Earn tickets by completing your 10-stamp card!`,
    };
  }

  return {
    canSpin: true,
    hasEnoughTickets: true,
    ticketCost,
    userTickets,
    ticketsNeeded: 0,
    isWeeklyCooldownActive: false,
    timeRemainingMs: 0,
    timeRemainingFormatted: '',
    nextEligibleDate: null,
  };
}

/**
 * Selects a winning segment index based on segment probabilities
 */
export function pickWinningSegmentIndex(segments: PrizeWheelSegment[]): number {
  if (!segments || segments.length === 0) return 0;

  const totalWeight = segments.reduce((sum, s) => sum + Math.max(0.01, s.probability || 0.1), 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < segments.length; i++) {
    const weight = Math.max(0.01, segments[i].probability || 0.1);
    if (random <= weight) {
      return i;
    }
    random -= weight;
  }

  return 0;
}
