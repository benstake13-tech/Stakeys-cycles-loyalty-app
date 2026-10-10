/**
 * Deterministic weather → workshop-demand model.
 *
 * Turns an Open-Meteo report (or a plain slice of daily readings) into ranked
 * "pressure" signals: what a run of weather is likely to do to repair demand
 * for cycles, e-bikes and e-scooters. Pure and network-free so the promotions
 * planner can read the forecast even with no AI and no connectivity.
 */
import type { DailyWeather, WeatherReport } from './weatherService';
import type { VehicleCategory } from '../types/bikeShop';

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface DemandSignal {
  /** Stable id, also used as a React key. */
  id: string;
  category: VehicleCategory;
  /** Short label, e.g. "Punctures & tyre damage". */
  issue: string;
  /** Taxonomy system the work lands in (see bikeSpecTaxonomy), when relevant. */
  systemId?: string;
  direction: 'up' | 'down';
  /** Relative pressure, 0..1. */
  magnitude: number;
  /** Best-effort demand uplift, in percent. */
  estimatedUpliftPct: number;
  /** Why this signal fired, in one plain sentence. */
  reason: string;
}

const DAY_MS = 86_400_000;

/** Meteorological season for a 0-based month. */
export function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

interface WeatherStats {
  days: number;
  rainyDays: number;
  frostDays: number;
  coldDays: number;
  hotDays: number;
  dryMildDays: number;
  totalPrecipMm: number;
}

/** Aggregates the daily readings into the handful of counts the rules use. */
export function weatherStats(days: DailyWeather[]): WeatherStats {
  const stats: WeatherStats = {
    days: days.length,
    rainyDays: 0,
    frostDays: 0,
    coldDays: 0,
    hotDays: 0,
    dryMildDays: 0,
    totalPrecipMm: 0,
  };
  for (const d of days) {
    const wet = d.precipMm >= 1 || d.precipProb >= 60 || /rain|drizzle|shower|storm|sleet|thunder/i.test(d.label);
    if (wet) stats.rainyDays += 1;
    stats.totalPrecipMm += d.precipMm || 0;
    const cold = Math.min(d.tempMin, d.feelsLikeMin) <= 2;
    if (cold) stats.coldDays += 1;
    if (Math.min(d.tempMin, d.feelsLikeMin) <= 0) stats.frostDays += 1;
    if (d.tempMax >= 25 || d.uvMax >= 7) stats.hotDays += 1;
    if (!wet && d.tempMax >= 10 && d.tempMax <= 22) stats.dryMildDays += 1;
  }
  return stats;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const pct = (magnitude: number, ceiling: number): number => Math.round(clamp01(magnitude) * ceiling);

/**
 * The heart of the model: apply the rules to the daily window + season and
 * return the ranked signals. Empty/degenerate input yields an empty list.
 */
export function demandSignals(
  report: WeatherReport | null | undefined,
  today: Date = new Date()
): DemandSignal[] {
  const days = report?.days || [];
  if (!days.length) return baseSeasonSignals(seasonOf(today.getMonth()));
  const s = weatherStats(days);
  const season = seasonOf(today.getMonth());
  const out: DemandSignal[] = [];
  const push = (sig: DemandSignal) => out.push(sig);

  if (s.rainyDays >= 2 || s.totalPrecipMm >= 10) {
    const mag = clamp01(s.rainyDays / Math.max(4, s.days));
    push({
      id: 'rain-punctures',
      category: 'cycle',
      issue: 'Punctures & tyre damage',
      systemId: 'wheels',
      direction: 'up',
      magnitude: mag,
      estimatedUpliftPct: pct(mag, 45),
      reason: `${s.rainyDays} wet ${s.rainyDays === 1 ? 'day' : 'days'} forecast — wet roads lift punctures, rim wear and tyre damage.`,
    });
  }

  if (s.rainyDays >= 4) {
    const mag = clamp01(s.rainyDays / s.days);
    push({
      id: 'rain-corrosion',
      category: 'cycle',
      issue: 'Chain, cable & bearing corrosion',
      systemId: 'drivetrain',
      direction: 'up',
      magnitude: mag,
      estimatedUpliftPct: pct(mag, 60),
      reason: `A sustained wet spell (${s.rainyDays}/${s.days} days) seizes chains, cables and bottom brackets.`,
    });
  }

  if (s.coldDays >= 2) {
    const mag = clamp01(s.coldDays / Math.max(3, s.days));
    push({
      id: 'cold-battery-ebike',
      category: 'ebike',
      issue: 'E-bike battery range & charging faults',
      systemId: 'electric',
      direction: 'up',
      magnitude: mag,
      estimatedUpliftPct: pct(mag, 55),
      reason: `Cold snap (${s.coldDays} cold days) reduces e-bike battery range and triggers charging faults.`,
    });
    push({
      id: 'cold-battery-scooter',
      category: 'electric_scooter',
      issue: 'E-scooter battery & controller faults',
      systemId: 'electric',
      direction: 'up',
      magnitude: mag * 0.9,
      estimatedUpliftPct: pct(mag * 0.9, 50),
      reason: `Cold weather cuts e-scooter range and stresses controllers and connectors.`,
    });
  }

  if (s.frostDays >= 1) {
    const mag = clamp01(s.frostDays / Math.max(2, s.days));
    push({
      id: 'frost-salt',
      category: 'cycle',
      issue: 'Salt & grit corrosion',
      systemId: 'frame',
      direction: 'up',
      magnitude: mag,
      estimatedUpliftPct: pct(mag, 40),
      reason: `${s.frostDays} frosty ${s.frostDays === 1 ? 'day' : 'days'} mean gritted roads — salt eats frames, rotors and fasteners.`,
    });
  }

  if (s.hotDays >= 2) {
    const mag = clamp01(s.hotDays / Math.max(3, s.days));
    push({
      id: 'heat-wear',
      category: 'cycle',
      issue: 'Tyres, brake pads & coolant wear',
      systemId: 'brakes',
      direction: 'up',
      magnitude: mag,
      estimatedUpliftPct: pct(mag, 35),
      reason: `Hot, high-UV days accelerate tyre and brake-pad wear and dry out seals.`,
    });
    push({
      id: 'heat-riders',
      category: 'ebike',
      issue: 'Peak-riding service & tune-ups',
      direction: 'up',
      magnitude: mag * 0.8,
      estimatedUpliftPct: pct(mag * 0.8, 30),
      reason: 'Warm, dry weather means more miles ridden and more bikes in for servicing.',
    });
  }

  if (s.dryMildDays >= 4 && s.coldDays === 0) {
    const mag = clamp01(s.dryMildDays / s.days);
    push({
      id: 'dry-mild-riding',
      category: 'cycle',
      issue: 'Accessories, lights & upgrades',
      systemId: 'accessories',
      direction: 'up',
      magnitude: mag * 0.7,
      estimatedUpliftPct: pct(mag * 0.7, 25),
      reason: `${s.dryMildDays} dry, mild days — riders are out and buying lights, locks and kit.`,
    });
  }

  const ranked = out.sort((a, b) => b.estimatedUpliftPct - a.estimatedUpliftPct);
  return ranked.length ? ranked : baseSeasonSignals(season);
}

/** A single low-key season signal used when the weather is unremarkable. */
export function baseSeasonSignals(season: Season): DemandSignal[] {
  switch (season) {
    case 'winter':
      return [
        {
          id: 'season-winter',
          category: 'ebike',
          issue: 'Winter lay-up & battery care',
          systemId: 'electric',
          direction: 'up',
          magnitude: 0.5,
          estimatedUpliftPct: 30,
          reason: 'Winter is battery-care and post-lay-up service season.',
        },
      ];
    case 'spring':
      return [
        {
          id: 'season-spring',
          category: 'cycle',
          issue: 'Spring overhaul & tune-up',
          systemId: 'drivetrain',
          direction: 'up',
          magnitude: 0.5,
          estimatedUpliftPct: 35,
          reason: 'Spring brings the post-winter overhaul rush.',
        },
      ];
    case 'summer':
      return [
        {
          id: 'season-summer',
          category: 'cycle',
          issue: 'Peak-season servicing',
          systemId: 'brakes',
          direction: 'up',
          magnitude: 0.4,
          estimatedUpliftPct: 25,
          reason: 'Summer riding volumes drive steady servicing demand.',
        },
      ];
    default:
      return [
        {
          id: 'season-autumn',
          category: 'cycle',
          issue: 'Autumn weather-proofing',
          systemId: 'accessories',
          direction: 'up',
          magnitude: 0.45,
          estimatedUpliftPct: 30,
          reason: 'Autumn is the time for mudguards, lights and wet-weather prep.',
        },
      ];
  }
}

/** One-line summary of the strongest signal, for a UI headline. */
export function signalHeadline(signals: DemandSignal[], today: Date = new Date()): string {
  const top = signals[0];
  if (!top) return 'No standout weather pressure this week.';
  return `${seasonOf(today.getMonth()).replace(/^./, (c) => c.toUpperCase())}: expect ${
    top.direction === 'up' ? 'up to +' : ''
  }${top.estimatedUpliftPct}% ${top.issue.toLowerCase()}.`;
}
