import { describe, it, expect } from 'vitest';
import { completeBikeInspection } from './src/utils/bikeInspection';
import { SPEC_SYSTEMS } from './src/utils/bikeSpecTaxonomy';
describe('bike inspection evidence', () => {
  it('fills missing parts as unknown, requests targeted photos and never claims a stock match', () => {
    const result = completeBikeInspection({ type: 'cycle', mainSpecs: [{ systemId: 'wheels', componentId: 'front-tyre', componentName: 'Front tyre', brand: 'Schwalbe', specValue: '40-622', visibility: 'visible', confidence: .95, condition: 'worn' }] });
    const specs = result.mainSpecs as Array<{ componentId: string; verification: string; condition: string; stockComparison: string }>;
    const photoRequests = result.photoRequests as Array<{ systemId: string }>;
    expect(specs.length).toBe(SPEC_SYSTEMS.reduce((n, system) => n + system.components.length, 0));
    expect(specs.find((s) => s.componentId === 'front-tyre')?.verification).toBe('photo-supported');
    expect(specs.find((s) => s.componentId === 'rear-tyre')?.condition).toBe('unknown');
    expect(photoRequests.some((r) => r.systemId === 'brakes')).toBe(true);
    expect(result.stockVerification.status).toBe('reference-required');
    expect(specs.every((s) => s.stockComparison === 'not-verified')).toBe(true);
  });
});
