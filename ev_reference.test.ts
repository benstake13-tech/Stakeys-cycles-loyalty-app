import { describe, it, expect } from 'vitest';
import {
  EV_VOLTAGE_CLASSES,
  ESCOOTER_BRANDS,
  EBIKE_DRIVE_SYSTEMS,
  CONVERSION_KIT_MAKERS,
  EV_RANGE_RULES,
  EV_LEGAL_NOTES,
  EV_BATTERY_SAFETY,
  EV_BRAND_SPECS,
  EV_SYSTEM_VOLTAGE_OPTIONS,
  evSpecForBrand,
  allEvVoltages,
} from './src/shared/data/evReference';
import { BIKE_BRAND_PROFILES, brandProfileFor, modelsForBrand } from './src/shared/data/bikeBrands';

const names = (list: { name: string }[]) => list.map((b) => b.name);

describe('EV reference — voltage classes', () => {
  it('covers the mainstream voltages with the right full-charge figures', () => {
    const byVoltage = Object.fromEntries(EV_VOLTAGE_CLASSES.map((v) => [v.voltage, v]));
    expect(byVoltage['36 V'].series).toBe('10S');
    expect(byVoltage['36 V'].fullCharge).toBe('42.0 V');
    expect(byVoltage['48 V'].series).toBe('13S');
    expect(byVoltage['48 V'].fullCharge).toBe('54.6 V');
    expect(byVoltage['52 V'].fullCharge).toBe('58.8 V');
    expect(EV_VOLTAGE_CLASSES.length).toBeGreaterThanOrEqual(4);
  });

  it('lists every voltage in ascending order via allEvVoltages', () => {
    const volts = allEvVoltages();
    expect(volts).toContain('36 V');
    expect(volts).toContain('48 V');
    expect(volts).toContain('72 V');
    const nums = volts.map((v) => parseInt(v, 10));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });
});

describe('EV reference — e-scooter brands', () => {
  it('covers the popular brands with 36 V and real models', () => {
    expect(ESCOOTER_BRANDS.length).toBeGreaterThanOrEqual(12);
    expect(names(ESCOOTER_BRANDS)).toContain('Xiaomi');
    expect(names(ESCOOTER_BRANDS)).toContain('Segway-Ninebot');
    expect(names(ESCOOTER_BRANDS)).toContain('NIU');
    for (const b of ESCOOTER_BRANDS) {
      expect(b.voltages.length, `${b.name} has no voltage`).toBeGreaterThan(0);
      expect(b.battery.length, `${b.name} has no battery`).toBeGreaterThan(0);
      expect(b.motor.length, `${b.name} has no motor`).toBeGreaterThan(0);
    }
  });

  it('reflects the 36 V / 48 V split for NIU', () => {
    const niu = ESCOOTER_BRANDS.find((b) => b.name === 'NIU')!;
    expect(niu.voltages).toContain('36 V');
    expect(niu.voltages).toContain('48 V');
  });
});

describe('EV reference — factory e-bike drive systems', () => {
  it('lists the major OEM motor makers, all on 36 V', () => {
    for (const maker of ['Bosch', 'Shimano STEPS', 'Brose', 'Yamaha', 'Mahle', 'Specialized']) {
      expect(names(EBIKE_DRIVE_SYSTEMS), `${maker} missing`).toContain(maker);
    }
    EBIKE_DRIVE_SYSTEMS.forEach((b) => expect(b.voltages).toContain('36 V'));
  });
});

describe('EV reference — conversion-kit makers', () => {
  it('lists reputable kit makers with voltage and a use case', () => {
    for (const maker of ['Bafang', 'Tongsheng', 'Cyclotricity', 'Swytch', 'Pendix', 'CYC']) {
      expect(names(CONVERSION_KIT_MAKERS), `${maker} missing`).toContain(maker);
    }
    CONVERSION_KIT_MAKERS.forEach((k) => {
      expect(k.voltages.length, `${k.name} has no voltage`).toBeGreaterThan(0);
      expect(k.bestFor.length, `${k.name} has no bestFor`).toBeGreaterThan(0);
    });
  });
});

describe('EV reference — helpers and integrity', () => {
  it('looks up a spec case-insensitively and returns undefined for unknown brands', () => {
    expect(evSpecForBrand('bosch')?.type).toBe('e-bike');
    expect(evSpecForBrand('XIAOMI')?.type).toBe('e-scooter');
    expect(evSpecForBrand('Totally Unknown')).toBeUndefined();
    expect(evSpecForBrand('')).toBeUndefined();
  });

  it('exposes a de-duplicated combined brand list', () => {
    const all = names(EV_BRAND_SPECS);
    expect(new Set(all).size).toBe(all.length);
    expect(EV_BRAND_SPECS.length).toBe(ESCOOTER_BRANDS.length + EBIKE_DRIVE_SYSTEMS.length);
  });

  it('offers voltage options for the booking form', () => {
    expect(EV_SYSTEM_VOLTAGE_OPTIONS).toContain('48 V (13S)');
    expect(EV_SYSTEM_VOLTAGE_OPTIONS).toContain('Not Sure');
  });

  it('states the UK legal limits and battery-safety guidance', () => {
    expect(EV_LEGAL_NOTES.join(' ')).toMatch(/250\s?W/);
    expect(EV_LEGAL_NOTES.join(' ')).toMatch(/15\.5 mph/);
    expect(EV_LEGAL_NOTES.join(' ').toLowerCase()).toContain('e-scooter');
    expect(EV_BATTERY_SAFETY.length).toBeGreaterThanOrEqual(4);
    expect(EV_RANGE_RULES.length).toBeGreaterThanOrEqual(3);
  });
});

describe('new EV brands are selectable in the bike picker', () => {
  it('tags the new e-scooter brands', () => {
    for (const brand of ['Bird', 'Apollo Scooters', 'Dualtron', 'Kaabo', 'InMotion', 'Vsett', 'Micro', 'Razor']) {
      expect(brandProfileFor(brand)?.types, `${brand} not tagged`).toContain('E-Scooter');
    }
  });

  it('tags the new conversion-kit makers', () => {
    for (const brand of ['Tongsheng', 'Voilamart', 'Grin Technologies', 'Crystalyte', 'Golden Motor', 'CYC']) {
      expect(brandProfileFor(brand)?.types, `${brand} not tagged`).toContain('Conversion Kit');
    }
  });

  it('gives every new brand a model list', () => {
    for (const brand of ['Bird', 'Apollo Scooters', 'Dualtron', 'Kaabo', 'InMotion', 'Vsett', 'GoTrax', 'Unagi', 'Micro', 'Razor', 'Okai', 'Swifty', 'Tongsheng', 'Voilamart', 'Grin Technologies', 'Crystalyte', 'Golden Motor', 'CYC']) {
      expect(modelsForBrand(brand).length, `${brand} has no models`).toBeGreaterThan(0);
    }
  });

  it('still has a de-duplicated brand list', () => {
    const all = BIKE_BRAND_PROFILES.map((b) => b.name);
    expect(new Set(all).size).toBe(all.length);
  });
});
