import { UserProfile, PrizeWheel, PrizeWheelSegment } from '../types/bikeShop';

export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Authoritative default wheel used to seed the database and as a fallback when
 * no wheel has been configured in the backend yet.
 */
export const DEFAULT_PRIZE_WHEEL: PrizeWheel = {
  id: 'wheel-main-01',
  title: "Stakey's Weekly Prize Wheel",
  active: true,
  ticketCost: 0,
  segments: [
    {
      id: 'seg-stamp-1',
      label: '+1 Loyalty Stamp',
      color: '#05C147',
      probability: 0.28,
      prizeId: 'prize-stamp-1',
      rewardType: 'stamp',
      stampsAmount: 1,
    },
    {
      id: 'seg-gear-10',
      label: '£10 Off Gear',
      color: '#0284c7',
      probability: 0.18,
      prizeId: 'prize-gear-10',
      rewardType: 'discount',
      rewardValue: '£10 Off In-Store Accessories',
    },
    {
      id: 'seg-stamp-2',
      label: '+2 Stamps',
      color: '#10b981',
      probability: 0.16,
      prizeId: 'prize-stamp-2',
      rewardType: 'stamp',
      stampsAmount: 2,
    },
    {
      id: 'seg-cleaner',
      label: 'Muc-Off Cleaner',
      color: '#7c3aed',
      probability: 0.12,
      prizeId: 'prize-cleaner',
      rewardType: 'merch',
      rewardValue: 'Complimentary Muc-Off Bike Cleaner',
    },
    {
      id: 'seg-stamp-3',
      label: '+3 Stamps Jackpot!',
      color: '#d97706',
      probability: 0.08,
      prizeId: 'prize-stamp-3',
      rewardType: 'stamp',
      stampsAmount: 3,
    },
    {
      id: 'seg-tube',
      label: 'Free Inner Tube',
      color: '#0891b2',
      probability: 0.08,
      prizeId: 'prize-tube',
      rewardType: 'merch',
      rewardValue: 'Free Presta/Schrader Inner Tube at Till',
    },
    {
      id: 'seg-points-50',
      label: '+50 Store Points',
      color: '#db2777',
      probability: 0.05,
      prizeId: 'prize-points-50',
      rewardType: 'points',
      rewardValue: '50 Bonus Loyalty Points',
    },
    {
      id: 'seg-espresso',
      label: 'Free Workshop Coffee',
      color: '#ea580c',
      probability: 0.05,
      prizeId: 'prize-coffee',
      rewardType: 'service',
      rewardValue: 'Free Barista Coffee while bike is serviced',
    },
  ],
};


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
