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
  notes?: string;
  updatedAt: string;
}

/** Sensible starting values so the engine works before staff tune the book. */
const DEFAULT_ENTRIES: Omit<OfferPriceEntry, 'updatedAt'>[] = [
  { id: 'seed-trek', brand: 'Trek', model: '', category: 'cycle', basePrice: 180, notes: 'Brand-wide starting point — tune per model.' },
  { id: 'seed-specialized', brand: 'Specialized', model: '', category: 'cycle', basePrice: 190 },
  { id: 'seed-giant', brand: 'Giant', model: '', category: 'cycle', basePrice: 150 },
  { id: 'seed-carrera', brand: 'Carrera', model: '', category: 'cycle', basePrice: 80 },
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
