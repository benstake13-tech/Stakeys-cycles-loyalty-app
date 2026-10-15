import React from 'react';
import { BikeIdentificationEngine } from './BikeIdentificationEngine';

/** Marketplace adapter for the app's existing bike identifier. */
/** @param {{ user?: any, mode?: string, isOpen: boolean, onClose: () => void, onIdentified: (result: any) => void }} props */
export function AiBikeIdentifier({ isOpen, onClose, onIdentified }) {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4">
    <section role="dialog" aria-modal="true" aria-label="Identify bike with AI" className="w-full max-w-xl rounded-2xl border border-emerald-400/30 bg-neutral-950 p-5 text-white">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Identify bike with AI</h2><button type="button" onClick={onClose} aria-label="Close AI identifier" className="rounded-lg border border-white/20 px-3 py-2">Close</button></div>
      <p className="mb-4 text-sm text-neutral-300">Use the same bike identifier as your garage. The suggestion and component assessment are for review; you can correct the make and model before submitting.</p>
      <BikeIdentificationEngine onAnalysisComplete={(analysis) => {
        const bike = analysis?.identified_bike || {};
        onIdentified?.({ ...analysis, ...bike, mainSpecs: analysis?.mainSpecs || bike.mainSpecs || [], confidence: analysis?.confidence ?? bike.confidence ?? 0, coverage: analysis?.coverage ?? bike.coverage ?? 0, hasVisualData: true, usedFallback: false });
        onClose();
      }} />
    </section>
  </div>;
}
