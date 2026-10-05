import { describe, it, expect } from 'vitest';
import {
  BIKE_ISSUES_CATEGORIES,
  issueAppliesToVehicle,
  issueCategoriesForVehicle,
} from './bikeIssuesCatalog';
import { TIME_SLOT_OPTIONS } from './bikeBrands';

describe('issueCategoriesForVehicle', () => {
  it('shows the drivetrain category for pedal bikes but not for e-scooters', () => {
    const cycleCats = issueCategoriesForVehicle('cycle').map((c) => c.id);
    const scooterCats = issueCategoriesForVehicle('electric_scooter').map((c) => c.id);
    expect(cycleCats).toContain('cat-drivetrain');
    expect(scooterCats).not.toContain('cat-drivetrain');
  });

  it('shows the e-scooter specifics only for e-scooters', () => {
    expect(issueCategoriesForVehicle('electric_scooter').map((c) => c.id)).toContain('cat-scooter');
    expect(issueCategoriesForVehicle('cycle').map((c) => c.id)).not.toContain('cat-scooter');
    expect(issueCategoriesForVehicle('ebike').map((c) => c.id)).not.toContain('cat-scooter');
  });

  it('shows e-bike specifics only for e-bikes', () => {
    expect(issueCategoriesForVehicle('ebike').map((c) => c.id)).toContain('cat-ebike');
    expect(issueCategoriesForVehicle('cycle').map((c) => c.id)).not.toContain('cat-ebike');
  });

  it('never returns an empty category', () => {
    for (const cat of issueCategoriesForVehicle('electric_scooter')) {
      expect(cat.items.length).toBeGreaterThan(0);
    }
  });
});

describe('issueAppliesToVehicle', () => {
  it('hides pedal-only faults on an e-scooter', () => {
    expect(issueAppliesToVehicle('gears-slipping', 'electric_scooter')).toBe(false);
    expect(issueAppliesToVehicle('frame-saddle-uncomfortable', 'electric_scooter')).toBe(false);
    expect(issueAppliesToVehicle('gears-slipping', 'cycle')).toBe(true);
  });

  it('hides scooter-only faults on a pedal bike', () => {
    expect(issueAppliesToVehicle('scooter-throttle', 'cycle')).toBe(false);
    expect(issueAppliesToVehicle('scooter-throttle', 'ebike')).toBe(false);
    expect(issueAppliesToVehicle('scooter-throttle', 'electric_scooter')).toBe(true);
  });

  it('keeps shared faults (brakes, punctures) for every vehicle', () => {
    for (const v of ['cycle', 'ebike', 'electric_scooter', 'cargo'] as const) {
      expect(issueAppliesToVehicle('brakes-squeaky', v)).toBe(true);
      expect(issueAppliesToVehicle('wheels-flat-puncture', v)).toBe(true);
    }
  });

  it('defaults to applying when no vehicle is given', () => {
    expect(issueAppliesToVehicle('scooter-throttle')).toBe(true);
    expect(issueAppliesToVehicle('gears-slipping')).toBe(true);
  });
});

describe('catalog integrity', () => {
  it('has unique issue ids', () => {
    const ids = BIKE_ISSUES_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TIME_SLOT_OPTIONS', () => {
  it('only offers drop-offs from 2:00 PM onwards', () => {
    expect(TIME_SLOT_OPTIONS.length).toBeGreaterThan(0);
    for (const slot of TIME_SLOT_OPTIONS) {
      // Each window starts at or after 14:00.
      const startHour = Number(slot.match(/(\d{2}):\d{2}/)?.[1]);
      expect(startHour).toBeGreaterThanOrEqual(14);
    }
  });
});
