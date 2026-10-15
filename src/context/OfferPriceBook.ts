import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import type { VehicleCategory } from '../types/bikeShop';
import { BIKE_BRAND_PROFILES, modelsForBrand, UNKNOWN_BRAND_NAMES, type BikeBrandProfile } from '../data/bikeBrands';

/**
 * Reactive, SSR-safe staff price book for the "Sell Your Bike" flow.
 *
 * Staff record what the workshop pays for a specific model, and the AI
 * valuation engine reads this book to turn an identified bike into a cash
 * offer. The offer is always a price a member of staff saved here — a
 * per-condition figure or the model's base (good-condition) price. Prices are
 * always per model; a blank brand+model row acts as a category fallback.
 *
 * Persistence is two-way: edits are written to localStorage (instant, offline)
 * AND mirrored into the `app_settings` JSON column `sell_offerbook_json` when it
 * exists. On load we hydrate back from Supabase so a price a staff member sets
 * in the terminal reaches every customer's "Sell Your Bike" flow. Anon
 * credentials cannot run DDL, so the column must be added once via
 * `supabase/migrations/20261012_offer_price_book.sql`; until then the store
 * stays local-only.
 */

const STORAGE_KEY = 'stakeys.sell.offerbook.v1';
const LEGACY_STORAGE_KEY = 'stakeys.tradein.offerbook.v1';
// Stamped only on a real staff edit (never on hydrate/seed) so the load-time
// merge can tell an unsynced local edit from freshly-seeded defaults.
const EDITED_AT_KEY = 'stakeys.sell.offerbook.editedAt.v1';

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
  /** The specific model this price is for. Both brand and model empty = category fallback. */
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
  // Conservative £10–£160 opening offers for the 22 Trek catalogue families.
  // Lower grades are reduced; condition steps remain within £10–£20.
  ...[
    ['Marlin', 70, 'cycle'], ['Roscoe', 95, 'cycle'], ['X-Caliber', 85, 'cycle'],
    ['Fuel EX', 120, 'cycle'], ['Slash', 130, 'cycle'], ['Remedy', 110, 'cycle'],
    ['Top Fuel', 120, 'cycle'], ['FX 1 / 2 / 3', 60, 'cycle'], ['Verve', 50, 'cycle'],
    ['Dual Sport', 70, 'cycle'], ['Domane', 95, 'cycle'], ['Émonda', 115, 'cycle'],
    ['Madone', 140, 'cycle'], ['Checkpoint', 105, 'cycle'], ['Boone', 100, 'cycle'],
    ['Rail', 140, 'ebike'], ['Powerfly', 125, 'ebike'], ['Allant+', 130, 'ebike'],
    ['FX+', 110, 'ebike'], ['Verve+', 115, 'ebike'], ['Precaliber', 35, 'cycle'],
    ['Wahoo', 50, 'cycle'],
  ].map(([model, basePrice, category]) => ({
    id: `seed-trek-${String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    brand: 'Trek', model: String(model), category: category as VehicleCategory,
    basePrice: Number(basePrice),
    conditionPrices: {
      poor: { price: Math.max(10, Number(basePrice) - 30) },
      fair: { price: Math.max(0, Number(basePrice) - 15) },
      good: { price: Number(basePrice) },
      excellent: { price: Number(basePrice) + 20 },
    },
    notes: `Indicative conservative trade-in price for the model family. Check year, trim, frame and components${category === 'ebike' ? ', plus battery health and charger' : ''} before confirming.`,
  })),
  { id: 'seed-specialized-rockhopper', brand: 'Specialized', model: 'Rockhopper', category: 'cycle', basePrice: 190 },
  { id: 'seed-giant-escape', brand: 'Giant', model: 'Escape', category: 'cycle', basePrice: 150 },
  { id: 'seed-carrera-subway', brand: 'Carrera', model: 'Subway', category: 'cycle', basePrice: 80 },
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
  { id: 'seed-boardman-hyb', brand: 'Boardman', model: 'HYB 8.6 / 8.8', category: 'cycle', basePrice: 120 },
  { id: 'seed-cube-reaction-hybrid', brand: 'Cube', model: 'Reaction Hybrid', category: 'ebike', basePrice: 320 },
  { id: 'seed-xiaomi-m365', brand: 'Xiaomi', model: 'Mi M365', category: 'electric_scooter', basePrice: 90 },
  { id: 'seed-segway-max', brand: 'Segway', model: 'Ninebot MAX Series', category: 'electric_scooter', basePrice: 140 },
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
  const conditionPrices = normalizeConditionPrices(entry.conditionPrices);
  const goodPrice = Number(conditionPrices?.good?.price);
  const rawBase = Number(entry.basePrice);
  // A row staff priced only per-condition still needs a base for the matcher to
  // see it — the good-condition figure stands in for it.
  const basePrice =
    Number.isFinite(rawBase) && rawBase >= 0
      ? rawBase
      : Number.isFinite(goodPrice) && goodPrice >= 0
      ? goodPrice
      : NaN;
  if (!Number.isFinite(basePrice)) return null;
  return {
    ...entry,
    brand: String(entry.brand || '').trim(),
    model: String(entry.model || '').trim(),
    basePrice: Math.round(basePrice),
    minPrice: Number.isFinite(Number(entry.minPrice)) ? Math.round(Number(entry.minPrice)) : undefined,
    maxPrice: Number.isFinite(Number(entry.maxPrice)) ? Math.round(Number(entry.maxPrice)) : undefined,
    conditionPrices,
    updatedAt: entry.updatedAt || new Date().toISOString(),
  };
}

const modelKey = (brand: string, model: string) => `${brand}${model}`.toLowerCase().replace(/[^a-z0-9]/g, '');
const sameConditionPrices = (
  left: OfferPriceEntry['conditionPrices'],
  right: OfferPriceEntry['conditionPrices']
) => CONDITION_ORDER.every(condition =>
  left?.[condition]?.price === right?.[condition]?.price
  && (left?.[condition]?.maxPrice ?? null) === (right?.[condition]?.maxPrice ?? null));

function modelCategory(profile: BikeBrandProfile, rawModel: string): VehicleCategory {
  const model = rawModel.toLowerCase();
  if (/kid|child|junior|cargo/.test(model)) return 'cargo';
  if (model.includes('scooter') || profile.types.every(type => type === 'E-Scooter')) return 'electric_scooter';
  if (/e-bike|ebike|electric|powerfly|rail|allant\+|verve\+|fx\+/.test(model)
    || profile.types.every(type => type === 'E-Bike')) return 'ebike';
  return 'cycle';
}

/** Estimate a conservative good-condition offer from the model family and type. */
function suggestedGoodPrice(profile: BikeBrandProfile, rawModel: string, category: VehicleCategory): number {
  const model = rawModel.toLowerCase();
  if (category === 'cargo') return Math.min(85, /cargo|longtail|family/.test(model) ? 85 : 55);
  let price = category === 'electric_scooter' ? 70 : category === 'ebike' ? 100 : 65;
  if (category === 'cycle') {
    if (/hybrid|commuter|city|comfort|folding|leisure/.test(model)) price = 55;
    if (/road|gravel|cyclocross|endurance/.test(model)) price = 80;
    if (/mountain|trail|cross-country|xc/.test(model)) price = 75;
    if (/full suspension|all-mountain|enduro|downhill|freeride/.test(model)) price = 100;
  } else if (category === 'ebike' && /mountain|trail|enduro|full suspension|cargo/.test(model)) {
    price = 120;
  } else if (category === 'electric_scooter' && /max|pro|ultra|gt|performance|dual motor/.test(model)) {
    price = 90;
  }

  const premiumBrand = /^(pinarello|colnago|wilier|bianchi|cerv[eé]lo|factor|santa cruz|yeti|pivot|ibis|look)$/i.test(profile.name);
  const premiumModel = /\b(carbon|s-works|slr|pro|expert|elite|advanced|race|team|ltd|comp|xt|xtr|di2|gx)\b/i.test(rawModel);
  const performanceModel = /\b(enduro|downhill|freeride|full suspension|all-mountain|race)\b/i.test(rawModel);
  if (premiumBrand) price += 15;
  if (premiumModel) price += 15;
  if (performanceModel) price += 15;
  return Math.max(40, Math.min(145, price));
}

function allCatalogueSeeds(): OfferPriceEntry[] {
  const updatedAt = new Date().toISOString();
  return BIKE_BRAND_PROFILES.filter(profile => !UNKNOWN_BRAND_NAMES.includes(profile.name))
    .flatMap(profile => modelsForBrand(profile.name)
      .filter(raw => !/^other\b|don.?t know/i.test(raw))
      .map(raw => {
        const model = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const category = modelCategory(profile, raw);
        const good = profile.name.toLowerCase() === 'trek'
          ? undefined
          : suggestedGoodPrice(profile, raw, category);
        const trekkingEntry = DEFAULT_ENTRIES.find(entry => entry.brand.toLowerCase() === profile.name.toLowerCase()
          && modelKey(entry.brand, entry.model) === modelKey(profile.name, model));
        const goodPrice = trekkingEntry?.basePrice ?? good ?? 65;
        const poorPrice = Math.max(10, goodPrice - 30);
        return {
          id: trekkingEntry?.id ?? `seed-${modelKey(profile.name, model)}`,
          brand: profile.name,
          model,
          category,
          basePrice: goodPrice,
          conditionPrices: trekkingEntry?.conditionPrices ?? {
            poor: { price: poorPrice },
            fair: { price: Math.max(poorPrice + 10, goodPrice - 15) },
            good: { price: goodPrice },
            excellent: { price: Math.min(160, goodPrice + (profile.name.toLowerCase() === 'trek' ? 20 : 15)) },
          },
          notes: `Indicative model-family offer. Check the exact year, specification, condition${category === 'ebike' ? ', battery health and charger' : ''} before confirming.`,
          updatedAt,
        };
      }));
}

/** Apply the approved budget ladder to existing and newly seeded catalogue rows. */
function mergeCatalogueOffers(entries: OfferPriceEntry[]): OfferPriceEntry[] {
  const merged = [...entries];
  const now = new Date().toISOString();
  const indexByKey = new Map(merged.map((entry, index) => [modelKey(entry.brand, entry.model), index]));
  for (const seed of allCatalogueSeeds()) {
    const key = modelKey(seed.brand, seed.model);
    const index = indexByKey.get(key);
    if (index == null) {
      merged.push({ ...seed, updatedAt: now });
      indexByKey.set(key, merged.length - 1);
      continue;
    }
    const current = merged[index];
    const changed = current.basePrice !== seed.basePrice
      || !sameConditionPrices(current.conditionPrices, seed.conditionPrices);
    merged[index] = { ...current, ...seed, id: current.id, updatedAt: changed ? now : current.updatedAt };
  }
  return merged;
}

function read(): OfferPriceEntry[] {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cached = mergeCatalogueOffers(parsed.map(normalize).filter(Boolean) as OfferPriceEntry[]);
          try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* Best effort. */ }
          return cached;
        }
      }
    } catch {
      // Ignore malformed storage and fall back to the seeded defaults.
    }
  }
  cached = mergeCatalogueOffers(DEFAULT_ENTRIES.map((e) => ({ ...e, updatedAt: new Date().toISOString() })));
  return cached;
}

function write(items: OfferPriceEntry[]): void {
  cached = items;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      window.localStorage.setItem(EDITED_AT_KEY, String(Date.now()));
    } catch {
      // Best-effort persistence.
    }
  }
  notify();
  void persistToSupabase(items);
}

// ---------------------------------------------------------------------------
// Hydration — pull the workshop's saved book down so staff edits reach every
// customer. Once per session unless `force`; never clobbers a local edit that
// is newer than the server copy.
// ---------------------------------------------------------------------------
let offerBookSynced = false;
let offerBookSyncing = false;

/** Read a marker without ever throwing (private mode, corrupt value, …). */
function readStamp(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function syncOfferPricesFromSupabase(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (offerBookSyncing) return false;
  if (offerBookSynced && !force) return false;
  offerBookSyncing = true;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('sell_offerbook_json')
      .eq('id', 1)
      .maybeSingle();
    // Missing column / table (anon can't run DDL) — stay local-only.
    if (error) return false;
    offerBookSynced = true;
    const remote = (data as { sell_offerbook_json?: unknown } | null)?.sell_offerbook_json;
    if (!Array.isArray(remote)) {
      const local = read();
      void persistToSupabase(local);
      return true;
    }
    const remoteEntries = remote.map(normalize).filter(Boolean) as OfferPriceEntry[];
    const normalized = mergeCatalogueOffers(remoteEntries);
    const remoteTime = normalized.reduce((max, e) => Math.max(max, Date.parse(e.updatedAt) || 0), 0);
    // A real local edit made after the server copy is still unsynced — push it,
    // don't pull over it. Seeded defaults carry no marker, so they never block.
    if (readStamp(EDITED_AT_KEY) > remoteTime) {
      void persistToSupabase(read());
      return true;
    }
    cached = normalized;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Best-effort persistence.
    }
    if (JSON.stringify(normalized) !== JSON.stringify(remoteEntries)) void persistToSupabase(normalized);
    notify();
    return true;
  } catch {
    return false;
  } finally {
    offerBookSyncing = false;
  }
}

export function getOfferPrices(): OfferPriceEntry[] {
  if (!cached) void syncOfferPricesFromSupabase();
  return read();
}

export function upsertOfferPrice(entry: Omit<OfferPriceEntry, 'id' | 'updatedAt'> & { id?: string }): OfferPriceEntry {
  const draft: OfferPriceEntry = {
    ...entry,
    conditionPrices: normalizeConditionPrices(entry.conditionPrices),
    id: entry.id || `op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    updatedAt: new Date().toISOString(),
  };
  // Run the same normalisation the loader uses so an in-memory row matches what a
  // reload would produce (e.g. a base price derived from the good-condition row).
  const next = normalize(draft) ?? draft;
  const existing = read();
  const idx = existing.findIndex((e) => e.id === next.id);
  write(idx >= 0 ? existing.map((e) => (e.id === next.id ? next : e)) : [next, ...existing]);
  return next;
}

export function deleteOfferPrice(id: string): void {
  write(read().filter((e) => e.id !== id));
}

export function resetOfferPrices(): void {
  write(mergeCatalogueOffers(DEFAULT_ENTRIES.map((e) => ({ ...e, updatedAt: new Date().toISOString() }))));
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
