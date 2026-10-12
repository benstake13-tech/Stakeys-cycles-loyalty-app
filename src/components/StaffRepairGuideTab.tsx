import React, { useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

// The guide is a static bundle in a PUBLIC repo, so its Gemini key is not baked
// in at build time. Expose ours on the host window; the same-origin iframe reads
// it at runtime (see hangerAi.ts). Set once, before the frame mounts.
const guideKey = import.meta.env.VITE_GEMINI_API_KEY;
if (typeof guideKey === 'string' && guideKey) {
  (window as unknown as { __STAKEYS_GEMINI_KEY__?: string }).__STAKEYS_GEMINI_KEY__ = guideKey;
}

/**
 * The Stakeys Cycles Workshop Repair & Training Guide — a self-contained React
 * app (adapted from Sheldon Brown's bicycle technical information) served as a
 * static bundle from public/guide/. It runs in its own document so its styles
 * and localStorage progress never collide with the staff terminal.
 */
export const StaffRepairGuideTab: React.FC = () => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [full, setFull] = useState(false);
  // Bumping this remounts the iframe, which is the reliable way to force a
  // reload of a cross-origin-ish child document.
  const [nonce, setNonce] = useState(0);

  const src = `${import.meta.env.BASE_URL}guide/index.html`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 surface-panel p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/40 bg-black shadow-[0_0_18px_rgba(5,193,71,0.25)]">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Stakey's Cycles &amp; Scooter" className="h-full w-full object-contain" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Workshop Repair Guide</h2>
            <p className="text-xs text-neutral-400">
              30 modules · 85 lessons · derailleur hanger identifier · step-by-step procedures adapted from Sheldon Brown
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            data-testid="guide-reload"
            className="pressable inline-flex items-center gap-2 surface-panel px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reload</span>
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="guide-open-new"
            className="pressable inline-flex items-center gap-2 surface-panel px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            <span>New tab</span>
          </a>
          <button
            type="button"
            onClick={() => setFull((f) => !f)}
            data-testid="guide-fullscreen"
            className="pressable inline-flex items-center gap-2 rounded-xl border border-[#05C147]/50 bg-[#05C147]/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-[#05C147]/25 hover:text-white"
          >
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{full ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      <div
        className={
          full
            ? 'fixed inset-0 z-50 bg-[#090b0e]'
            : 'overflow-hidden surface-panel'
        }
      >
        <iframe
          ref={frameRef}
          key={nonce}
          src={src}
          title="Stakeys Cycles Workshop Repair Guide"
          data-testid="guide-frame"
          className={full ? 'h-full w-full' : 'h-[78vh] min-h-[560px] w-full'}
        />
      </div>
    </div>
  );
};

export default StaffRepairGuideTab;
