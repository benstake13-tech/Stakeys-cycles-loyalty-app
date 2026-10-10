import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UserProfile, CustomerBike, CollectedVoucher } from './src/types/bikeShop';
import { buildRewardNudges, voucherExpiry, daysUntil, NUDGE_EXPIRY_DAYS } from './src/utils/rewardNudges';
import { buildCareSchedule, overallCareStatus, careItemsFor, isElectric } from './src/utils/bikeCare';

// The stores touch Supabase in the background; keep them fully offline.
vi.mock('./src/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }) }) },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

const NOW = new Date('2026-06-15T12:00:00Z');

function member(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'u1',
    email: 'r@x.com',
    role: 'customer',
    displayName: 'Rider',
    membershipNumber: 'STK-1',
    stamps: 0,
    tickets: 0,
    createdAt: '2026-01-01',
    ...overrides,
  } as UserProfile;
}

function voucher(overrides: Partial<CollectedVoucher> = {}): CollectedVoucher {
  return {
    id: 'v1',
    code: 'C',
    title: '£40 Service Voucher',
    description: '',
    value: 40,
    type: 'service_credit',
    terms: '',
    claimedAt: '2026-01-01',
    status: 'available',
    ...overrides,
  } as CollectedVoucher;
}

function bike(overrides: Partial<CustomerBike> = {}): CustomerBike {
  return {
    id: 'b1',
    category: 'cycle',
    categoryLabel: 'Standard Bicycle',
    brand: 'Trek',
    model: 'Marlin',
    addedAt: '2026-01-01',
    ...overrides,
  } as CustomerBike;
}

describe('rewardNudges', () => {
  it('nudges when the customer is within two stamps of a full card', () => {
    const nudges = buildRewardNudges(member({ stamps: 8 }), NOW);
    expect(nudges.some((n) => n.id === 'stamps-almost')).toBe(true);
    expect(nudges.find((n) => n.id === 'stamps-almost')?.target).toBe('stamps');
  });

  it('does not nudge on stamps when there is still a long way to go', () => {
    const nudges = buildRewardNudges(member({ stamps: 5 }), NOW);
    expect(nudges.some((n) => n.id === 'stamps-almost')).toBe(false);
  });

  it('flags a voucher expiring within the window as amber', () => {
    // Claimed 11 months ago -> expires in ~1 month.
    const v = voucher({ claimedAt: '2025-07-15' });
    const nudges = buildRewardNudges(member({ serviceVouchers: [v] }), NOW);
    const expiring = nudges.find((n) => n.id === `voucher-expiring-${v.id}`);
    expect(expiring).toBeTruthy();
    expect(expiring?.tone).toBe('amber');
    expect(expiring?.target).toBe('wallet');
  });

  it('flags an already-expired voucher as rose and sorts it first', () => {
    const v = voucher({ claimedAt: '2024-01-01' });
    const nudges = buildRewardNudges(member({ stamps: 9, serviceVouchers: [v] }), NOW);
    expect(nudges[0].id).toBe(`voucher-expired-${v.id}`);
    expect(nudges[0].tone).toBe('rose');
  });

  it('surfaces earned referral credit', () => {
    const nudges = buildRewardNudges(
      member({
        referralRewards: [
          { id: 'r1', amount: 5, status: 'earned', friendName: 'Sam', earnedAt: '2026-05-01' },
          { id: 'r2', amount: 5, status: 'pending', friendName: 'Ali', earnedAt: '2026-05-02' },
        ],
      }),
      NOW
    );
    const ref = nudges.find((n) => n.id === 'referral-credit-unused');
    expect(ref).toBeTruthy();
    // Only the *earned* £5 counts, not the pending one.
    expect(ref?.title).toContain('£5');
  });

  it('returns nothing for a brand-new member', () => {
    expect(buildRewardNudges(member(), NOW)).toEqual([]);
  });

  it('handles a null user safely', () => {
    expect(buildRewardNudges(null, NOW)).toEqual([]);
  });

  it('computes voucher expiry as claimedAt + 12 months', () => {
    const expiry = voucherExpiry(voucher({ claimedAt: '2026-01-31' }));
    expect(expiry?.getFullYear()).toBe(2027);
    expect(expiry?.getMonth()).toBe(0); // January
    expect(expiry?.getDate()).toBe(31);
  });

  it('daysUntil is negative for a past date', () => {
    expect(daysUntil(new Date('2026-06-14T12:00:00Z'), NOW)).toBeLessThan(0);
    expect(NUDGE_EXPIRY_DAYS).toBe(30);
  });
});

describe('bikeCare', () => {
  it('treats e-bikes and e-scooters as electric', () => {
    expect(isElectric('ebike')).toBe(true);
    expect(isElectric('electric_scooter')).toBe(true);
    expect(isElectric('cycle')).toBe(false);
  });

  it('adds a battery/motor check only for electric bikes', () => {
    expect(careItemsFor(bike({ category: 'ebike' })).some((i) => i.id === 'electrical')).toBe(true);
    expect(careItemsFor(bike({ category: 'cycle' })).some((i) => i.id === 'electrical')).toBe(false);
  });

  it('reports every item as unknown without service history', () => {
    const entries = buildCareSchedule(bike(), NOW);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.status === 'unknown')).toBe(true);
    expect(overallCareStatus(entries)).toBe('unknown');
  });

  it('anchors the 6-month items and marks them overdue after 7 months', () => {
    const entries = buildCareSchedule(bike({ lastServiceDate: '2025-11-15' }), NOW);
    const brakes = entries.find((e) => e.id === 'brakes')!;
    expect(brakes.status).toBe('overdue');
    expect(brakes.dueDate?.toISOString().slice(0, 7)).toBe('2026-05');
    expect(overallCareStatus(entries)).toBe('overdue');
  });

  it('marks items due within 30 days as due', () => {
    // 6-month interval; last serviced 5 months + 20 days ago -> ~10 days out.
    const entries = buildCareSchedule(bike({ lastServiceDate: '2025-12-25' }), NOW);
    const brakes = entries.find((e) => e.id === 'brakes')!;
    expect(brakes.status).toBe('due');
    expect(overallCareStatus(entries)).toBe('due');
  });

  it('reports ok when recently serviced', () => {
    const entries = buildCareSchedule(bike({ lastServiceDate: '2026-06-01' }), NOW);
    expect(overallCareStatus(entries)).toBe('ok');
  });
});

describe('WishlistStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('adds, detects and removes watched items', async () => {
    const store = await import('./src/context/WishlistStore');
    expect(store.getWishlist()).toEqual([]);
    store.addToWishlist({ productId: 'p1', title: 'Helmet', stockAtWatch: 0 });
    expect(store.isWatched('p1')).toBe(true);
    // Adding the same product twice is a no-op.
    store.addToWishlist({ productId: 'p1', title: 'Helmet', stockAtWatch: 0 });
    expect(store.getWishlist()).toHaveLength(1);
    store.removeFromWishlist('p1');
    expect(store.getWishlist()).toEqual([]);
  });

  it('toggles a product on and off', async () => {
    const store = await import('./src/context/WishlistStore');
    expect(store.toggleWishlist({ productId: 'p2', title: 'Light', stockAtWatch: 3 })).toBe(true);
    expect(store.isWatched('p2')).toBe(true);
    expect(store.toggleWishlist({ productId: 'p2', title: 'Light', stockAtWatch: 3 })).toBe(false);
    expect(store.isWatched('p2')).toBe(false);
  });

  it('detects items that came back in stock', async () => {
    const store = await import('./src/context/WishlistStore');
    store.addToWishlist({ productId: 'p3', title: 'Pump', stockAtWatch: 0 });
    store.addToWishlist({ productId: 'p4', title: 'Lock', stockAtWatch: 0 });
    const back = store.backInStockItems({ p3: 5, p4: 0 });
    expect(back.map((b) => b.productId)).toEqual(['p3']);
  });

  it('persists across a module reload', async () => {
    let store = await import('./src/context/WishlistStore');
    store.addToWishlist({ productId: 'p5', title: 'Saddle', stockAtWatch: 1 });
    vi.resetModules();
    store = await import('./src/context/WishlistStore');
    expect(store.isWatched('p5')).toBe(true);
  });
});

describe('TradeInStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('submits a request with a new status and timestamp', async () => {
    const store = await import('./src/context/TradeInStore');
    const entry = store.submitTradeInRequest({
      customerName: 'Ada',
      customerEmail: 'ada@x.com',
      brand: 'Giant',
      model: 'Escape 3',
      condition: 'good',
    });
    expect(entry.status).toBe('new');
    expect(entry.id).toMatch(/^ti-/);
    expect(store.getTradeInRequests()).toHaveLength(1);
  });

  it('moves a lead through statuses and deletes it', async () => {
    const store = await import('./src/context/TradeInStore');
    const entry = store.submitTradeInRequest({
      customerName: 'Ada',
      customerEmail: 'ada@x.com',
      brand: 'Giant',
      model: 'Escape 3',
      condition: 'good',
    });
    store.updateTradeInStatus(entry.id, 'valued');
    expect(store.getTradeInRequests()[0].status).toBe('valued');
    store.deleteTradeInRequest(entry.id);
    expect(store.getTradeInRequests()).toEqual([]);
  });
});
