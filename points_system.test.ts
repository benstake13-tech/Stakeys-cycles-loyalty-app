import { describe, it, expect, vi, beforeEach } from 'vitest';

// Serve prize_wheels rows straight from the mock so we can exercise the
// merits->points read-normalisation without a live database.
const hoisted = vi.hoisted(() => ({ wheelRows: [] as any[] }));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: hoisted.wheelRows, error: null }),
      }),
    }),
  }),
}));

import { fetchPrizeWheelsFromDb } from './src/api/backendDataService';

beforeEach(() => {
  hoisted.wheelRows = [];
});

describe('prize wheel points normalisation', () => {
  it("upgrades a legacy 'merit' segment to 'points' on read", async () => {
    hoisted.wheelRows = [
      {
        id: 'w1',
        title: 'Wheel',
        is_active: true,
        ticket_cost: 0,
        segments: [
          { id: 'seg-points-50', label: '+50 Store Points', rewardType: 'merit', rewardValue: '50 Bonus Loyalty Points' },
          { id: 'seg-stamp-1', label: '+1 Stamp', rewardType: 'stamp', stampsAmount: 1 },
        ],
      },
    ];
    const [wheel] = await fetchPrizeWheelsFromDb();
    expect(wheel.segments[0].rewardType).toBe('points');
    // Untouched segments keep their type.
    expect(wheel.segments[1].rewardType).toBe('stamp');
  });

  it('leaves already-migrated points segments alone', async () => {
    hoisted.wheelRows = [
      { id: 'w2', title: 'Wheel', is_active: true, segments: [{ id: 's', rewardType: 'points', rewardValue: '50' }] },
    ];
    const [wheel] = await fetchPrizeWheelsFromDb();
    expect(wheel.segments[0].rewardType).toBe('points');
  });

  it('returns an empty segment list for a malformed row', async () => {
    hoisted.wheelRows = [{ id: 'w3', title: 'Wheel', segments: null }];
    const [wheel] = await fetchPrizeWheelsFromDb();
    expect(wheel.segments).toEqual([]);
  });
});
