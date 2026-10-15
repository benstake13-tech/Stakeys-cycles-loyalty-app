import { normaliseTechnicalAudit } from './ukVehicleDiagnostics';
import { exactStockReference, compareStockPart } from './stockComparison';
import { normaliseSpecificationDetails } from './bicycleInspectionChecklist';
import { SPEC_SYSTEMS } from './bikeSpecTaxonomy';

export const INSPECTION_PHOTOS = {
  frame: 'Frame decals, size label and serial number in sharp focus',
  wheels: 'Both tyre sidewalls, tread, valves and rims; include the printed sizes',
  brakes: 'Front and rear calipers, rotor markings and visible pad material',
  drivetrain: 'Drive-side crankset, cassette, derailleur and their model markings',
  cockpit: 'Handlebar, stem, shifters and control model markings',
  seating: 'Saddle, seatpost and clamp markings',
  suspension: 'Fork and rear shock labels, stanchions and adjusters',
  electric: 'Motor and battery rating labels and visible wiring; do not open the battery',
  accessories: 'Fitted lights, mudguards, racks and accessories',
  safety: 'Visible damage and reflectors, with a wider view and a close-up',
};
/** Completeness is enforced locally; a short AI response cannot silently omit parts. */
export function completeBikeInspection(result) {
  const provided = Array.isArray(result.mainSpecs) ? result.mainSpecs : [];
  const reference = exactStockReference(result);
  const mainSpecs = SPEC_SYSTEMS.flatMap(system => system.components.map(component => {
    const found = provided.find(s => s.componentId === component.id && (!s.systemId || s.systemId === system.id))
      || provided.find(s => String(s.componentName).toLowerCase() === component.name.toLowerCase());
    const confidence = Math.max(0, Math.min(1, Number(found?.confidence) || 0));
    const confirmed = !['geometry', 'weight', 'payload', 'available-sizes'].includes(component.id) && found?.visibility === 'visible' && confidence >= .8 && Boolean(found.specValue || found.brand || found.model || found.specDetails?.some(d => d?.value));
    return { ...found, systemId: system.id, componentId: component.id, componentName: component.name, category: system.category,
      currentPart: found?.currentPart || 'Not identified', specValue: found?.specValue || '',
      brand: found?.brand || '', model: found?.model || '', condition: found?.condition || 'unknown',
      visibility: found?.visibility || 'assumed', confidence,
      specDetails: normaliseSpecificationDetails(component.id, found?.specDetails, confirmed),
      verification: confirmed ? 'photo-supported' : 'needs-verification',
      stockComparison: 'not-verified', stockOEM: 'Manufacturer reference required',
      notes: found?.notes || 'Not assessed from the supplied photos.',
    };
  })).map(part => ({ ...part, ...compareStockPart(part, reference) }));
  const photoRequests = SPEC_SYSTEMS.filter(system => mainSpecs.some(s => s.systemId === system.id && (s.verification === 'needs-verification' || s.specDetails.some(d => d.verification !== 'photo-supported'))))
    .filter(system => system.id !== 'geometry' && (system.id !== 'electric' || result.type === 'ebike' || result.type === 'electric_scooter' || result.electricKit?.isElectric))
    .map(system => ({ systemId: system.id, area: system.label, instruction: INSPECTION_PHOTOS[system.id] || `Clear close-ups of ${system.label.toLowerCase()} and any part numbers`,
      components: mainSpecs.filter(s => s.systemId === system.id && (s.verification === 'needs-verification' || s.specDetails.some(d => d.verification !== 'photo-supported'))).map(s => s.componentName) }));
  return { ...result, mainSpecs, photoRequests, technicalAudit: normaliseTechnicalAudit(result.technicalAudit),
    notVisible: mainSpecs.filter(s => s.verification !== 'photo-supported').map(s => s.componentName),
    coverage: mainSpecs.filter(s => s.verification === 'photo-supported').length / mainSpecs.length,
    stockVerification: { status: reference ? 'candidate-reference-needs-check' : 'reference-required', referenceUrl: reference?.sourceUrl, reason: 'Exact model year, trim and a checked manufacturer specification are required before claiming stock or modified parts.' },
    workshopChecks: ['Measure tyre pressure and test for leaks: a photograph cannot confirm a puncture.', 'Check brake operation, pad thickness, bearing play, torque and frame integrity in person.'],
  };
}
