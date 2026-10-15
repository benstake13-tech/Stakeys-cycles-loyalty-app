import { KNOWN_BIKE_DATABASE } from './bikeScraperService';
const normalise = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** Saved reference data is a candidate, never a claim that a manufacturer page was fetched. */
export function exactStockReference(bike: { make?: string; model?: string; year?: string; type?: string }) {
  if (!bike.make || !bike.model || !/^\d{4}$/.test(String(bike.year || ''))) return undefined;
  return KNOWN_BIKE_DATABASE.find(r => normalise(r.brand) === normalise(bike.make) && normalise(r.model) === normalise(bike.model) && r.year === String(bike.year) && r.category === bike.type);
}
const codes = (value: unknown) => [...String(value || '').toUpperCase().matchAll(/\b(?:(?:RD|FD|CS|FC|BR|BL|SL|PD|BB)-)?([A-Z]{1,3}\d{3,4}[A-Z]?)\b/g)].map(m => m[1]);
export function compareStockPart(part: { componentName?: string; brand?: string; model?: string; currentPart?: string; verification?: string }, reference: ReturnType<typeof exactStockReference>) {
  const expected = reference?.components.find(c => normalise(c.componentName) === normalise(part.componentName));
  if (!expected || part.verification !== 'photo-supported') return { stockComparison: 'not-verified', stockComparisonNote: 'An exact, checked model-year reference and readable fitted part code are required.' };
  const fittedCodes = codes(`${part.brand || ''} ${part.model || ''} ${part.currentPart || ''}`);
  const referenceCodes = codes(expected.stockOEM);
  if (!fittedCodes.length || !referenceCodes.length) return { stockComparison: 'not-verified', stockComparisonNote: 'Compare exact fitted part numbers with the manufacturer reference before deciding stock status.' };
  const match = fittedCodes.some(code => referenceCodes.includes(code));
  return { stockComparison: match ? 'reference-match-unverified' : 'possible-non-stock',
    stockReference: { part: expected.stockOEM, url: reference!.sourceUrl, year: reference!.year },
    stockComparisonNote: match ? 'Visible code matches the saved reference. Staff must verify the source and exact trim.' : 'Visible code differs from the saved reference: possible non-stock part. Staff must verify the source and exact trim; this does not establish an upgrade or its value.' };
}
