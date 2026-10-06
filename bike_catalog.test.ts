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
