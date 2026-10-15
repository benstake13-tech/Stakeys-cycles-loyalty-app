import { normaliseSpecificationDetails, type SpecificationDetail } from './bicycleInspectionChecklist';
import { ALL_SPEC_COMPONENTS } from './bikeSpecTaxonomy';
/** A preliminary customer report, never a mechanic's diagnosis or a parts order. */
export interface RepairPhoto { id: string; label: string; dataUrl: string }
export interface RepairFinding {
  component: string;
  observation: string;
  source: 'photo' | 'customer' | 'possible';
  severity: 'urgent' | 'attention' | 'minor';
  photoIds: string[];
  possibleCauses: string[];
  workshopChecks: string[];
  replacement?: { part: string; markings: string; searchQuery: string; compatibilityChecks: string[]; status: 'unverified' };
}
export interface CustomerRepairReport {
  version: 1;
  createdAt: string;
  mode: 'ai-review' | 'customer-description';
  model?: string;
  bike: string;
  customerDescription: string;
  symptoms: string[];
  summary: string;
  stopRiding: boolean;
  findings: RepairFinding[];
  specifications?: { componentId: string; componentName: string; photoIds: string[]; details: SpecificationDetail[] }[];
  systems: { id: string; status: 'concern' | 'no-obvious-issue' | 'not-assessed'; note: string }[];
  photoRequests: { area: string; instruction: string; reason: string }[];
  questions: string[];
  answers: Record<string, string>;
  photos: RepairPhoto[];
}

export const REPAIR_SYSTEMS = [
  { id: 'structure', label: 'Frame, fork & crash damage', checks: 'Cracks, dents, corrosion, dropouts, carbon impact damage; hidden damage requires workshop inspection.' },
  { id: 'brakes', label: 'Brakes', checks: 'Rim/disc, cable/hydraulic, pads, rotors, hoses, levers, leaks; braking power and wear thickness need testing.' },
  { id: 'tyres', label: 'Tyres, tubes & tubeless', checks: 'Sidewall ETRTO size, casing cuts, tread, valve, bead, rim tape, tubeless sealant; a flat tyre is not proof of a puncture.' },
  { id: 'wheels', label: 'Wheels, hubs & axles', checks: 'Rims, spokes, hubs, bearings, wheel retention and axle standards; tension, trueness and play require measurement.' },
  { id: 'drivetrain', label: 'Chain, gears & pedals', checks: 'Chain, cassette/freewheel, chainrings, derailleur/hanger, cables, hub gears, electronic shifting, cranks, pedals; measure wear and compatibility.' },
  { id: 'bearings', label: 'Headset, bottom bracket & bearings', checks: 'Steering, creaks, roughness, play, bearing standards; internal condition cannot be diagnosed from an external photo.' },
  { id: 'suspension', label: 'Suspension & dropper', checks: 'Fork/shock seals, stanchions, linkage, dropper post, oil leaks; service intervals and pressure are manufacturer-specific.' },
  { id: 'contact', label: 'Handlebars, saddle & controls', checks: 'Stem, bars, grips, seatpost, saddle rails, clamps and controls; torque and fit need physical checks.' },
  { id: 'electric', label: 'E-bike motor, battery & electronics', checks: 'Factory or converted system, exact display code, motor, speed sensor, connectors and battery labels. Never open batteries, probe live wires or assume cross-brand compatibility.' },
  { id: 'accessories', label: 'Cargo, lights & accessories', checks: 'Racks, mudguards, lights, child/cargo fittings, chain guards and locks; attachment/load limits need manufacturer verification.' },
] as const;
export const MAX_REPAIR_PHOTOS = 6;
export const MAX_REPAIR_PHOTO_CHARS = 110_000;
export const REPORT_LIMITATION = 'Preliminary photo and symptom review only. Hidden faults, punctures, wear measurements and safe operation require a mechanic. Replacement parts need compatibility checks before ordering.';
const text = (v: unknown, max = 600) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const list = (v: unknown, max = 8): string[] => Array.isArray(v) ? v.map(x => text(x)).filter(Boolean).slice(0, max) : [];
export function validRepairPhotos(photos: RepairPhoto[]): RepairPhoto[] {
  return (Array.isArray(photos) ? photos : []).slice(0, MAX_REPAIR_PHOTOS).filter(p => p && typeof p.id === 'string' && typeof p.label === 'string' && typeof p.dataUrl === 'string' && p.id && p.label && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.dataUrl) && p.dataUrl.length <= MAX_REPAIR_PHOTO_CHARS).map(p => ({ id: text(p.id, 100), label: text(p.label, 120), dataUrl: p.dataUrl }));
}

export interface RepairReportInput { bike: string; symptoms: string[]; notes: string; photos: RepairPhoto[]; answers: Record<string, string>; safetyConcern: boolean }
export function normaliseRepairReport(raw: unknown, input: RepairReportInput, model?: string): CustomerRepairReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('The photo review was incomplete. Try again or attach your photos for staff.');
  const r = raw as Record<string, any>;
  if (!text(r.summary) || !Array.isArray(r.findings) || !Array.isArray(r.systems)) throw Error('The photo review was incomplete. Try again or attach your photos for staff.');
  const photos = validRepairPhotos(input.photos);
  const ids = new Set(photos.map(p => p.id));
  const findings: RepairFinding[] = r.findings.slice(0, 16).map((f: any): RepairFinding | null => {
    if (!f || typeof f !== 'object') return null;
    const photoIds = list(f.photoIds).filter(id => ids.has(id));
    const source = f.source === 'customer' ? 'customer' : f.source === 'photo' && photoIds.length ? 'photo' : 'possible';
    const replacement = f.replacement && text(f.replacement.part) ? {
      part: text(f.replacement.part), markings: text(f.replacement.markings),
      searchQuery: text(f.replacement.searchQuery, 250),
      compatibilityChecks: [...new Set([...list(f.replacement.compatibilityChecks), 'Staff must confirm the fitted model, dimensions and compatibility before ordering.'])],
      status: 'unverified' as const,
    } : undefined;
    return { component: text(f.component, 120) || 'Unidentified component', observation: text(f.observation), source,
      severity: f.severity === 'urgent' ? 'urgent' : f.severity === 'minor' ? 'minor' : 'attention',
      photoIds, possibleCauses: list(f.possibleCauses), workshopChecks: list(f.workshopChecks), ...(replacement ? { replacement } : {}) };
  }).filter((f: RepairFinding | null): f is RepairFinding => Boolean(f?.observation));
  return {
    version: 1, createdAt: new Date().toISOString(), mode: 'ai-review', model: text(model, 100),
    bike: input.bike, symptoms: [...input.symptoms], customerDescription: input.notes, photos,
    summary: text(r.summary, 1200), stopRiding: input.safetyConcern || r.stopRiding === true || findings.some(f => f.severity === 'urgent'),
    specifications: Array.isArray(r.specifications) ? ALL_SPEC_COMPONENTS.map(component => {
      const supplied = r.specifications.find((s: any) => s?.componentId === component.id);
      const photoIds = list(supplied?.photoIds).filter(id => ids.has(id));
      return { componentId: component.id, componentName: component.name, photoIds, details: normaliseSpecificationDetails(component.id, supplied?.details, photoIds.length > 0) };
    }) : undefined,
    findings, systems: REPAIR_SYSTEMS.map(s => {
      const found = r.systems.find((v: any) => v && v.id === s.id);
      const status = photos.length && ['concern', 'no-obvious-issue'].includes(found?.status) ? found.status : 'not-assessed';
      return { id: s.id, status, note: text(found?.note) || 'Not assessed; workshop inspection required.' };
    }),
    photoRequests: (Array.isArray(r.photoRequests) ? r.photoRequests : []).filter((p: any) => p && text(p.area) && text(p.instruction)).slice(0, 6).map((p: any) => ({ area: text(p.area, 100), instruction: text(p.instruction), reason: text(p.reason) })),
    questions: list(r.questions, 6), answers: { ...input.answers },
  };
}
export function descriptionOnlyReport(input: RepairReportInput): CustomerRepairReport {
  return { ...normaliseRepairReport({ summary: 'Customer photos and symptoms attached for a mechanic. AI analysis has not been completed.', findings: [], systems: [] }, input), mode: 'customer-description' };
}
export function readStoredRepairReport(raw: unknown): CustomerRepairReport | null {
  if (!raw || typeof raw !== 'object' || (raw as any).version !== 1) return null;
  const r = raw as CustomerRepairReport;
  try {
    const answers = Object.fromEntries(Object.entries(r.answers && typeof r.answers === 'object' ? r.answers : {}).slice(0, 12).map(([q, a]) => [text(q, 300), text(a, 800)]));
    const clean = normaliseRepairReport(r, { bike: text(r.bike), symptoms: list(r.symptoms, 40), notes: text(r.customerDescription, 4000), photos: validRepairPhotos(r.photos), answers, safetyConcern: r.stopRiding === true }, r.model);
    return { ...clean, mode: r.mode === 'ai-review' ? 'ai-review' : 'customer-description', createdAt: text(r.createdAt, 60) };
  } catch { return null; }
}
export function formatRepairReport(report: CustomerRepairReport): string {
  return [
    'CUSTOMER PHOTO REPAIR REPORT — mechanic verification required',
    `Review: ${report.mode === 'ai-review' ? 'AI preliminary assessment' : 'Customer description only'} · ${report.createdAt}`,
    `Bike: ${report.bike}`, `Customer says: ${report.customerDescription || 'See selected symptoms.'}`,
    `Symptoms: ${report.symptoms.join('; ') || 'Not specified'}`,
    report.stopRiding ? 'PRIORITY: Do not ride until inspected. Arrange safe transport with the workshop.' : 'Safety status: not established from photographs.',
    `Summary: ${report.summary}`,
    ...report.findings.map((f, i) => [
      `${i + 1}. ${f.component} [${f.severity}; ${f.source}] — ${f.observation}`,
      f.photoIds.length ? `Evidence: ${f.photoIds.join(', ')}` : '',
      f.possibleCauses.length ? `Possible causes (not confirmed): ${f.possibleCauses.join('; ')}` : '',
      `Workshop checks: ${f.workshopChecks.join('; ') || 'Mechanic assessment required.'}`,
      f.replacement ? `Replacement to verify: ${f.replacement.part}. Visible markings: ${f.replacement.markings || 'Unreadable'}. Search query: ${f.replacement.searchQuery || f.replacement.part}. Compatibility: ${f.replacement.compatibilityChecks.join('; ')}` : '',
    ].filter(Boolean).join('\n')),
    ...(report.specifications || []).flatMap(s => s.details.filter(d => d.value).map(d => `Fitted spec — ${s.componentName}: ${d.name}: ${d.value} [${d.verification}]`)),
    'SYSTEM CHECKLIST', ...report.systems.map(s => `${REPAIR_SYSTEMS.find(x => x.id === s.id)?.label || s.id}: ${s.status} — ${s.note}`),
    ...Object.entries(report.answers).filter(([, a]) => a.trim()).map(([q, a]) => `Customer answer — ${q}: ${a}`),
    ...report.photoRequests.map(p => `More detail needed — ${p.area}: ${p.instruction} ${p.reason}`),
    ...report.questions.filter(q => !report.answers[q]?.trim()).map(q => `Unanswered: ${q}`),
    `Photo evidence attached: ${report.photos.length}.`, REPORT_LIMITATION,
  ].filter(Boolean).join('\n');
}
