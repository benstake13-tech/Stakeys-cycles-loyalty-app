import { describe, it, expect } from 'vitest';
import {
  SPEC_SYSTEMS,
  ALL_SPEC_COMPONENTS,
  systemForComponent,
  systemIdForItem,
  specCoverage,
  systemLabel,
} from './src/utils/bikeSpecTaxonomy';

describe('bike spec taxonomy', () => {
  it('exposes a non-trivial, ordered checklist', () => {
    expect(SPEC_SYSTEMS.length).toBeGreaterThanOrEqual(8);
    expect(ALL_SPEC_COMPONENTS.length).toBeGreaterThanOrEqual(40);
    // Every system carries a label and at least one component.
    for (const system of SPEC_SYSTEMS) {
      expect(system.label).toBeTruthy();
      expect(system.components.length).toBeGreaterThan(0);
    }
  });

  it('keeps component ids globally unique', () => {
    const ids = ALL_SPEC_COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('round-trips systemForComponent for every component', () => {
    for (const system of SPEC_SYSTEMS) {
      for (const component of system.components) {
        expect(systemForComponent(component.id)?.id).toBe(system.id);
      }
    }
    expect(systemForComponent('not-a-part')).toBeUndefined();
  });

  it('resolves an item to its system by id, then by fuzzy name', () => {
    expect(systemIdForItem({ systemId: 'wheels' })).toBe('wheels');
    expect(systemIdForItem({ componentId: 'rear-tyre' })).toBe('wheels');
    expect(systemIdForItem({ componentName: 'Chain' })).toBe('drivetrain');
    expect(systemIdForItem({ componentName: 'nothing here' })).toBeUndefined();
  });

  it('counts coverage, ignoring not_visible items and de-duplicating', () => {
    const coverage = specCoverage([
      { systemId: 'wheels', componentId: 'rear-tyre' },
      { systemId: 'wheels', componentId: 'front-tyre' },
      { systemId: 'drivetrain', componentName: 'Chain' },
      // Duplicate of the first entry — must not double-count.
      { systemId: 'wheels', componentId: 'rear-tyre' },
      // Not visible — must not count.
      { systemId: 'brakes', componentId: 'rotors', visibility: 'not_visible' },
    ]);
    expect(coverage.detected).toBe(3);
    expect(coverage.total).toBe(ALL_SPEC_COMPONENTS.length);
    expect(coverage.perSystem.wheels).toEqual({ detected: 2, total: 10 });
    expect(coverage.perSystem.drivetrain.detected).toBe(1);
    expect(coverage.perSystem.brakes.detected).toBe(0);
    expect(coverage.pct).toBe(Math.round((3 / ALL_SPEC_COMPONENTS.length) * 100));
  });

  it('returns zero coverage for empty input', () => {
    const coverage = specCoverage([]);
    expect(coverage.detected).toBe(0);
    expect(coverage.pct).toBe(0);
    expect(systemLabel('wheels')).toBe('Wheels & Tyres');
    expect(systemLabel('unknown-system')).toBe('unknown-system');
  });
});
