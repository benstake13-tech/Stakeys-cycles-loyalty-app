import { describe, it, expect } from 'vitest';
import {
  seasonOf,
  weatherStats,
  demandSignals,
  baseSeasonSignals,
  signalHeadline,
} from './src/utils/repairWeatherModel';
import type { DailyWeather, WeatherReport } from './src/utils/weatherService';

/** Minimal DailyWeather factory — only the fields the model reads matter. */
const day = (over: Partial<DailyWeather>): DailyWeather =>
  ({
    date: '2026-01-01',
    weekday: 'Mon',
    weatherCode: 0,
    kind: 'clear',
    label: 'Clear',
    tempMax: 15,
    tempMin: 8,
    feelsLikeMax: 15,
    feelsLikeMin: 8,
    precipProb: 0,
    precipMm: 0,
    windMaxKph: 5,
    windGustKph: 10,
    windDir: 180,
    uvMax: 3,
    daylightSeconds: 40000,
    sunshineSeconds: 30000,
    sunrise: '08:00',
    sunset: '16:00',
    moon: { phase: 0.5, name: 'Full Moon', illumination: 1, emoji: '🌕' },
    ...over,
  }) as DailyWeather;

const report = (days: DailyWeather[]): WeatherReport =>
  ({ days, location: { latitude: 0, longitude: 0, label: 'x', source: 'default' }, synthetic: true } as unknown as WeatherReport);

const wet = (n: number) => Array.from({ length: n }, () => day({ kind: 'rain', label: 'Rain', precipMm: 6, precipProb: 80 }));
const cold = (n: number) => Array.from({ length: n }, () => day({ tempMin: -1, feelsLikeMin: -3 }));

describe('seasonOf', () => {
  it('maps months to meteorological seasons', () => {
    expect(seasonOf(1)).toBe('winter'); // Feb
    expect(seasonOf(4)).toBe('spring'); // May
    expect(seasonOf(6)).toBe('summer'); // Jul
    expect(seasonOf(9)).toBe('autumn'); // Oct
    expect(seasonOf(11)).toBe('winter'); // Dec
  });
});

describe('weatherStats', () => {
  it('counts wet, cold, frost, hot and dry-mild days', () => {
    const s = weatherStats([
      ...wet(3),
      ...cold(2),
      day({ tempMax: 30, uvMax: 8 }),
      day({ tempMax: 16, precipMm: 0, precipProb: 0 }),
    ]);
    expect(s.rainyDays).toBe(3);
    expect(s.coldDays).toBe(2);
    expect(s.frostDays).toBe(2);
    expect(s.hotDays).toBe(1);
    expect(s.dryMildDays).toBeGreaterThanOrEqual(1);
  });
});

describe('demandSignals', () => {
  it('returns an empty-safe result for no data (base season only)', () => {
    const signals = demandSignals(null, new Date(2026, 0, 15)); // Jan → winter
    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].id).toBe('season-winter');
  });

  it('raises puncture pressure from a wet spell', () => {
    const signals = demandSignals(report(wet(5)), new Date(2026, 5, 15)); // summer
    const punctures = signals.find((s) => s.id === 'rain-punctures');
    expect(punctures).toBeTruthy();
    expect(punctures!.direction).toBe('up');
    expect(punctures!.estimatedUpliftPct).toBeGreaterThan(0);
    expect(punctures!.reason).toMatch(/wet/i);
  });

  it('raises e-bike and e-scooter battery pressure from a cold snap', () => {
    const signals = demandSignals(report(cold(4)), new Date(2026, 11, 10)); // winter
    expect(signals.some((s) => s.id === 'cold-battery-ebike' && s.category === 'ebike')).toBe(true);
    expect(signals.some((s) => s.id === 'cold-battery-scooter' && s.category === 'electric_scooter')).toBe(true);
  });

  it('raises riding/service demand from a hot spell', () => {
    const signals = demandSignals(
      report(Array.from({ length: 5 }, () => day({ tempMax: 30, uvMax: 8 }))),
      new Date(2026, 6, 15) // July
    );
    expect(signals.some((s) => s.id === 'heat-riders')).toBe(true);
  });

  it('ranks signals strongest-first and never returns an empty list', () => {
    const signals = demandSignals(report([...wet(6), ...cold(3)]), new Date(2026, 0, 10));
    expect(signals.length).toBeGreaterThan(0);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].estimatedUpliftPct).toBeGreaterThanOrEqual(signals[i].estimatedUpliftPct);
    }
  });
});

describe('baseSeasonSignals + signalHeadline', () => {
  it('gives every season a fallback signal', () => {
    for (const season of ['winter', 'spring', 'summer', 'autumn'] as const) {
      const s = baseSeasonSignals(season);
      expect(s.length).toBe(1);
      expect(s[0].estimatedUpliftPct).toBeGreaterThan(0);
    }
  });

  it('summarises the top signal', () => {
    const signals = demandSignals(report(wet(5)), new Date(2026, 5, 15));
    expect(signalHeadline(signals, new Date(2026, 5, 15))).toMatch(/% .+\./);
  });
});
