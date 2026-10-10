import React, { useRef, useState } from 'react';
import { BookOpen, ExternalLink, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[#0b0e13] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Workshop Repair Guide</h2>
            <p className="text-xs text-neutral-400">
              11 modules · 29 lessons · step-by-step procedures adapted from Sheldon Brown
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            data-testid="guide-reload"
            className="pressable inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#0b0e13] px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reload</span>
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="guide-open-new"
            className="pressable inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#0b0e13] px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            <span>New tab</span>
          </a>
          <button
            type="button"
            onClick={() => setFull((f) => !f)}
            data-testid="guide-fullscreen"
            className="pressable inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 hover:text-white"
          >
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{full ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      <div
        className={
          full
            ? 'fixed inset-0 z-50 bg-[#070b14]'
            : 'overflow-hidden rounded-2xl border border-neutral-800 bg-[#070b14]'
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
