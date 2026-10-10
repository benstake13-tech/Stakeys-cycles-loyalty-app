import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_SCRATCH_CARD,
  normalizeScratchCard,
  pickScratchPrizeIndex,
  scratchPrizeProbability,
  scratchPrizeAmountLabel,
  checkScratchEligibility,
} from './src/utils/scratchCardHelper';
import type { ScratchPrize, UserProfile } from './src/types/bikeShop';

const stamp = (weight: number, id = 'stamp'): ScratchPrize => ({
  id,
  label: '+1 Stamp',
  weight,
  rewardType: 'stamp',
  stampsAmount: 1,
});

const config = (overrides: Partial<typeof DEFAULT_SCRATCH_CARD> = {}) => ({
  ...DEFAULT_SCRATCH_CARD,
  enabled: true,
  ...overrides,
});

const user = (overrides: Partial<UserProfile> = {}): UserProfile =>
  ({ uid: 'u1', displayName: 'Rider', stamps: 0, tickets: 0, points: 0, ...overrides }) as UserProfile;

describe('scratchPrizeProbability', () => {
  it('normalizes weights into probabilities that sum to 1', () => {
    const prizes = [stamp(3, 'a'), stamp(1, 'b')];
    expect(scratchPrizeProbability(prizes[0], prizes)).toBeCloseTo(0.75);
    expect(scratchPrizeProbability(prizes[1], prizes)).toBeCloseTo(0.25);
  });

  it('treats negative weights as zero and returns 0 when the pool is empty', () => {
    const prizes = [stamp(-5, 'a'), stamp(0, 'b')];
    expect(scratchPrizeProbability(prizes[0], prizes)).toBe(0);
    expect(scratchPrizeProbability(prizes[0], [])).toBe(0);
  });
});

describe('pickScratchPrizeIndex', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns -1 for an empty prize list', () => {
    expect(pickScratchPrizeIndex([])).toBe(-1);
  });

  it('never picks a zero-weight prize', () => {
    const prizes = [stamp(0, 'a'), stamp(10, 'b')];
    for (let i = 0; i < 50; i++) {
      expect(pickScratchPrizeIndex(prizes)).toBe(1);
    }
  });

  it('falls back to a uniform pick when every weight is zero', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(pickScratchPrizeIndex([stamp(0, 'a'), stamp(0, 'b')])).toBe(1);
  });

  it('respects weights using the RNG roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // 0.05 * 10 = 0.5 < 3
    expect(pickScratchPrizeIndex([stamp(3, 'a'), stamp(7, 'b')])).toBe(0);
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // 9 > 3 -> second
    expect(pickScratchPrizeIndex([stamp(3, 'a'), stamp(7, 'b')])).toBe(1);
  });
});

describe('scratchPrizeAmountLabel', () => {
  it('describes each reward type', () => {
    expect(scratchPrizeAmountLabel({ id: '1', label: 'x', weight: 1, rewardType: 'stamp', stampsAmount: 1 })).toBe('+1 stamp');
    expect(scratchPrizeAmountLabel({ id: '1', label: 'x', weight: 1, rewardType: 'stamp', stampsAmount: 2 })).toBe('+2 stamps');
    expect(scratchPrizeAmountLabel({ id: '1', label: 'x', weight: 1, rewardType: 'ticket', ticketAmount: 1 })).toBe('+1 prize draw ticket');
    expect(scratchPrizeAmountLabel({ id: '1', label: 'x', weight: 1, rewardType: 'points', pointsAmount: 50 })).toBe('+50 points');
    expect(scratchPrizeAmountLabel({ id: '1', label: 'x', weight: 1, rewardType: 'merch', rewardValue: 'Bottle' })).toBe('Bottle');
  });
});

describe('normalizeScratchCard', () => {
  it('returns defaults for a missing config', () => {
    const n = normalizeScratchCard(null);
    expect(n.enabled).toBe(false);
    expect(n.prizes.length).toBe(DEFAULT_SCRATCH_CARD.prizes.length);
  });

  it('drops malformed prizes and clamps negative numbers', () => {
    const n = normalizeScratchCard({
      title: '  ',
      enabled: true,
      cooldownHours: -10,
      ticketCost: -3,
      prizes: [
        { id: '', label: 'Keep me', weight: -5, rewardType: 'stamp' } as any,
        { id: 'x', label: '   ', weight: 5, rewardType: 'merch' } as any,
      ],
    });
    expect(n.title).toBe(DEFAULT_SCRATCH_CARD.title);
    expect(n.cooldownHours).toBe(0);
    expect(n.ticketCost).toBe(0);
    expect(n.prizes).toHaveLength(1);
    expect(n.prizes[0].label).toBe('Keep me');
    expect(n.prizes[0].weight).toBe(0);
  });

  it('falls back to default prizes when every prize is filtered out', () => {
    const n = normalizeScratchCard({ prizes: [{ label: '' } as any] });
    expect(n.prizes.length).toBe(DEFAULT_SCRATCH_CARD.prizes.length);
  });
});

describe('checkScratchEligibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('blocks play when the feature is disabled', () => {
    const e = checkScratchEligibility(user(), config({ enabled: false }));
    expect(e.canPlay).toBe(false);
    expect(e.enabled).toBe(false);
  });

  it('blocks play when the rider cannot afford the ticket cost', () => {
    const e = checkScratchEligibility(user({ tickets: 0 }), config({ ticketCost: 2 }));
    expect(e.canPlay).toBe(false);
    expect(e.hasEnoughTickets).toBe(false);
    expect(e.reason).toContain('2 tickets');
  });

  it('allows play when the rider has enough tickets', () => {
    const e = checkScratchEligibility(user({ tickets: 5 }), config({ ticketCost: 2 }));
    expect(e.canPlay).toBe(true);
    expect(e.hasEnoughTickets).toBe(true);
  });

  it('blocks play while the cooldown is active and reports the remaining time', () => {
    const last = new Date('2026-10-08T06:00:00Z');
    const e = checkScratchEligibility(
      user({ lastScratchedAt: last }),
      config({ cooldownHours: 24 })
    );
    expect(e.canPlay).toBe(false);
    expect(e.cooldownActive).toBe(true);
    expect(e.timeRemainingFormatted).toBe('18h 0m');
    expect(e.nextEligibleDate?.toISOString()).toBe('2026-10-09T06:00:00.000Z');
  });

  it('allows play once the cooldown has elapsed', () => {
    const last = new Date('2026-10-06T06:00:00Z'); // 54h ago
    const e = checkScratchEligibility(
      user({ lastScratchedAt: last }),
      config({ cooldownHours: 24 })
    );
    expect(e.canPlay).toBe(true);
    expect(e.cooldownActive).toBe(false);
  });

  it('accepts an ISO string timestamp from the DB', () => {
    const e = checkScratchEligibility(
      user({ lastScratchedAt: '2026-10-08T11:00:00.000Z' }),
      config({ cooldownHours: 24 })
    );
    expect(e.cooldownActive).toBe(true);
    expect(e.canPlay).toBe(false);
  });

  it('requires a signed-in rider', () => {
    const e = checkScratchEligibility(null, config());
    expect(e.canPlay).toBe(false);
    expect(e.reason).toContain('sign in');
  });

  it('ignores cooldown when cooldownHours is 0', () => {
    const e = checkScratchEligibility(
      user({ lastScratchedAt: new Date('2026-10-08T11:59:00Z') }),
      config({ cooldownHours: 0 })
    );
    expect(e.canPlay).toBe(true);
  });
});
