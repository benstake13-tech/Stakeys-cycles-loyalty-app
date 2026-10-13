import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';

/** Tone is retained for callers, but the Staff Terminal deliberately uses one accent. */
export type MetricTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'neutral';

export interface MetricItem {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  icon: LucideIcon;
  tone: MetricTone;
  /** Real, unreviewed booking count; not a fabricated trend or status. */
  alert?: number;
  onSelect: () => void;
  testId?: string;
}

/**
 * Compact charcoal-glass KPI cards. Values stay high contrast; neon is reserved
 * for icon interaction and genuine alert/status pills.
 */
const MetricCard: React.FC<{ item: MetricItem }> = ({ item }) => {
  const Icon = item.icon;
  const hasAlert = typeof item.alert === 'number' && item.alert > 0;
  return (
    <button
      type="button"
      onClick={item.onSelect}
      data-testid={item.testId}
      aria-label={`${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ''}${hasAlert ? `, ${item.alert} new alert${item.alert === 1 ? '' : 's'}` : ''}`}
      className="staff-kpi-card group"
    >
      <span className="staff-kpi-top">
        <Icon className="staff-kpi-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
        {hasAlert && <span className="staff-kpi-pill">{item.alert} Alert{item.alert === 1 ? '' : 's'}</span>}
      </span>
      <span className="staff-kpi-value">{item.value}</span>
      <span className="staff-kpi-label">{item.label}</span>
      {item.unit && <span className="staff-kpi-unit">{item.unit}</span>}
      <ArrowUpRight size={14} strokeWidth={1.75} className="staff-kpi-arrow" aria-hidden="true" />
    </button>
  );
};

export interface MetricRailProps {
  items: MetricItem[];
  className?: string;
}

/** Consistent two-column rail on Android, tablet and desktop. */
export const MetricRail: React.FC<MetricRailProps> = ({ items, className = '' }) => (
  <div data-testid="staff-metric-rail" className={`grid grid-cols-2 gap-3 ${className}`}>
    {items.map(item => <MetricCard key={item.id} item={item} />)}
  </div>
);

export default MetricRail;
