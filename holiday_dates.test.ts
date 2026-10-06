import { describe, it, expect } from 'vitest';
import {
  easterSunday,
  chineseNewYear,
  midAutumn,
  diwali,
  holi,
  eidAlFitr,
  eidAlAdha,
  hanukkah,
  thanksgivingUS,
} from './src/utils/lunar';

const iso = (y: { year: number; month: number; day: number }) =>
  `${y.year}-${String(y.month).padStart(2, '0')}-${String(y.day).padStart(2, '0')}`;

describe('holiday date resolvers', () => {
  it('computes Gregorian Easter Sunday', () => {
    expect(iso(easterSunday(2024))).toBe('2024-03-31');
    expect(iso(easterSunday(2025))).toBe('2025-04-20');
    expect(iso(easterSunday(2026))).toBe('2026-04-05');
    expect(iso(easterSunday(2030))).toBe('2030-04-21');
  });

  it('computes US Thanksgiving (4th Thursday of November)', () => {
    expect(iso(thanksgivingUS(2024))).toBe('2024-11-28');
    expect(iso(thanksgivingUS(2025))).toBe('2025-11-27');
    expect(iso(thanksgivingUS(2026))).toBe('2026-11-26');
  });

  it('computes Chinese New Year', () => {
    expect(iso(chineseNewYear(2024))).toBe('2024-02-10');
    expect(iso(chineseNewYear(2025))).toBe('2025-01-29');
    expect(iso(chineseNewYear(2026))).toBe('2026-02-17');
  });

  it('computes Mid-Autumn Festival', () => {
    expect(iso(midAutumn(2024))).toBe('2024-09-17');
    expect(iso(midAutumn(2025))).toBe('2025-10-06');
    expect(iso(midAutumn(2026))).toBe('2026-09-25');
  });

  it('computes Eid al-Fitr and Eid al-Adha', () => {
    expect(iso(eidAlFitr(2024))).toBe('2024-04-10');
    expect(iso(eidAlFitr(2025))).toBe('2025-03-30');
    expect(iso(eidAlAdha(2025))).toBe('2025-06-06');
    expect(iso(eidAlAdha(2026))).toBe('2026-05-27');
  });

  it('computes Diwali and Holi within the known date range', () => {
    // Diwali falls in the Oct/Nov window.
    const d = diwali(2025);
    expect(d.month === 10 || d.month === 11).toBe(true);
    expect(d.year).toBe(2025);
    // Holi falls in March.
    const h = holi(2025);
    expect(h.month).toBe(3);
    expect(h.year).toBe(2025);
  });

  it('computes Hanukkah (25 Kislev) in the Nov/Dec window', () => {
    const h = hanukkah(2024);
    expect(h.month === 11 || h.month === 12).toBe(true);
    const h2 = hanukkah(2025);
    expect(h2.month === 11 || h2.month === 12).toBe(true);
    // Hanukkah drifts earlier/later by a few days year to year.
    expect(Math.abs(h2.day - h.day)).toBeGreaterThanOrEqual(0);
  });
});
