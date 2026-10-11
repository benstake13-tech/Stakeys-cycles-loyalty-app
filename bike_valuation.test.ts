import { describe, it, expect, beforeEach } from 'vitest';

// The price book mirrors to Supabase in the background; keep it offline.
import { vi } from 'vitest';
vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

import { valueBike, matchOfferEntry, resolveCondition } from './src/utils/bikeValuation';
import type { OfferPriceEntry } from './src/context/OfferPriceBook';

const book: OfferPriceEntry[] = [
  { id: '1', brand: 'Trek', model: 'Marlin 5', category: 'cycle', basePrice: 200, updatedAt: 'x' },
  { id: '2', brand: 'Trek', model: '', category: 'cycle', basePrice: 150, updatedAt: 'x' },
  { id: '3', brand: '', model: '', category: 'cycle', basePrice: 90, updatedAt: 'x' },
  { id: '4', brand: '', model: '', category: 'ebike', basePrice: 220, updatedAt: 'x' },
];

beforeEach(() => {
  localStorage.clear();
});

describe('matchOfferEntry', () => {
  it('prefers an exact brand+model match', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Trek', model: 'Marlin 5', type: 'cycle' });
    expect(level).toBe('model');
    expect(entry?.basePrice).toBe(200);
  });

  it('falls back to the brand-wide price when the model is unknown', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Trek', model: 'FX 3', type: 'cycle' });
    expect(level).toBe('brand');
    expect(entry?.basePrice).toBe(150);
  });

  it('falls back to the category default for an unknown brand', () => {
    const { entry, level } = matchOfferEntry(book, { make: 'Raleigh', model: 'Pioneer', type: 'cycle' });
    expect(level).toBe('category');
    expect(entry?.basePrice).toBe(90);
  });

  it('matches brand and model case- and punctuation-insensitively', () => {
    const { level } = matchOfferEntry(book, { make: 'trek', model: 'marlin-5', type: 'cycle' });
    expect(level).toBe('model');
  });

  it('returns none when the book is empty', () => {
    const { entry, level } = matchOfferEntry([], { make: 'Trek', model: 'Marlin 5', type: 'cycle' });
    expect(level).toBe('none');
    expect(entry).toBeNull();
  });
});

describe('resolveCondition', () => {
  it('maps the AI condition to a customer condition', () => {
    expect(resolveCondition({ overallCondition: 'Critical' })).toBe('poor');
    expect(resolveCondition({ overallCondition: 'Excellent' })).toBe('excellent');
  });

  it('lets a declared condition win over the AI read', () => {
    expect(resolveCondition({ overallCondition: 'Excellent', declaredCondition: 'fair' })).toBe('fair');
  });

  it('defaults to good', () => {
    expect(resolveCondition({})).toBe('good');
  });
});

describe('valueBike', () => {
  it('applies the condition multiplier and rounds to £5', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', declaredCondition: 'excellent' }, book);
    // 200 * 1.15 = 230
    expect(v.offer).toBe(230);
    expect(v.basePrice).toBe(200);
    expect(v.matchLevel).toBe('model');
  });

  it('deducts for serious faults', () => {
    const clean = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle' }, book);
    const damaged = valueBike(
      { make: 'Trek', model: 'Marlin 5', type: 'cycle', faults: [{ severity: 'High' }, { severity: 'Critical safety risk' }] },
      book
    );
    expect(damaged.offer!).toBeLessThan(clean.offer!);
    expect(damaged.adjustments.some((a) => a.amount < 0)).toBe(true);
    expect(damaged.needsStaffReview).toBe(true);
  });

  it('returns no offer when the bike cannot be matched', () => {
    const v = valueBike({ make: 'Unknown / To Be Inspected', model: 'Unknown / To Be Inspected', type: 'cycle' }, [
      { id: 'x', brand: 'Trek', model: '', category: 'cycle', basePrice: 150, updatedAt: 'x' },
    ]);
    // Category fallback exists in the real seed book, but not here.
    expect(v.offer).toBeNull();
    expect(v.needsStaffReview).toBe(true);
    expect(v.rationale.join(' ')).toMatch(/price this bike by hand/i);
  });

  it('flags lower-confidence reads for staff review', () => {
    const v = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', confidence: 0.2, coverage: 0.3 }, book);
    expect(v.confidence).toBeLessThan(0.5);
    expect(v.needsStaffReview).toBe(true);
  });

  it('adds an uplift for an electric conversion of a normal bike', () => {
    const plain = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle' }, book);
    const electric = valueBike({ make: 'Trek', model: 'Marlin 5', type: 'cycle', electricKit: { isElectric: true } }, book);
    expect(electric.offer!).toBeGreaterThan(plain.offer!);
  });
});
