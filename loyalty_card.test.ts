import { describe, it, expect } from 'vitest';
import {
  STAMPS_PER_CARD,
  toDate,
  isSameCalendarDay,
  stampEligibility,
  canStampToday,
  addVisitStamp,
  adjustStamps,
  collectFullCard,
  buildServiceVoucher,
} from './src/utils/loyaltyCard';

describe('toDate', () => {
  it('passes Date through and parses ISO strings', () => {
    const d = new Date('2026-10-03T10:00:00Z');
    expect(toDate(d)?.getTime()).toBe(d.getTime());
    expect(toDate('2026-10-03T10:00:00Z')?.getTime()).toBe(d.getTime());
  });

  it('unwraps Firestore-style Timestamps and rejects junk', () => {
    const d = new Date('2026-10-03T10:00:00Z');
    expect(toDate({ toDate: () => d })?.getTime()).toBe(d.getTime());
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('not-a-date')).toBeNull();
    expect(toDate(new Date('nope'))).toBeNull();
  });
});

describe('stampEligibility', () => {
  const now = new Date('2026-10-03T15:00:00');

  it('allows a stamp when never stamped', () => {
    expect(stampEligibility(null, now).allowed).toBe(true);
    expect(canStampToday(undefined, now)).toBe(true);
  });

  it('blocks a second stamp on the same calendar day', () => {
    const last = new Date('2026-10-03T09:00:00');
    const res = stampEligibility(last, now);
    expect(res.allowed).toBe(false);
    expect(res.nextAllowedAt?.getDate()).toBe(4);
    expect(res.nextAllowedAt?.getHours()).toBe(0);
  });

  it('allows a stamp the next day', () => {
    expect(stampEligibility(new Date('2026-10-02T23:59:00'), now).allowed).toBe(true);
  });
});

describe('addVisitStamp', () => {
  it('increments without ever resetting the card', () => {
    expect(addVisitStamp(0)).toEqual({ stampsBefore: 0, stampsAfter: 1, cardReady: false });
    expect(addVisitStamp(9)).toEqual({ stampsBefore: 9, stampsAfter: 10, cardReady: true });
  });

  it('keeps counting past a full card instead of wiping it', () => {
    expect(addVisitStamp(10)).toEqual({ stampsBefore: 10, stampsAfter: 11, cardReady: true });
  });

  it('coerces garbage to 0', () => {
    expect(addVisitStamp(undefined as any).stampsAfter).toBe(1);
    expect(addVisitStamp(NaN as any).stampsAfter).toBe(1);
  });
});

describe('adjustStamps', () => {
  it('applies a positive delta and clamps to the card size', () => {
    expect(adjustStamps(3, 2)).toMatchObject({ stampsBefore: 3, stampsAfter: 5, delta: 2 });
    expect(adjustStamps(9, 5).stampsAfter).toBe(STAMPS_PER_CARD);
  });

  it('never goes below zero', () => {
    expect(adjustStamps(1, -5)).toMatchObject({ stampsAfter: 0, delta: -1 });
    expect(adjustStamps(0, -1).stampsAfter).toBe(0);
  });

  it('does not mint tickets (delta is pure stamp movement)', () => {
    expect(adjustStamps(9, 1).cardReady).toBe(true);
  });
});

describe('collectFullCard', () => {
  it('refuses to collect when the card is not full', () => {
    expect(collectFullCard(9)).toEqual({ stampsBefore: 9, stampsAfter: 9, cardsCollected: 0 });
  });

  it('subtracts exactly one card and rolls the remainder over', () => {
    expect(collectFullCard(10)).toEqual({ stampsBefore: 10, stampsAfter: 0, cardsCollected: 1 });
    expect(collectFullCard(12)).toEqual({ stampsBefore: 12, stampsAfter: 2, cardsCollected: 1 });
    expect(collectFullCard(23)).toEqual({ stampsBefore: 23, stampsAfter: 3, cardsCollected: 2 });
  });
});

describe('buildServiceVoucher', () => {
  it('mints an available £40 service voucher', () => {
    const now = new Date('2026-10-03T12:00:00Z');
    const v = buildServiceVoucher(now);
    expect(v.type).toBe('service_credit');
    expect(v.value).toBe(40);
    expect(v.status).toBe('available');
    expect(v.code).toMatch(/^STK-SRV40-\d{6}$/);
    expect(v.claimedAt).toBe(now);
  });
});
