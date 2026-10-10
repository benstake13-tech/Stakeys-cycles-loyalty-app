import { describe, it, expect } from 'vitest';
import { parseUnitPrice, billableUnitPrice } from './src/utils/websitePrices';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

describe('parseUnitPrice', () => {
  it('reads a clean single figure', () => {
    expect(parseUnitPrice('£10')).toBe(10);
    expect(parseUnitPrice('£40')).toBe(40);
    expect(parseUnitPrice('£12.50')).toBe(12.5);
  });

  it('refuses a range so a range is never mis-billed', () => {
    expect(parseUnitPrice('£15 – £40')).toBeUndefined();
    expect(parseUnitPrice('£60 – £90+')).toBeUndefined();
  });

  it('refuses multi-option / "per" / ambiguous prices', () => {
    expect(parseUnitPrice('£25 or £40 for the set')).toBeUndefined();
    expect(parseUnitPrice('£10 – £20')).toBeUndefined();
    expect(parseUnitPrice('£5 per item')).toBeUndefined();
    expect(parseUnitPrice('£60 adult / £30 child’s (without gears)')).toBeUndefined();
    expect(parseUnitPrice('£20 (standard) / £30 (electric)')).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(parseUnitPrice(undefined)).toBeUndefined();
    expect(parseUnitPrice('')).toBeUndefined();
  });
});

describe('billableUnitPrice', () => {
  it('prefers an explicit unitPrice over the display string', () => {
    expect(billableUnitPrice({ price: '£15 – £40', unitPrice: 22 })).toBe(22);
  });

  it('falls back to parsing a clean display price', () => {
    expect(billableUnitPrice({ price: '£33' })).toBe(33);
  });

  it('returns undefined for an ambiguous price with no explicit figure', () => {
    expect(billableUnitPrice({ price: '£15 – £40' })).toBeUndefined();
  });
});

describe('default price list carries billable figures where the string is clean', () => {
  it('every clean single-figure row exposes a numeric unit price', () => {
    const clean = DEFAULT_WEBSITE_CONTENT.priceList.filter((r) => parseUnitPrice(r.price) !== undefined);
    expect(clean.length).toBeGreaterThan(20);
    for (const row of clean) expect(billableUnitPrice(row)).toBe(parseUnitPrice(row.price));
  });

  it('ambiguous rows stay billable only when staff supplied a figure', () => {
    const ambiguous = DEFAULT_WEBSITE_CONTENT.priceList.filter((r) => parseUnitPrice(r.price) === undefined);
    for (const row of ambiguous) expect(row.unitPrice).toBeUndefined();
  });
});
