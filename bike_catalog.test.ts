import { describe, it, expect } from 'vitest';
import {
  BIKE_BRAND_PROFILES,
  BIKE_BRAND_TYPES,
  BRAND_MODELS_MAP,
  POPULAR_BIKE_BRANDS,
  EBIKE_STATUS_OPTIONS,
  EBIKE_MOTOR_SYSTEMS,
  EBIKE_BATTERY_POSITIONS,
  EBIKE_DRIVE_TYPES,
  TIME_SLOT_OPTIONS,
  BIKE_YEAR_OPTIONS,
  modelsForBrand,
  brandProfileFor,
  isCustomModel,
  brandSections,
  isScooterBrand,
  brandMatchesCategory,
  brandsForCategory,
  firstBrandForCategory,
  UNKNOWN_BRAND_NAMES,
} from './src/data/bikeCatalog';
import {
  toBikeDetails,
  resolveModel,
  isEbike,
  EMPTY_BIKE_IDENTITY,
  BikeIdentityValue,
} from './src/components/BikeIdentityFields';

describe('bike catalogue integrity', () => {
  it('offers a large, de-duplicated brand list', () => {
    expect(BIKE_BRAND_PROFILES.length).toBeGreaterThanOrEqual(80);
    const names = BIKE_BRAND_PROFILES.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
    expect(POPULAR_BIKE_BRANDS).toEqual(names);
  });

  it('has real model families for the popular brands', () => {
    ['Trek', 'Specialized', 'Giant', 'Carrera', 'Boardman', 'Cube'].forEach((brand) => {
      expect(modelsForBrand(brand).length).toBeGreaterThanOrEqual(10);
    });
  });

  it('gives every brand at least one model list', () => {
    BIKE_BRAND_PROFILES.forEach((b) => {
      expect(modelsForBrand(b.name).length).toBeGreaterThan(0);
    });
  });

  it('only tags brands with known types', () => {
    BIKE_BRAND_PROFILES.forEach((b) => {
      b.types.forEach((t) => expect(BIKE_BRAND_TYPES).toContain(t));
    });
  });

  it('exposes e-scooter and conversion-kit brands', () => {
    expect(brandProfileFor('Xiaomi')?.types).toContain('E-Scooter');
    expect(brandProfileFor('Bafang')?.types).toContain('Conversion Kit');
  });

  it('covers a wide range of e-scooter makers, each with real models', () => {
    const scooterBrands = [
      'Xiaomi', 'Segway-Ninebot', 'NIU', 'Pure Electric', 'Apollo Scooters', 'Vsett',
      'Dualtron', 'Minimotors', 'Kaabo', 'Nanrobot', 'InMotion', 'NAMI', 'Razor',
      'Bird', 'Lime', 'Micro', 'Unagi', 'Hiboy', 'GoTrax', 'Okai', 'Levy', 'Boosted',
      'Fluidfreeride', 'iScooter', 'Wheelspeed', 'Hover-1', 'Swagtron', 'Segway', 'Talaria',
    ];
    scooterBrands.forEach((name) => {
      const profile = brandProfileFor(name);
      expect(profile, `${name} missing from brand profiles`).toBeTruthy();
      expect(profile!.types, `${name} not tagged E-Scooter`).toContain('E-Scooter');
      expect(modelsForBrand(name).length, `${name} has a thin model list`).toBeGreaterThanOrEqual(3);
    });
    // Every scooter brand lands in the picker's scooter section.
    const { scooters } = brandSections();
    scooterBrands.forEach((name) => expect(scooters.some((b) => b.name === name)).toBe(true));
  });

  it('looks up brands case-insensitively and falls back safely', () => {
    expect(modelsForBrand('trek').length).toBeGreaterThan(5);
    expect(modelsForBrand('Totally Unknown Brand')).toContain('Don’t Know Exact Model');
  });

  it('detects custom / other model choices', () => {
    expect(isCustomModel('Other Trek Model')).toBe(true);
    expect(isCustomModel('Marlin (Mountain)')).toBe(false);
  });

  it('asks the e-bike conversion question with four clear answers', () => {
    expect(EBIKE_STATUS_OPTIONS.map((o) => o.id)).toEqual([
      'factory',
      'converted',
      'not_ebike',
      'unsure',
    ]);
    expect(EBIKE_MOTOR_SYSTEMS.length).toBeGreaterThan(10);
    expect(EBIKE_BATTERY_POSITIONS.length).toBeGreaterThan(3);
    expect(EBIKE_DRIVE_TYPES.length).toBeGreaterThan(2);
  });

  it('offers enough time slots and recent years', () => {
    expect(TIME_SLOT_OPTIONS.length).toBeGreaterThanOrEqual(2);
    expect(BIKE_YEAR_OPTIONS).toContain(String(new Date().getFullYear()));
    expect(BIKE_YEAR_OPTIONS).toContain('Don’t Know');
  });

  it('keeps the models map free of empty lists', () => {
    Object.entries(BRAND_MODELS_MAP).forEach(([brand, models]) => {
      expect(models.length, `${brand} has no models`).toBeGreaterThan(0);
    });
  });

  it('splits the brands into alphabetical e-scooter and bike sections', () => {
    const { scooters, bikes, unknown } = brandSections();
    expect(scooters.length).toBeGreaterThan(0);
    expect(bikes.length).toBeGreaterThan(scooters.length);
    // Every real brand appears in at least one section; the escape hatches are kept apart.
    const known = BIKE_BRAND_PROFILES.filter((b) => !UNKNOWN_BRAND_NAMES.includes(b.name));
    const covered = new Set([...scooters, ...bikes].map((b) => b.name));
    known.forEach((b) => expect(covered.has(b.name)).toBe(true));
    expect(unknown.map((b) => b.name)).toContain('Other / Not Listed');
    // Both sections are sorted A→Z, ignoring case.
    const alphabetical = (list: typeof scooters) =>
      list.every((b, i) => i === 0 || list[i - 1].name.localeCompare(b.name, 'en', { sensitivity: 'base' }) <= 0);
    expect(alphabetical(scooters)).toBe(true);
    expect(alphabetical(bikes)).toBe(true);
    // Xiaomi is a scooter-only maker, so it must not appear in the bike section.
    expect(scooters.some((b) => b.name === 'Xiaomi')).toBe(true);
    expect(bikes.some((b) => b.name === 'Xiaomi')).toBe(false);
    // Pure Electric builds both, so it shows in each section.
    expect(scooters.some((b) => b.name === 'Pure Electric')).toBe(true);
    expect(bikes.some((b) => b.name === 'Pure Electric')).toBe(true);
  });

  it('never treats the "not sure" escape hatches as real brands', () => {
    const { scooters, bikes } = brandSections();
    [...scooters, ...bikes].forEach((b) => {
      expect(UNKNOWN_BRAND_NAMES).not.toContain(b.name);
    });
    expect(isScooterBrand(brandProfileFor('Xiaomi')!)).toBe(true);
    expect(isScooterBrand(brandProfileFor('Trek')!)).toBe(false);
  });

  it('filters brands to a vehicle category, keeping the escape hatches', () => {
    // E-scooter category: scooters, no bike-only brands.
    const scooters = brandsForCategory('electric_scooter');
    expect(scooters.some((b) => b.name === 'Xiaomi')).toBe(true);
    expect(scooters.some((b) => b.name === 'Segway-Ninebot')).toBe(true);
    expect(scooters.some((b) => b.name === 'Trek')).toBe(false);
    expect(scooters.some((b) => b.name === 'Giant')).toBe(false);

    // Bike: bike-family brands, no scooters.
    const bikes = brandsForCategory('cycle');
    expect(bikes.some((b) => b.name === 'Giant')).toBe(true);
    expect(bikes.some((b) => b.name === 'Trek')).toBe(true);
    expect(bikes.some((b) => b.name === 'Xiaomi')).toBe(false);

    // E-bike: e-bike + conversion-kit makers.
    const ebikes = brandsForCategory('ebike');
    expect(ebikes.some((b) => b.name === 'Haibike')).toBe(true);
    expect(ebikes.some((b) => b.name === 'Swytch')).toBe(true);
    expect(ebikes.some((b) => b.name === 'Xiaomi')).toBe(false);

    // Escape hatches always remain.
    UNKNOWN_BRAND_NAMES.forEach((n) => {
      expect(brandsForCategory('electric_scooter').some((b) => b.name === n)).toBe(true);
      expect(brandsForCategory('cycle').some((b) => b.name === n)).toBe(true);
      expect(brandsForCategory('ebike').some((b) => b.name === n)).toBe(true);
      expect(brandsForCategory('cargo').some((b) => b.name === n)).toBe(true);
    });
  });

  it('picks a real first brand for each category', () => {
    expect(brandMatchesCategory(brandProfileFor('Xiaomi')!, 'cycle')).toBe(false);
    expect(brandMatchesCategory(brandProfileFor('Trek')!, 'cycle')).toBe(true);
    expect(brandMatchesCategory(brandProfileFor('Xiaomi')!, 'electric_scooter')).toBe(true);
    expect(UNKNOWN_BRAND_NAMES).not.toContain(firstBrandForCategory('cycle'));
    expect(UNKNOWN_BRAND_NAMES).not.toContain(firstBrandForCategory('ebike'));
    expect(UNKNOWN_BRAND_NAMES).not.toContain(firstBrandForCategory('electric_scooter'));
    expect(UNKNOWN_BRAND_NAMES).not.toContain(firstBrandForCategory('cargo'));
    expect(brandMatchesCategory(brandProfileFor('Other / Not Listed')!, 'electric_scooter')).toBe(true);
  });
});

describe('bike identity helpers', () => {
  const base: BikeIdentityValue = { ...EMPTY_BIKE_IDENTITY, brand: 'Trek', model: 'Marlin (Mountain)' };

  it('prefers a typed custom model over the Other placeholder', () => {
    expect(
      resolveModel({ ...base, model: 'Other Trek Model', customModel: 'Custom Build 26"' })
    ).toBe('Custom Build 26"');
    expect(resolveModel(base)).toBe('Marlin (Mountain)');
  });

  it('builds a details payload with only the fields that were filled in', () => {
    const details = toBikeDetails({ ...base, ebikeStatus: 'converted', conversionSystem: 'Bafang BBSHD' });
    expect(details).toEqual({ ebikeStatus: 'converted', conversionSystem: 'Bafang BBSHD' });
    expect(toBikeDetails(base)).toBeUndefined();
  });

  it('flags factory and converted e-bikes, and e-bike categories', () => {
    expect(isEbike({ ...base, ebikeStatus: 'converted' })).toBe(true);
    expect(isEbike({ ...base, ebikeStatus: 'factory' })).toBe(true);
    expect(isEbike({ ...base, category: 'ebike' })).toBe(true);
    expect(isEbike({ ...base, ebikeStatus: 'not_ebike' })).toBe(false);
    expect(isEbike(base)).toBe(false);
  });
});
