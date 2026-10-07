import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

interface PolicyDisclaimersProps {
  /** The disclaimer lines to show. */
  items: string[];
  /** Heading above the list. */
  title?: string;
  /** `amber` for warnings (refusal rule), `neutral` for plain notes. */
  tone?: 'amber' | 'neutral' | 'emerald';
  className?: string;
  /** Compact renders smaller text for tight spaces like the till panel. */
  compact?: boolean;
}

const TONE = {
  amber: {
    wrap: 'bg-amber-500/10 border-amber-500/40 text-amber-100',
    icon: 'text-amber-400',
    title: 'text-amber-200',
    body: 'text-amber-100/90',
  },
  neutral: {
    wrap: 'bg-neutral-800/60 border-neutral-700 text-neutral-300',
    icon: 'text-neutral-400',
    title: 'text-neutral-200',
    body: 'text-neutral-400',
  },
  emerald: {
    wrap: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100',
    icon: 'text-emerald-400',
    title: 'text-emerald-200',
    body: 'text-emerald-100/90',
  },
} as const;

/**
 * Renders a titled list of trading-policy disclaimers. Kept in one place so the
 * booking flow, the till and the invoice all show identical wording.
 */
export const PolicyDisclaimers: React.FC<PolicyDisclaimersProps> = ({
  items,
  title = 'Workshop terms',
  tone = 'neutral',
  className = '',
  compact = false,
}) => {
  const lines = (items || []).filter(Boolean);
  if (lines.length === 0) return null;
  const t = TONE[tone];

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${t.wrap} ${className}`}>
      <div className={`flex items-center gap-2 font-bold ${compact ? 'text-[11px]' : 'text-xs'} ${t.title}`}>
        {tone === 'amber' ? (
          <ShieldAlert className={`w-4 h-4 shrink-0 ${t.icon}`} />
        ) : (
          <Info className={`w-4 h-4 shrink-0 ${t.icon}`} />
        )}
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      <ul className={`mt-2 space-y-1.5 ${compact ? 'text-[11px]' : 'text-xs'} ${t.body}`}>
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="opacity-60 select-none" aria-hidden="true">
              •
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
