import React, { useState } from 'react';
import { BookOpen, ChevronLeft, Clock, AlertTriangle, Wrench, ArrowRight } from 'lucide-react';
import { CARE_GUIDES, CareGuide } from '../data/customerGuides';

interface CareGuidesProps {
  /** Route to the booking tab from a "book a service" guide CTA. */
  onGoToBooking?: () => void;
}

/**
 * Customer-facing how-to / care guides: a lightweight viewer over a curated
 * subset of the workshop knowledge base, with short step-by-step articles.
 */
export const CareGuides: React.FC<CareGuidesProps> = ({ onGoToBooking }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const guide: CareGuide | undefined = CARE_GUIDES.find((g) => g.id === openId);

  if (guide) {
    return (
      <div className="space-y-5" data-testid="care-guide-viewer">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> All guides
        </button>

        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            <Clock className="w-3.5 h-3.5" /> {guide.minutes} min
            {guide.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800">{t}</span>
            ))}
          </div>
          <h2 className="font-display text-2xl font-bold text-white">{guide.title}</h2>
          <p className="text-sm text-neutral-300">{guide.summary}</p>

          {guide.warning && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-xs">{guide.warning}</span>
            </div>
          )}

          <ol className="space-y-4 pt-2">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div>
                  <div className="font-semibold text-white text-sm">{s.title}</div>
                  <p className="text-sm text-neutral-300 mt-0.5 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {onGoToBooking && (
            <button
              type="button"
              onClick={onGoToBooking}
              className="mt-2 px-4 py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Wrench className="w-4 h-4" /> Rather leave it to us? Book a service
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="care-guides">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-400" /> How-To & Care Guides
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Short, practical guides for looking after your ride between workshop visits.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARE_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            data-testid={`guide-card-${g.id}`}
            onClick={() => setOpenId(g.id)}
            className="text-left rounded-2xl border border-neutral-800 bg-[#0d1015] hover:border-emerald-500/40 p-5 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
              <Clock className="w-3 h-3" /> {g.minutes} min
            </div>
            <div className="font-semibold text-white">{g.title}</div>
            <div className="text-xs text-neutral-400 mt-1.5">{g.summary}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {g.tags.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-neutral-500">
        Care guidance is adapted from Sheldon Brown's bicycle technical information (sheldonbrown.com). Always follow the
        manufacturer's specification for your exact parts.
      </p>
    </div>
  );
};

export default CareGuides;
