import { describe, it, expect } from 'vitest';
import {
  memberActivity,
  featureUsage,
  mostEngagedMembers,
  promotionPerformance,
  promotionOverview,
  lastActivityAt,
} from './src/utils/engagementTracker';
import type {
  UserProfile,
  StampLog,
  ServiceBooking,
  ReferralRecord,
  PrizeDraw,
  DiscountCode,
  ShopPromotion,
} from './src/types/bikeShop';

const NOW = new Date(2026, 5, 15);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);

const user = (over: Partial<UserProfile>): UserProfile =>
  ({
    uid: over.uid || Math.random().toString(36).slice(2),
    email: 'a@b.c',
    role: 'customer',
    displayName: 'Rider',
    membershipNumber: 'STK-1',
    stamps: 0,
    tickets: 0,
    createdAt: daysAgo(1),
    ...over,
  } as UserProfile);

const booking = (over: Partial<ServiceBooking>): ServiceBooking =>
  ({
    id: over.id || Math.random().toString(36).slice(2),
    customerId: over.customerId || 'u1',
    customerName: 'Rider',
    status: 'pending',
    createdAt: NOW.toISOString(),
    ...over,
  } as ServiceBooking);

describe('memberActivity', () => {
  it('splits active vs dormant by the last 30 days of activity', () => {
    const users = [
      user({ uid: 'a', lastStampedAt: daysAgo(2) }),
      user({ uid: 'b', lastSpunAt: daysAgo(10) }),
      user({ uid: 'c', createdAt: daysAgo(60), lastStampedAt: daysAgo(45) }),
      user({ uid: 'staff', role: 'staff' }),
    ];
    const a = memberActivity(users, NOW);
    expect(a.totalMembers).toBe(3); // staff excluded
    expect(a.active30d).toBe(2);
    expect(a.dormant30d).toBe(1);
  });

  it('counts never-visited members and recent signups', () => {
    const users = [
      user({ uid: 'a', stamps: 0 }),
      user({ uid: 'b', stamps: 4, lastStampedAt: daysAgo(1) }),
      user({ uid: 'c', createdAt: daysAgo(5) }),
    ];
    const a = memberActivity(users, NOW);
    expect(a.neverVisited).toBe(2); // a + c (both no stamps / never stamped)
    expect(a.joined30d).toBe(3);
  });
});

describe('lastActivityAt', () => {
  it('takes the most recent of stamped, spun and created', () => {
    const u = user({ createdAt: daysAgo(30), lastStampedAt: daysAgo(3), lastSpunAt: daysAgo(8) });
    expect(lastActivityAt(u)).toBe(daysAgo(3).getTime());
  });
});

describe('featureUsage', () => {
  it('measures adoption per feature and sorts by members', () => {
    const users = [
      user({ uid: 'a', bikes: [{ id: 'b1' } as any], lastSpunAt: daysAgo(1) }),
      user({ uid: 'b' }),
      user({ uid: 'c' }),
    ];
    const rows = featureUsage({
      users,
      bookings: [booking({ customerId: 'a', status: 'completed' })],
      draws: [{ id: 'd1', winnerUid: 'a' } as PrizeDraw],
      stampLogs: [{ id: 's1', customerId: 'a', action: 'add_stamp' } as StampLog],
    });
    const garage = rows.find((r) => r.id === 'garage')!;
    expect(garage.users).toBe(1);
    expect(garage.adoptionPct).toBe(33);
    // sorted desc by users → garage/booking/repairs/stamps/wheel (all 1) ahead of refer (0)
    expect(rows[rows.length - 1].id).toBe('refer');
  });

  it('never divides by zero when there are no members', () => {
    const rows = featureUsage({});
    expect(rows.every((r) => r.adoptionPct === 0)).toBe(true);
  });
});

describe('mostEngagedMembers', () => {
  it('orders by stamps, then points, and counts bookings', () => {
    const users = [
      user({ uid: 'a', displayName: 'Ada', stamps: 5, points: 10 }),
      user({ uid: 'b', displayName: 'Ben', stamps: 9, points: 1 }),
      user({ uid: 'c', displayName: 'Cleo', stamps: 5, points: 40 }),
    ];
    const rows = mostEngagedMembers(users, [booking({ customerId: 'b' }), booking({ customerId: 'b' })], 5);
    expect(rows[0].name).toBe('Ben');
    expect(rows[0].bookings).toBe(2);
    expect(rows[1].name).toBe('Cleo'); // 5 stamps but 40 points beats Ada
  });
});

describe('promotionPerformance / promotionOverview', () => {
  const code = (over: Partial<DiscountCode>): DiscountCode =>
    ({ id: over.id || 'c1', code: 'STK-X', title: 'Offer', type: 'percent', value: 10, status: 'active', createdAt: '2026-01-01', timesUsed: 0, eligibleCategories: [], ...over } as DiscountCode);

  it('ranks coupons by usage and computes redemption share', () => {
    const perf = promotionPerformance([
      code({ code: 'A', timesUsed: 2, usageLimit: 10 }),
      code({ code: 'B', timesUsed: 7, usageLimit: 10 }),
    ]);
    expect(perf[0].code).toBe('B');
    expect(perf[0].redemptionPct).toBe(70);
  });

  it('summarises promotion statuses and total redemptions', () => {
    const promos = [
      { status: 'active' } as ShopPromotion,
      { status: 'upcoming' } as ShopPromotion,
      { status: 'expired' } as ShopPromotion,
      { status: 'active' } as ShopPromotion,
    ];
    const overview = promotionOverview(promos, [code({ code: 'A', timesUsed: 3 })]);
    expect(overview.total).toBe(4);
    expect(overview.active).toBe(2);
    expect(overview.totalRedemptions).toBe(3);
    expect(overview.top?.code).toBe('A');
  });

  it('reports no top coupon when nothing has redeemed', () => {
    expect(promotionOverview([], [code({ timesUsed: 0 })]).top).toBeNull();
  });
});
