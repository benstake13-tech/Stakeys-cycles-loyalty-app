import { describe, it, expect } from 'vitest';
import { calculateDerailleurCapacity, normaliseTechnicalAudit, UK_DIAGNOSTIC_PROMPT } from './src/utils/ukVehicleDiagnostics';
import { normaliseRepairReport, readStoredRepairReport, formatRepairReport } from './src/utils/customerRepairReport';
describe('UK technical audit', () => {
  it('calculates double and single chainring capacity without granting overall compatibility', () => {
    const double = calculateDerailleurCapacity({ frontSmall: 34, frontLarge: 50, rearSmall: 11, rearLarge: 34, ratedCapacity: 39, ratedMaxCog: 34 });
    expect(double.required).toBe(39); expect(double.status).toBe('within-entered-limits'); expect(double.message).toContain('does not establish');
    expect(calculateDerailleurCapacity({ frontSmall: 32, frontLarge: 32, rearSmall: 10, rearLarge: 51 }).required).toBe(41);
  });
  it('checks maximum sprocket independently of capacity', () => {
    const result = calculateDerailleurCapacity({ frontSmall: 32, frontLarge: 32, rearSmall: 11, rearLarge: 46, ratedCapacity: 45, ratedMaxCog: 42 });
    expect(result.capacityExceeded).toBe(false); expect(result.maxCogExceeded).toBe(true); expect(result.status).toBe('conflict');
    expect(calculateDerailleurCapacity({ frontSmall: 34, frontLarge: 50, rearSmall: 11, rearLarge: 36, ratedCapacity: 39, ratedMaxCog: 36 }).capacityExceeded).toBe(true);
  });
  it('does not approve unknown, reversed or malformed inputs', () => {
    for (const frontSmall of [undefined, NaN, -1, 0, 1.5]) expect(calculateDerailleurCapacity({ frontSmall, frontLarge: 50, rearSmall: 11, rearLarge: 34 }).status).toBe('incomplete');
    expect(calculateDerailleurCapacity({ frontSmall: 50, frontLarge: 34, rearSmall: 11, rearLarge: 34 }).status).toBe('incomplete');
    expect(calculateDerailleurCapacity({ frontSmall: 34, frontLarge: 50, rearSmall: 11, rearLarge: 34 }).status).toBe('unverified');
  });
  it('preserves the structured audit through saved customer and staff reports', () => {
    const report = normaliseRepairReport({ summary: 'Needs inspection', findings: [], systems: [], technicalAudit: { compatibility: ['Unverified shifter model: close-up needed.'], legal: ['Throttle approval needs checking.'] } }, { bike: 'Unknown', symptoms: [], notes: '', photos: [], answers: {}, safetyConcern: false });
    const restored = readStoredRepairReport(JSON.parse(JSON.stringify(report)))!;
    expect(restored.technicalAudit?.compatibility).toEqual(report.technicalAudit?.compatibility);
    expect(formatRepairReport(restored)).toContain('Compatibility & Component Mismatch Report');
    expect(formatRepairReport(restored)).toContain('Unverified shifter model');
  });
  it('handles missing and malformed audit output without invented findings', () => {
    expect(normaliseTechnicalAudit(null)).toEqual({ profile: [], legal: [], compatibility: [], wear: [], remediation: [] });
    expect(normaliseTechnicalAudit({ legal: [null, 5, '  review needed  '] }).legal).toEqual(['review needed']);
    expect(UK_DIAGNOSTIC_PROMPT).toContain('not blue/orange cap colour');
  });
});
