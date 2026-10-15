import React from 'react';
import { REPAIR_SYSTEMS, REPORT_LIMITATION, validRepairPhotos, readStoredRepairReport, type CustomerRepairReport } from '../utils/customerRepairReport';

export function CustomerRepairReportView({ report, allowPartsSearch = false }: { report: CustomerRepairReport; allowPartsSearch?: boolean }) {
  const clean = readStoredRepairReport(report);
  if (!clean) return <p className="text-xs text-amber-300">This photo report could not be displayed. Read the diagnostic notes below.</p>;
  report = clean;
  const photos = validRepairPhotos(report.photos);
  return <div className="space-y-4 text-sm" data-testid="customer-repair-report">
    <div className={`rounded-xl border p-4 ${report.stopRiding ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-emerald-500/25 bg-emerald-500/5 text-neutral-200'}`}>
      <p className="text-xs font-semibold text-emerald-300">{report.mode === 'ai-review' ? 'Preliminary photo review' : 'Photos for workshop review'}</p>
      {report.stopRiding && <p className="font-bold mt-2">Do not ride until inspected. Contact the workshop to arrange safe transport.</p>}
      <p className="mt-2">{report.summary}</p>
      <p className="mt-2 text-xs text-neutral-400">{REPORT_LIMITATION}</p>
    </div>
    {report.findings.map((f, i) => <div key={i} className="surface-panel p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-white">{f.component}</h4><span className={`text-xs ${f.severity === 'urgent' ? 'text-rose-300' : 'text-amber-300'}`}>{f.severity} · {f.source === 'photo' ? 'photo observation' : f.source === 'customer' ? 'customer reported' : 'possible cause'}</span></div>
      <p className="text-neutral-300">{f.observation}</p>
      {f.photoIds.length > 0 && <p className="text-xs text-neutral-400">Evidence: {f.photoIds.map(id => photos.find(p => p.id === id)?.label || id).join(', ')}</p>}
      {f.possibleCauses.length > 0 && <p className="text-xs text-neutral-400">Possible causes to check: {f.possibleCauses.join('; ')}</p>}
      <p className="text-xs text-neutral-300">Workshop checks: {f.workshopChecks.join('; ') || 'Mechanic assessment required.'}</p>
      {f.replacement && <div className="border-t border-neutral-700 pt-2 space-y-1 text-xs text-neutral-300">
        <p className="font-semibold text-emerald-300">Replacement part to verify: {f.replacement.part}</p>
        <p>Readable markings: {f.replacement.markings || 'Not readable — close-up needed'}</p>
        <p>Search reference: {f.replacement.searchQuery || f.replacement.part}</p>
        <p>Compatibility checks: {f.replacement.compatibilityChecks.join('; ')}</p>
        <p className="text-amber-300">Identification lead only. Staff must confirm fit, supplier stock and price.</p>
        {allowPartsSearch && <a className="inline-block text-emerald-300 underline" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(f.replacement.searchQuery || [f.replacement.part, f.replacement.markings].filter(Boolean).join(' '))}`}>Search replacement candidates</a>}
      </div>}
    </div>)}
    <details className="surface-panel p-4">
      <summary className="cursor-pointer font-semibold text-neutral-200">Whole-bike inspection coverage</summary>
      <ul className="mt-3 space-y-3 text-xs">{report.systems.map(s => <li key={s.id}><strong className="text-neutral-200">{REPAIR_SYSTEMS.find(x => x.id === s.id)?.label || s.id}</strong><span className="text-neutral-400"> · {s.status === 'not-assessed' ? 'Needs workshop assessment' : s.status === 'concern' ? 'Possible concern' : 'No obvious external issue; function untested'}</span><p className="text-neutral-400 mt-1">{s.note}</p></li>)}</ul>
    </details>
    {photos.length > 0 && <details className="surface-panel p-4"><summary className="cursor-pointer font-semibold text-neutral-200">Attached photo evidence ({photos.length})</summary><div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">{photos.map(p => <figure key={p.id}><a href={p.dataUrl} download={`stakeys-repair-${p.id}.jpg`}><img src={p.dataUrl} alt={p.label} className="rounded-lg w-full aspect-square object-contain bg-black/20" loading="lazy" /></a><figcaption className="mt-1 text-xs text-neutral-400">{p.label}</figcaption></figure>)}</div></details>}
  </div>;
}
