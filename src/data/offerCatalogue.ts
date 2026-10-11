import type { VehicleCategory } from '../types/bikeShop';
import type { OfferPriceEntry } from '../context/OfferPriceBook';
import {
  BIKE_BRAND_PROFILES,
  BRAND_MODELS_MAP,
  brandProfileFor,
  modelsForBrand,
  brandMatchesCategory,
  isScooterBrand,
  UNKNOWN_BRAND_NAMES,
  type BikeBrandProfile,
} from './bikeBrands';

/**
 * Pure helpers behind the staff "brand & model" catalogue in the Sell Your Bike
 * price book. The catalogue reuses the booking flow's brand tables so staff
 * price exactly the bikes riders can actually select, and it flags which
 * models already have a price so gaps are obvious at a glance.
 */

/** Same normalisation the valuation engine uses, so "FX 1 / 2 / 3" matches. */
export const normKey = (v?: string): string =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** A catalogue model paired with its cleaned name and pricing state. */
export interface CatalogueModel {
  /** The raw catalogue string, e.g. "Marlin (Mountain)". */
  raw: string;
  /** The display / price-book name, e.g. "Marlin". */
  name: string;
  category: VehicleCategory;
  /** The matching price-book row, when one exists. */
  entry?: OfferPriceEntry;
}

export interface CatalogueBrand {
  name: string;
  country: string;
  types: string[];
  isScooter: boolean;
  /** True when we have a curated model list (vs. a generic fallback). */
  hasCuratedModels: boolean;
  models: CatalogueModel[];
  /** How many of this brand's models already carry a price. */
  pricedModels: number;
  /** The brand-wide price row (blank model), when one exists. */
  brandEntry?: OfferPriceEntry;
}

/** Models that are really "type your own" escape hatches, not real families. */
const isEscapeHatchModel = (model: string): boolean => {
  const m = model.toLowerCase();
  return m.startsWith('other') || m.includes('don’t know') || m.includes("don't know");
};

/** Strip the trailing "(Mountain)" style descriptor for a tidy price-book name. */
export function cleanModelName(raw: string): string {
  return String(raw ?? '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/**
 * Best-guess vehicle category for a model, from its own descriptor and its
 * brand's types. Used to pre-select the category when staff price a model.
 */
export function inferModelCategory(brand: string, rawModel: string): VehicleCategory {
  const profile = brandProfileFor(brand);
  const lower = rawModel.toLowerCase();
  if (lower.includes('kid') || lower.includes('cargo') || lower.includes('junior')) return 'cargo';
  const scooterOnly = !!profile && profile.types.every((t) => t === 'E-Scooter');
  if (scooterOnly || lower.includes('scooter')) return 'electric_scooter';
  if (lower.includes('electric') || lower.includes('e-bike') || lower.includes('powerfly') || lower.includes('rail')) {
    return 'ebike';
  }
  return 'cycle';
}

/** Find the price-book row for a brand+model, ignoring case and punctuation. */
export function findEntry(
  book: OfferPriceEntry[],
  brand: string,
  model: string
): OfferPriceEntry | undefined {
  const b = normKey(brand);
  const m = normKey(model);
  return book.find((e) => normKey(e.brand) === b && normKey(e.model) === m);
}

/**
 * The full brand catalogue, each brand expanded to its real (non-escape-hatch)
 * models with pricing state attached. Brands with no real models are dropped.
 */
export function buildCatalogue(book: OfferPriceEntry[]): CatalogueBrand[] {
  return BIKE_BRAND_PROFILES.filter((b) => !UNKNOWN_BRAND_NAMES.includes(b.name))
    .map((profile) => toCatalogueBrand(profile, book))
    .filter((b) => b.models.length > 0);
}

function toCatalogueBrand(profile: BikeBrandProfile, book: OfferPriceEntry[]): CatalogueBrand {
  const brandEntry = findEntry(book, profile.name, '');
  const models = modelsForBrand(profile.name)
    .filter((raw) => !isEscapeHatchModel(raw))
    .map((raw) => {
      const name = cleanModelName(raw);
      return {
        raw,
        name,
        category: inferModelCategory(profile.name, raw),
        entry: findEntry(book, profile.name, name),
      };
    });
  return {
    name: profile.name,
    country: profile.country,
    types: profile.types,
    isScooter: isScooterBrand(profile),
    hasCuratedModels: Object.prototype.hasOwnProperty.call(BRAND_MODELS_MAP, profile.name),
    models,
    pricedModels: models.filter((m) => m.entry).length,
    brandEntry,
  };
}

/** Filter the catalogue by a free-text query (brand, model, country or type). */
export function filterCatalogue(brands: CatalogueBrand[], query: string): CatalogueBrand[] {
  const q = query.trim().toLowerCase();
  if (!q) return brands;
  return brands
    .map((b) => {
      if (
        b.name.toLowerCase().includes(q) ||
        b.country.toLowerCase().includes(q) ||
        b.types.some((t) => t.toLowerCase().includes(q))
      ) {
        return b;
      }
      const models = b.models.filter((m) => m.name.toLowerCase().includes(q));
      return models.length ? { ...b, models } : null;
    })
    .filter((b): b is CatalogueBrand => b !== null);
}

/** Narrow the catalogue to brands that build for a given vehicle category. */
export function filterByCategory(brands: CatalogueBrand[], category: VehicleCategory | ''): CatalogueBrand[] {
  if (!category) return brands;
  return brands.filter((b) => {
    const profile = brandProfileFor(b.name);
    return profile ? brandMatchesCategory(profile, category) : true;
  });
}
