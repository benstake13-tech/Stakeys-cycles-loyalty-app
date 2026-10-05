import { describe, it, expect } from 'vitest';
import {
  MAINTENANCE_PACKAGES,
  findMaintenancePackage,
} from './src/data/maintenancePackages';

describe('maintenance packages', () => {
  it('defines the three standardised seasonal packages', () => {
    expect(MAINTENANCE_PACKAGES.map((p) => p.id)).toEqual([
      'pkg-winterization',
      'pkg-presummer',
      'pkg-scooter-battery-audit',
    ]);
  });

  it('every package has a name, description, checks and a season label', () => {
    for (const p of MAINTENANCE_PACKAGES) {
      expect(p.name.length, `${p.id} name`).toBeGreaterThan(0);
      expect(p.description.length, `${p.id} description`).toBeGreaterThan(0);
      expect(p.checks.length, `${p.id} checks`).toBeGreaterThan(0);
      expect(p.seasonLabel.length, `${p.id} seasonLabel`).toBeGreaterThan(0);
      expect(p.appliesTo.length, `${p.id} appliesTo`).toBeGreaterThan(0);
    }
  });

  it('covers the core checks: brakes, chain lube, tyre pressure', () => {
    const winter = findMaintenancePackage('pkg-winterization')!;
    const ids = winter.checks.map((c) => c.id);
    expect(ids).toContain('win-brakes');
    expect(ids).toContain('win-chain');
    expect(ids).toContain('win-tyres');

    const summer = findMaintenancePackage('pkg-presummer')!;
    const sIds = summer.checks.map((c) => c.id);
    expect(sIds).toContain('sum-brakes');
    expect(sIds).toContain('sum-chain');
    expect(sIds).toContain('sum-tyres');
  });

  it('includes e-scooter battery & brake safety audit checks', () => {
    const audit = findMaintenancePackage('pkg-scooter-battery-audit')!;
    const ids = audit.checks.map((c) => c.id);
    expect(ids).toContain('aud-battery-health');
    expect(ids).toContain('aud-charging');
    expect(ids).toContain('aud-brake-mech');
    expect(ids).toContain('aud-brake-electronic');
    // The audit is scooter-only.
    expect(audit.appliesTo).toEqual(['electric_scooter']);
  });

  it('offers the seasonal packages to pedal and e-bikes but not to a pedal-only tune for scooters unless applicable', () => {
    const winter = findMaintenancePackage('pkg-winterization')!;
    expect(winter.appliesTo).toContain('cycle');
    expect(winter.appliesTo).toContain('ebike');
    expect(winter.appliesTo).toContain('electric_scooter');
  });

  it('each check only applies to vehicles in the package appliesTo set', () => {
    for (const p of MAINTENANCE_PACKAGES) {
      for (const c of p.checks) {
        for (const cat of c.appliesTo) {
          expect(p.appliesTo, `${p.id}/${c.id} -> ${cat}`).toContain(cat);
        }
      }
    }
  });

  it('every package maps to a real backend service id', () => {
    const known = ['cycle-tune', 'scooter-battery', 'scooter-overhaul', 'ebike-complete', 'cycle-overhaul'];
    for (const p of MAINTENANCE_PACKAGES) {
      expect(known, `${p.id} serviceId`).toContain(p.serviceId);
    }
  });
});
