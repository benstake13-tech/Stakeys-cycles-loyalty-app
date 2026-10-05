import React, { useState } from 'react';
import { Scale, X, ShieldAlert, ChevronDown } from 'lucide-react';
import { LEGAL_DISCLAIMER_SECTIONS, LEGAL_DISCLAIMER_UPDATED } from '../data/legalDisclaimers';

interface SectionsProps {
  /** 'accordion' collapses each section (inline); 'plain' lists everything (modal). */
  variant?: 'accordion' | 'plain';
  idPrefix?: string;
}

/** Renders the disclaimer sections; the accordion form is used inline, plain in the modal. */
export const LegalDisclaimerSections: React.FC<SectionsProps> = ({
  variant = 'accordion',
  idPrefix = 'legal',
}) => {
  const [openId, setOpenId] = useState<string | null>(variant === 'accordion' ? null : null);

  return (
    <div className="space-y-2">
      {LEGAL_DISCLAIMER_SECTIONS.map((section) => {
        const isOpen = variant === 'plain' || openId === section.id;
        const body = (
          <div className="space-y-2 pt-1">
            {section.paragraphs.map((p, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-neutral-300">
                {p}
              </p>
            ))}
            {section.bullets.length > 0 && (
              <ul className="space-y-1.5">
                {section.bullets.map((b, i) => (
                  <li key={i} className="text-[11px] leading-relaxed text-neutral-300 flex gap-2">
                    <span className="text-emerald-400 shrink-0">•</span>
                    <span>
                      {b.label && <span className="font-semibold text-white">{b.label}: </span>}
                      {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

        if (variant === 'plain') {
          return (
            <div key={section.id} className="border-b border-neutral-800/70 last:border-0 pb-3 last:pb-0">
              <h4 className="text-xs font-bold text-white mb-1">{section.title}</h4>
              {body}
            </div>
          );
        }

        return (
          <div key={section.id} className="rounded-lg border border-neutral-800 bg-[#090b0e] overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-neutral-900/60"
            >
              <span className="text-[11px] font-semibold text-white text-left">{section.title}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && <div className="px-3 pb-3">{body}</div>}
          </div>
        );
      })}
    </div>
  );
};

/** Compact footer trigger that opens the full disclaimer set in a modal. */
export const LegalDisclaimersButton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`underline underline-offset-2 hover:text-emerald-400 cursor-pointer ${
          isDark ? 'text-neutral-400' : 'text-neutral-600'
        }`}
      >
        Legal disclaimers
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Legal disclaimers"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 shadow-2xl text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold flex items-center gap-2 text-white">
                <Scale className="w-5 h-5 text-emerald-400" />
                Legal Disclaimers &amp; Service Terms
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-neutral-800 bg-[#090b0e] px-3 py-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                These terms apply to all workshop, mobile call-out and home-workshop servicing. Last updated{' '}
                {LEGAL_DISCLAIMER_UPDATED}.
              </p>
            </div>
            <LegalDisclaimerSections variant="plain" />
          </div>
        </div>
      )}
    </>
  );
};

export default LegalDisclaimersButton;
