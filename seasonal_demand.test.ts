import { describe, it, expect } from 'vitest';
import { partsForSignal, partsForSeason, seasonalDemand } from './src/utils/seasonalDemand';
import { demandSignals } from './src/utils/repairWeatherModel';
import { systemForComponent } from './src/utils/bikeSpecTaxonomy';
import type { DailyWeather, WeatherReport } from './src/utils/weatherService';

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

describe('partsForSignal', () => {
  it('maps the rain signal to taxonomy parts with owners and offers', () => {
    const signal = demandSignals(report(wet(5)), new Date(2026, 5, 15)).find((s) => s.id === 'rain-punctures')!;
    const parts = partsForSignal(signal);
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.offer.length).toBeGreaterThan(0);
      expect(systemForComponent(p.componentId)).toBeTruthy();
      expect(p.systemId).toBe(systemForComponent(p.componentId)!.id);
    }
  });

  it('returns nothing for an unknown signal id', () => {
    expect(partsForSignal({ id: 'nope', category: 'cycle', issue: 'x', direction: 'up', magnitude: 0, estimatedUpliftPct: 0, reason: '' })).toEqual([]);
  });
});

describe('partsForSeason', () => {
  it('gives every season a sensible part list', () => {
    for (const season of ['winter', 'spring', 'summer', 'autumn'] as const) {
      const parts = partsForSeason(season);
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.every((p) => !!systemForComponent(p.componentId))).toBe(true);
    }
  });
});

describe('seasonalDemand', () => {
  it('returns ranked signals plus deduped parts, falling back to the season model', () => {
    const view = seasonalDemand(null, new Date(2026, 0, 10)); // winter, no weather
    expect(view.season).toBe('winter');
    expect(view.signals.length).toBeGreaterThan(0);
    expect(view.parts.length).toBeGreaterThan(0);
    const ids = view.parts.map((p) => p.componentId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it('uses the live weather when available', () => {
    const view = seasonalDemand(report(wet(6)), new Date(2026, 5, 15));
    expect(view.signals.some((s) => s.id === 'rain-punctures')).toBe(true);
    expect(view.parts.some((p) => p.componentId === 'rear-tyre')).toBe(true);
  });
});
