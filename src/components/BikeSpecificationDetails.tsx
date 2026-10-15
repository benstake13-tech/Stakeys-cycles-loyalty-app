import React from 'react';
import type { SpecificationDetail } from '../utils/bicycleInspectionChecklist';
export function BikeSpecificationDetails({ details }: { details?: SpecificationDetail[] }) {
  if (!details?.length) return null;
  return <details className="mt-2 text-xs text-neutral-300"><summary className="cursor-pointer text-emerald-300">Technical details ({details.filter(d => d.value).length}/{details.length} recorded)</summary><dl className="mt-2 space-y-1">{details.map(d => <div key={d.name} className="flex flex-wrap justify-between gap-x-3 border-b border-white/5 py-1"><dt>{d.name}</dt><dd className="text-neutral-400">{d.value || 'Not assessed'}{d.value && d.verification !== 'photo-supported' ? ' · needs verification' : ''}</dd></div>)}</dl></details>;
}
