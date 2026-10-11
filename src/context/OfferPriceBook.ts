import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import type { VehicleCategory } from '../types/bikeShop';
import { DEFAULT_CONDITION_BANDS, type OfferConditionBands } from '../utils/bikeValuation';

/**
 * Reactive, SSR-safe staff price book for the "Sell Your Bike" flow.
 *
 * Staff record what the workshop typically pays for a brand/model. The AI
 * valuation engine reads this book to turn an identified bike into a cash offer;
 * a blank model means "brand-wide default", and a blank brand+model row acts as
 * a category fallback. Persisted per-device in localStorage and mirrored into
 * the `app_settings` JSON column `sell_offerbook_json` when it already exists
 * (anon credentials cannot run DDL, so we never create it).
 */

const STORAGE_KEY = 'stakeys.sell.offerbook.v1';
const LEGACY_STORAGE_KEY = 'stakeys.tradein.offerbook.v1';
const BANDS_STORAGE_KEY = 'stakeys.sell.conditionbands.v1';

export type CustomerCondition = 'excellent' | 'good' | 'fair' | 'poor';

/** The four grades in the order staff see them (best first). */
export const CONDITION_ORDER: CustomerCondition[] = ['excellent', 'good', 'fair', 'poor'];

/**
 * An explicit, staff-set offer for one condition grade. When present it is
 * authoritative: the workshop has said exactly what it pays for this bike in
 * this condition, so the engine uses it verbatim rather than deriving it.
 */
export interface ConditionPricePoint {
  price: number;
  /** Optional upper bound, e.g. a "£30–£40" good-condition band. */
  maxPrice?: number;
}

export interface OfferPriceEntry {
  id: string;
  brand: string;
  /** Empty (or '*') means the whole brand; both empty means the category fallback. */
  model: string;
  category?: VehicleCategory;
  /** What we typically pay the customer for this bike in good condition, in £. */
  basePrice: number;
  /** Optional explicit band; the engine derives a band from basePrice when absent. */
  minPrice?: number;
  maxPrice?: number;
  /**
   * Per-condition offers set by staff (e.g. Carrera Vengeance: poor £10,
   * fair £20, good £30–£40). Any grade left out falls back to
   * basePrice × the global condition band. When a grade is set here it wins.
   */
  conditionPrices?: Partial<Record<CustomerCondition, ConditionPricePoint>>;
  notes?: string;
  updatedAt: string;
}

/** Sensible starting values so the engine works before staff tune the book. */
const DEFAULT_ENTRIES: Omit<OfferPriceEntry, 'updatedAt'>[] = [
  { id: 'seed-trek', brand: 'Trek', model: '', category: 'cycle', basePrice: 180, notes: 'Brand-wide starting point — tune per model.' },
  { id: 'seed-specialized', brand: 'Specialized', model: '', category: 'cycle', basePrice: 190 },
  { id: 'seed-giant', brand: 'Giant', model: '', category: 'cycle', basePrice: 150 },
  { id: 'seed-carrera', brand: 'Carrera', model: '', category: 'cycle', basePrice: 80 },
  {
    id: 'seed-carrera-vengeance',
    brand: 'Carrera',
    model: 'Vengeance',
    category: 'cycle',
    basePrice: 35,
    conditionPrices: {
      poor: { price: 10 },
      fair: { price: 20 },
      good: { price: 30, maxPrice: 40 },
    },
    notes: 'Worked example: poor £10 · fair £20 · good £30–£40. Tune to taste.',
  },
  { id: 'seed-boardman', brand: 'Boardman', model: '', category: 'cycle', basePrice: 120 },
  { id: 'seed-cube', brand: 'Cube', model: '', category: 'ebike', basePrice: 320 },
  { id: 'seed-xiaomi', brand: 'Xiaomi', model: '', category: 'electric_scooter', basePrice: 90 },
  { id: 'seed-segway', brand: 'Segway', model: '', category: 'electric_scooter', basePrice: 140 },
  { id: 'seed-cat-cycle', brand: '', model: '', category: 'cycle', basePrice: 90 },
  { id: 'seed-cat-ebike', brand: '', model: '', category: 'ebike', basePrice: 220 },
  { id: 'seed-cat-scooter', brand: '', model: '', category: 'electric_scooter', basePrice: 70 },
  { id: 'seed-cat-cargo', brand: '', model: '', category: 'cargo', basePrice: 70 },
];

let cached: OfferPriceEntry[] | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function normalizeConditionPrices(
  input: OfferPriceEntry['conditionPrices']
): Partial<Record<CustomerCondition, ConditionPricePoint>> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const out: Partial<Record<CustomerCondition, ConditionPricePoint>> = {};
  for (const c of CONDITION_ORDER) {
    const point = input[c];
    if (!point) continue;
    const price = Number(point.price);
    if (!Number.isFinite(price) || price < 0) continue;
    const max = Number(point.maxPrice);
    out[c] = {
      price: Math.round(price),
      maxPrice: Number.isFinite(max) && max >= price ? Math.round(max) : undefined,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function normalize(entry: OfferPriceEntry): OfferPriceEntry | null {
  if (!entry || typeof entry.id !== 'string') return null;
  const basePrice = Number(entry.basePrice);
  if (!Number.isFinite(basePrice) || basePrice < 0) return null;
  return {
    ...entry,
    brand: String(entry.brand || '').trim(),
    model: String(entry.model || '').trim(),
    basePrice: Math.round(basePrice),
    minPrice: Number.isFinite(Number(entry.minPrice)) ? Math.round(Number(entry.minPrice)) : undefined,
    maxPrice: Number.isFinite(Number(entry.maxPrice)) ? Math.round(Number(entry.maxPrice)) : undefined,
    conditionPrices: normalizeConditionPrices(entry.conditionPrices),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

function read(): OfferPriceEntry[] {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cached = parsed.map(normalize).filter(Boolean) as OfferPriceEntry[];
          return cached;
        }
      }
    } catch {
      // Ignore malformed storage and fall back to the seeded defaults.
    }
  }
  cached = DEFAULT_ENTRIES.map((e) => ({ ...e, updatedAt: new Date().toISOString() }));
  return cached;
}

function write(items: OfferPriceEntry[]): void {
  cached = items;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Best-effort persistence.
    }
  }
  notify();
  void persistToSupabase(items);
}

export function getOfferPrices(): OfferPriceEntry[] {
  return read();
}

export function upsertOfferPrice(entry: Omit<OfferPriceEntry, 'id' | 'updatedAt'> & { id?: string }): OfferPriceEntry {
  const next: OfferPriceEntry = {
    ...entry,
    conditionPrices: normalizeConditionPrices(entry.conditionPrices),
    id: entry.id || `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    updatedAt: new Date().toISOString(),
  };
  const existing = read();
  const idx = existing.findIndex((e) => e.id === next.id);
  write(idx >= 0 ? existing.map((e) => (e.id === next.id ? next : e)) : [next, ...existing]);
  return next;
}

export function deleteOfferPrice(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function resetOfferPrices(): void {
  write(DEFAULT_ENTRIES.map((e) => ({ ...e, updatedAt: new Date().toISOString() })));
}

let columnProbe: 'unknown' | 'absent' | 'present' = 'unknown';
async function persistToSupabase(items: OfferPriceEntry[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (columnProbe === 'absent') return;
    if (columnProbe === 'unknown') {
      const probe = await supabase.from('app_settings').select('sell_offerbook_json').eq('id', 1).maybeSingle();
      if (probe.error) {
        columnProbe = 'absent';
        return;
      }
      columnProbe = 'present';
    }
    await supabase.from('app_settings').update({ sell_offerbook_json: items }).eq('id', 1);
  } catch {
    // Local-only is an acceptable degradation.
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useOfferPrices(): OfferPriceEntry[] {
  return useSyncExternalStore(subscribe, getOfferPrices);
}

// ---------------------------------------------------------------------------
// Condition bands — what we pay at each grade, as a multiplier on the base price.
// ---------------------------------------------------------------------------

let cachedBands: OfferConditionBands | null = null;
const bandListeners = new Set<() => void>();

function readBands(): OfferConditionBands {
  if (cachedBands) return cachedBands;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(BANDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cachedBands = normalizeBands(parsed);
          return cachedBands;
        }
      }
    } catch {
      // Ignore malformed storage and fall back to the defaults.
    }
  }
  cachedBands = { ...DEFAULT_CONDITION_BANDS };
  return cachedBands;
}

/** Keep every multiplier a positive number, falling back per-field. */
export function normalizeBands(input: Partial<OfferConditionBands>): OfferConditionBands {
  const pick = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
  return {
    excellent: pick(input.excellent, DEFAULT_CONDITION_BANDS.excellent),
    good: pick(input.good, DEFAULT_CONDITION_BANDS.good),
    fair: pick(input.fair, DEFAULT_CONDITION_BANDS.fair),
    poor: pick(input.poor, DEFAULT_CONDITION_BANDS.poor),
  };
}

export function getOfferConditionBands(): OfferConditionBands {
  return readBands();
}

export function setOfferConditionBands(next: Partial<OfferConditionBands>): OfferConditionBands {
  const bands = normalizeBands({ ...readBands(), ...next });
  cachedBands = bands;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BANDS_STORAGE_KEY, JSON.stringify(bands));
    } catch {
      // Best-effort persistence.
    }
  }
  for (const l of bandListeners) l();
  return bands;
}

export function resetOfferConditionBands(): OfferConditionBands {
  return setOfferConditionBands(DEFAULT_CONDITION_BANDS);
}

function subscribeBands(onChange: () => void): () => void {
  bandListeners.add(onChange);
  return () => bandListeners.delete(onChange);
}

export function useOfferConditionBands(): OfferConditionBands {
  return useSyncExternalStore(subscribeBands, getOfferConditionBands);
}
