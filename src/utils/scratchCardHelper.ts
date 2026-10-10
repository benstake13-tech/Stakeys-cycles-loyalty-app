import { ScratchCardConfig, ScratchPrize, UserProfile } from '../types/bikeShop';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Seed scratch card used to create the app_settings row on first run and as the
 * fallback when the backend has no configuration yet. Kept in sync with the
 * Prize Hub editor, mirroring DEFAULT_PRIZE_WHEEL.
 */
export const DEFAULT_SCRATCH_CARD: ScratchCardConfig = {
  id: 'scratch-main-01',
  title: "Stakey's Scratch Card",
  enabled: false,
  cooldownHours: 168,
  ticketCost: 0,
  prizes: [
    {
      id: 'scratch-prize-stamp-1',
      label: '+1 Loyalty Stamp',
      weight: 30,
      rewardType: 'stamp',
      stampsAmount: 1,
    },
    {
      id: 'scratch-prize-stamp-2',
      label: '+2 Loyalty Stamps',
      weight: 16,
      rewardType: 'stamp',
      stampsAmount: 2,
    },
    {
      id: 'scratch-prize-gear-10',
      label: '£10 Off Gear',
      weight: 14,
      rewardType: 'discount',
      rewardValue: '£10 Off In-Store Accessories',
    },
    {
      id: 'scratch-prize-cleaner',
      label: 'Muc-Off Cleaner',
      weight: 12,
      rewardType: 'merch',
      rewardValue: 'Complimentary Muc-Off Bike Cleaner',
    },
    {
      id: 'scratch-prize-points-50',
      label: '+50 Store Points',
      weight: 10,
      rewardType: 'points',
      pointsAmount: 50,
      rewardValue: '50 Bonus Loyalty Points',
    },
    {
      id: 'scratch-prize-ticket-1',
      label: 'Prize Draw Ticket',
      weight: 8,
      rewardType: 'ticket',
      ticketAmount: 1,
    },
    {
      id: 'scratch-prize-coffee',
      label: 'Free Workshop Coffee',
      weight: 6,
      rewardType: 'service',
      rewardValue: 'Free Coffee while bike is serviced',
    },
    {
      id: 'scratch-prize-tube',
      label: 'Free Inner Tube',
      weight: 4,
      rewardType: 'merch',
      rewardValue: 'Free Presta/Schrader Inner Tube at Till',
    },
  ],
};

/** Percentage chance shown to staff in the editor, normalized across weights. */
export function scratchPrizeProbability(prize: ScratchPrize, all: ScratchPrize[]): number {
  const total = all.reduce((sum, p) => sum + Math.max(0, p.weight || 0), 0);
  if (total <= 0) return 0;
  return Math.max(0, prize.weight || 0) / total;
}

/**
 * Weighted random pick. Mirrors pickWinningSegmentIndex so the two games share
 * one probability model; a zero/negative weight pool falls back to uniform.
 */
export function pickScratchPrizeIndex(prizes: ScratchPrize[]): number {
  if (!prizes || prizes.length === 0) return -1;

  const total = prizes.reduce((sum, p) => sum + Math.max(0, p.weight || 0), 0);
  if (total <= 0) return Math.floor(Math.random() * prizes.length);

  let random = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    const weight = Math.max(0, prizes[i].weight || 0);
    if (random < weight) return i;
    random -= weight;
  }
  return prizes.length - 1;
}

/** Face value awarded by a prize, for the "you won X" summary. */
export function scratchPrizeAmountLabel(prize: ScratchPrize): string {
  switch (prize.rewardType) {
    case 'stamp':
      return `+${prize.stampsAmount ?? 1} stamp${(prize.stampsAmount ?? 1) === 1 ? '' : 's'}`;
    case 'ticket':
      return `+${prize.ticketAmount ?? 1} prize draw ticket${(prize.ticketAmount ?? 1) === 1 ? '' : 's'}`;
    case 'points':
      return `+${prize.pointsAmount ?? parsePoints(prize.rewardValue)} points`;
    default:
      return prize.rewardValue || prize.label;
  }
}

function parsePoints(value?: string): number {
  const match = value?.match(/\d+/);
  return match ? parseInt(match[0], 10) : 50;
}

export interface ScratchEligibility {
  canPlay: boolean;
  enabled: boolean;
  hasEnoughTickets: boolean;
  ticketCost: number;
  userTickets: number;
  cooldownActive: boolean;
  timeRemainingMs: number;
  timeRemainingFormatted: string;
  nextEligibleDate: Date | null;
  reason?: string;
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value?.toDate) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

function formatRemaining(ms: number): string {
  const days = Math.floor(ms / (24 * HOUR_MS));
  const hours = Math.floor((ms % (24 * HOUR_MS)) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

/**
 * Validates whether a rider may play the scratch card: the feature must be
 * enabled, they must afford the ticket cost, and any cooldown must have elapsed.
 */
export function checkScratchEligibility(
  user: UserProfile | null | undefined,
  config: ScratchCardConfig | null | undefined
): ScratchEligibility {
  const enabled = config?.enabled === true;
  const ticketCost = config?.ticketCost ?? 0;
  const userTickets = user?.tickets ?? 0;
  const hasEnoughTickets = ticketCost === 0 || userTickets >= ticketCost;
  const cooldownHours = config?.cooldownHours ?? 0;

  const base = {
    enabled,
    hasEnoughTickets,
    ticketCost,
    userTickets,
    cooldownActive: false,
    timeRemainingMs: 0,
    timeRemainingFormatted: '',
    nextEligibleDate: null as Date | null,
  };

  if (!enabled) {
    return { ...base, canPlay: false, reason: 'The scratch card is not running right now.' };
  }
  if (!user) {
    return { ...base, hasEnoughTickets: false, canPlay: false, reason: 'Please sign in to play the scratch card.' };
  }

  let cooldownActive = false;
  let timeRemainingMs = 0;
  let nextEligibleDate: Date | null = null;
  let timeRemainingFormatted = '';

  if (cooldownHours > 0 && user.lastScratchedAt) {
    const last = toMillis(user.lastScratchedAt);
    const elapsed = Date.now() - last;
    const cooldownMs = cooldownHours * HOUR_MS;
    if (elapsed < cooldownMs) {
      cooldownActive = true;
      timeRemainingMs = cooldownMs - elapsed;
      nextEligibleDate = new Date(last + cooldownMs);
      timeRemainingFormatted = formatRemaining(timeRemainingMs);
    }
  }

  if (cooldownActive) {
    return {
      ...base,
      cooldownActive: true,
      timeRemainingMs,
      timeRemainingFormatted,
      nextEligibleDate,
      canPlay: false,
      reason: `You've already scratched this card. Come back in ${timeRemainingFormatted}.`,
    };
  }

  if (!hasEnoughTickets) {
    return {
      ...base,
      hasEnoughTickets: false,
      canPlay: false,
      reason: `This scratch card costs ${ticketCost} ticket${ticketCost > 1 ? 's' : ''} (you have ${userTickets}). Earn tickets by completing your 10-stamp card.`,
    };
  }

  return { ...base, canPlay: true };
}

/** Normalizes a stored/edited config, dropping malformed prizes. */
export function normalizeScratchCard(config: Partial<ScratchCardConfig> | null | undefined): ScratchCardConfig {
  const prizes = Array.isArray(config?.prizes)
    ? config!.prizes
        .filter((p) => p && typeof p.label === 'string' && p.label.trim().length > 0)
        .map((p, i) => ({
          id: p.id || `scratch-prize-${i}`,
          label: p.label.trim(),
          weight: Number.isFinite(p.weight) ? Math.max(0, p.weight) : 10,
          rewardType: p.rewardType || 'merch',
          rewardValue: p.rewardValue,
          stampsAmount: p.stampsAmount,
          ticketAmount: p.ticketAmount,
          pointsAmount: p.pointsAmount,
        }))
    : DEFAULT_SCRATCH_CARD.prizes;

  return {
    id: config?.id || DEFAULT_SCRATCH_CARD.id,
    title: config?.title?.trim() || DEFAULT_SCRATCH_CARD.title,
    enabled: config?.enabled === true,
    cooldownHours: Number.isFinite(config?.cooldownHours as number)
      ? Math.max(0, config!.cooldownHours as number)
      : DEFAULT_SCRATCH_CARD.cooldownHours,
    ticketCost: Number.isFinite(config?.ticketCost as number)
      ? Math.max(0, config!.ticketCost as number)
      : DEFAULT_SCRATCH_CARD.ticketCost,
    prizes: prizes.length > 0 ? prizes : DEFAULT_SCRATCH_CARD.prizes,
    updatedAt: config?.updatedAt,
  };
}
