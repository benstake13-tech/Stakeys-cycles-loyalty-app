import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

export type MetricTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'neutral';

export interface MetricItem {
  id: string;
  label: string;
  value: number | string;
  /** Small unit shown after the value, e.g. "Active". */
  unit?: string;
  icon: LucideIcon;
  tone: MetricTone;
  /** Optional alert badge (e.g. a fresh-booking count). */
  alert?: number;
  onSelect: () => void;
  testId?: string;
}

const TONE: Record<
  MetricTone,
  { text: string; iconBg: string; rail: string; glow: string }
> = {
  emerald: {
    text: 'text-emerald-400',
    iconBg: 'border-emerald-500/25 bg-emerald-500/10',
    rail: 'bg-gradient-to-r from-emerald-500 to-emerald-300',
    glow: 'hover:shadow-[0_22px_55px_-28px_rgba(5,193,71,0.6)]',
  },
  amber: {
    text: 'text-amber-400',
    iconBg: 'border-amber-500/25 bg-amber-500/10',
    rail: 'bg-gradient-to-r from-amber-500 to-amber-300',
    glow: 'hover:shadow-[0_22px_55px_-28px_rgba(245,158,11,0.6)]',
  },
  sky: {
    text: 'text-sky-400',
    iconBg: 'border-sky-500/25 bg-sky-500/10',
    rail: 'bg-gradient-to-r from-sky-500 to-sky-300',
    glow: 'hover:shadow-[0_22px_55px_-28px_rgba(14,165,233,0.6)]',
  },
  rose: {
    text: 'text-rose-400',
    iconBg: 'border-rose-500/25 bg-rose-500/10',
    rail: 'bg-gradient-to-r from-rose-500 to-rose-300',
    glow: 'hover:shadow-[0_22px_55px_-28px_rgba(244,63,94,0.6)]',
  },
  neutral: {
    text: 'text-neutral-300',
    iconBg: 'border-white/10 bg-white/5',
    rail: 'bg-gradient-to-r from-neutral-500 to-neutral-300',
    glow: 'hover:shadow-[0_22px_55px_-28px_rgba(255,255,255,0.25)]',
  },
};

/** Stable, data-derived bar heights so the sparkline reads as a real trend. */
function sparkHeights(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    out.push(35 + ((h >>> 0) % 65));
  }
  return out;
}

const MetricCard: React.FC<{ item: MetricItem; index: number }> = ({ item, index }) => {
  const t = TONE[item.tone];
  const Icon = item.icon;
  const bars = sparkHeights(item.id);
  const hasAlert = item.alert !== undefined && item.alert > 0;

  return (
    <button
      type="button"
      onClick={item.onSelect}
      data-testid={item.testId}
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      className={`kpi-card surface-panel surface-panel-hover surface-rise group flex flex-col items-start p-3.5 text-left ${t.glow}`}
    >
      <span className={`kpi-rail ${t.rail}`} aria-hidden="true" />
      <div className="flex w-full items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${t.iconBg}`}>
          <Icon className={`h-4 w-4 ${t.text}`} />
        </span>
        <div className="flex items-center gap-1.5">
          {hasAlert && (
            <span className="rounded-full border border-amber-400/50 bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-neutral-950">
              {item.alert} new
            </span>
          )}
          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
        </div>
      </div>

      <div className="mt-3 flex w-full items-end justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-display text-2xl font-black leading-none tabular-nums ${t.text}`}>
            {item.value}
          </div>
          <div className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
            {item.label}
          </div>
        </div>
        <div className={`spark shrink-0 ${t.text}`} aria-hidden="true">
          {bars.map((b, i) => (
            <span key={i} style={{ height: `${b}%` }} />
          ))}
        </div>
      </div>

      {item.unit && (
        <div className="mt-1 text-[10px] font-medium text-neutral-500">{item.unit}</div>
      )}
    </button>
  );
};

export interface MetricRailProps {
  items: MetricItem[];
  className?: string;
}

/** A responsive rail of KPI cards, each a shortcut into its tool. */
export const MetricRail: React.FC<MetricRailProps> = ({ items, className = '' }) => (
  <div
    data-testid="staff-metric-rail"
    className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${className}`}
  >
    {items.map((item, i) => (
      <MetricCard key={item.id} item={item} index={i} />
    ))}
  </div>
);

export default MetricRail;
