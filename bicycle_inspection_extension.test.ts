import { describe, expect, it } from 'vitest';
import { COMPONENT_SPEC_FIELDS, normaliseSpecificationDetails, EXTENDED_FAULT_CHECKLIST } from './src/utils/bicycleInspectionChecklist';
import { completeBikeInspection } from './src/utils/bikeInspection';
import { normaliseRepairReport, formatRepairReport, readStoredRepairReport } from './src/utils/customerRepairReport';
import { SPEC_SYSTEMS } from './src/utils/bikeSpecTaxonomy';
import { REPAIR_ASSESSMENT_PROMPT } from './src/api/customerRepairAssessment';

describe('additive bicycle inspection brief', () => {
  it('covers detailed fields for every existing and added component', () => {
    for (const system of SPEC_SYSTEMS) for (const part of system.components) expect(COMPONENT_SPEC_FIELDS[part.id]?.length).toBeGreaterThan(0);
    expect(Object.values(COMPONENT_SPEC_FIELDS).flat().length).toBeGreaterThan(150);
    expect(COMPONENT_SPEC_FIELDS.geometry).toContain('Trail');
    expect(COMPONENT_SPEC_FIELDS['rear-hub']).toContain('Engagement points / degrees');
    expect(COMPONENT_SPEC_FIELDS['rear-shock']).toContain('Eye-to-eye');
  });
  it('fills unknown fields and never treats geometry, weights or load limits as photo measurements', () => {
    const tyre = normaliseSpecificationDetails('front-tyre', [{ name: 'ETRTO size', value: '40-622' }], true);
    expect(tyre.find(d => d.name === 'ETRTO size')?.verification).toBe('photo-supported');
    expect(tyre.find(d => d.name === 'TPI')?.verification).toBe('not-assessed');
    expect(normaliseSpecificationDetails('geometry', [{ name: 'Trail', value: '60mm' }], true)[14].verification).toBe('needs-verification');
    expect(normaliseSpecificationDetails('payload', [{ name: 'Maximum total system weight', value: '120kg' }], true)[0].verification).toBe('needs-verification');
  });
  it('keeps original identification, condition and stock checks with targeted retakes', () => {
    const result = completeBikeInspection({type:'cycle', mainSpecs:[{componentId:'front-tyre',specValue:'40-622',visibility:'visible',confidence:.95,specDetails:[{name:'ETRTO size',value:'40-622'}]}]});
    expect(result.mainSpecs.find((s:any)=>s.componentId==='front-tyre')?.specDetails.find((d:any)=>d.name==='ETRTO size')?.value).toBe('40-622');
    expect(result.photoRequests.some((p:any)=>p.systemId==='wheels')).toBe(true);
    expect(result.photoRequests.some((p:any)=>p.systemId==='geometry')).toBe(false);
    expect(result.stockVerification.status).toBe('reference-required');
  });
  it('preserves evidence-backed technical details in reports and staff notes, downgrading invented evidence', () => {
    const input={bike:'Trek FX',symptoms:[],notes:'Flat tyre',answers:{},safetyConcern:false,photos:[{id:'p1',label:'Sidewall',dataUrl:'data:image/jpeg;base64,AAAA'}]};
    const raw={summary:'Leak test required',findings:[],systems:[],specifications:[{componentId:'front-tyre',photoIds:['p1'],details:[{name:'ETRTO size',value:'40-622'}]},{componentId:'geometry',photoIds:['p1'],details:[{name:'Reach',value:'400mm'}]}]};
    const report=normaliseRepairReport(raw,input);
    expect(formatRepairReport(report)).toContain('ETRTO size: 40-622 [photo-supported]');
    expect(readStoredRepairReport(report)?.specifications?.find((s:any)=>s.componentId==='geometry')?.details[0].verification).toBe('needs-verification');
    const invalid=normaliseRepairReport({...raw,specifications:[{...raw.specifications[0],photoIds:['invented']}]},input);
    expect(invalid.specifications?.find((s:any)=>s.componentId==='front-tyre')?.details.find((d:any)=>d.name==='ETRTO size')?.verification).toBe('needs-verification');
  });
  it('adds the mechanical fault sweep without universal wear thresholds or customer dismantling tests', () => {
    expect(REPAIR_ASSESSMENT_PROMPT).toContain(EXTENDED_FAULT_CHECKLIST);
    expect(REPAIR_ASSESSMENT_PROMPT).toContain('manufacturer wear limit');
    expect(REPAIR_ASSESSMENT_PROMPT).toContain('Keep the original findings');
    expect(REPAIR_ASSESSMENT_PROMPT).toContain('Never provide a safe-to-ride clearance');
  });
});
