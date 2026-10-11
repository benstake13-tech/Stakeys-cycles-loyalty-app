import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Covers the two-way sync of the staff "Sell Your Bike" price book: staff edits
 * are pushed to `app_settings` and hydrated back on every surface, so a price
 * set in the terminal actually reaches the customer's valuation.
 *
 * The Supabase client is a small stateful fake: `h.row` is the shared settings
 * row, `h.updates` records what the store wrote back.
 */
const h = vi.hoisted(() => ({
  row: { sell_offerbook_json: null, sell_condition_bands_json: null } as Record<string, any>,
  selectError: null as null | { message: string },
  updates: [] as any[],
}));

vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            h.selectError ? { error: h.selectError, data: null } : { error: null, data: h.row },
        }),
      }),
      update: (payload: any) => {
        h.updates.push(payload);
        Object.assign(h.row, payload);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

/** Fresh module graph so the store's once-per-session caches are reset. */
async function fresh() {
  vi.resetModules();
  return import('./src/context/OfferPriceBook');
}

beforeEach(() => {
  localStorage.clear();
  h.row = { sell_offerbook_json: null, sell_condition_bands_json: null };
  h.selectError = null;
  h.updates = [];
});

describe('OfferPriceBook — Supabase sync', () => {
  it('hydrates the price book from the server', async () => {
    h.row.sell_offerbook_json = [
      { id: 'srv-1', brand: 'Trek', model: 'Domane', category: 'cycle', basePrice: 250, updatedAt: '2030-01-01T00:00:00.000Z' },
    ];
    const store = await fresh();
    await store.syncOfferPricesFromSupabase(true);

    const prices = store.getOfferPrices();
    expect(prices).toHaveLength(1);
    expect(prices[0].id).toBe('srv-1');
    expect(prices[0].basePrice).toBe(250);
  });

  it('keeps a newer local edit and pushes it to the server instead of overwriting it', async () => {
    h.row.sell_offerbook_json = [
      { id: 'srv-1', brand: 'Trek', model: '', category: 'cycle', basePrice: 250, updatedAt: '2020-01-01T00:00:00.000Z' },
    ];
    const store = await fresh();
    store.upsertOfferPrice({ brand: 'Giant', model: '', category: 'cycle', basePrice: 999 });
    h.updates.length = 0;

    await store.syncOfferPricesFromSupabase(true);

    const prices = store.getOfferPrices();
    expect(prices.some((e) => e.brand === 'Giant' && e.basePrice === 999)).toBe(true);
    expect(prices.some((e) => e.id === 'srv-1')).toBe(false);
    expect(h.updates.some((u) => Array.isArray(u.sell_offerbook_json))).toBe(true);
  });

  it('stays local-only (no throw) when the column does not exist', async () => {
    h.selectError = { message: 'column app_settings.sell_offerbook_json does not exist' };
    const store = await fresh();

    const ok = await store.syncOfferPricesFromSupabase(true);

    expect(ok).toBe(false);
    expect(store.getOfferPrices().length).toBeGreaterThan(0); // seeded defaults
  });

  it('hydrates condition bands from a wrapped payload', async () => {
    h.row.sell_condition_bands_json = {
      bands: { excellent: 1.5, good: 1, fair: 0.5, poor: 0.25 },
      updatedAt: '2030-01-01T00:00:00.000Z',
    };
    const store = await fresh();

    await store.syncOfferBandsFromSupabase(true);

    const b = store.getOfferConditionBands();
    expect(b.excellent).toBeCloseTo(1.5);
    expect(b.poor).toBeCloseTo(0.25);
  });

  it('accepts a bare (unwrapped) bands object for back-compat', async () => {
    h.row.sell_condition_bands_json = { excellent: 2, good: 1, fair: 0.5, poor: 0.2 };
    const store = await fresh();

    await store.syncOfferBandsFromSupabase(true);

    expect(store.getOfferConditionBands().excellent).toBeCloseTo(2);
  });

  it('keeps newer local condition bands over an older server copy', async () => {
    h.row.sell_condition_bands_json = {
      bands: { excellent: 9, good: 9, fair: 9, poor: 9 },
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    const store = await fresh();
    store.setOfferConditionBands({ excellent: 1.2, good: 1, fair: 0.6, poor: 0.3 });

    await store.syncOfferBandsFromSupabase(true);

    expect(store.getOfferConditionBands().excellent).toBeCloseTo(1.2);
  });
});
