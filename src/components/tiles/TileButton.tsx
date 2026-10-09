import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import type { TabTone } from '../SegmentedTabs';

export type TileTone = TabTone;

const TONE_ICON: Record<TileTone, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  neutral: 'text-neutral-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
};

const TONE_RING: Record<TileTone, string> = {
  emerald: 'hover:border-emerald-500/50',
  amber: 'hover:border-amber-500/50',
  neutral: 'hover:border-neutral-500/50',
  rose: 'hover:border-rose-500/50',
  sky: 'hover:border-sky-500/50',
};

const TONE_BADGE_DARK: Record<TileTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const TONE_BADGE_LIGHT: Record<TileTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  amber: 'bg-amber-100 text-amber-700 border-amber-300',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  rose: 'bg-rose-100 text-rose-700 border-rose-300',
  sky: 'bg-sky-100 text-sky-700 border-sky-300',
};

export interface TileButtonProps {
  icon?: LucideIcon;
  label: string;
  hint?: string;
  tone?: TileTone;
  /** Small numeric/text badge in the tile corner (e.g. a fresh-booking count). */
  badge?: number | string;
  /** A wider metric read-out rendered under the label. */
  metric?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  onSelect: () => void;
  className?: string;
  testId?: string;
}

/**
 * A single square launcher tile — icon + label (+ optional badge/metric).
 * Keyboard-focusable and tone-tinted; the building block of the tile-based
 * staff and customer navigation.
 */
export const TileButton: React.FC<TileButtonProps> = ({
  icon: Icon,
  label,
  hint,
  tone = 'emerald',
  badge,
  metric,
  disabled = false,
  active = false,
  onSelect,
  className = '',
  testId,
}) => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const showBadge = badge !== undefined && badge !== 0;

  return (
    <button
      type="button"
      title={hint}
      onClick={onSelect}
      disabled={disabled}
      data-testid={testId}
      aria-pressed={active}
      className={`pressable group relative flex aspect-square flex-col items-start justify-between overflow-hidden rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? isDark
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-emerald-500/60 bg-emerald-50'
          : isDark
          ? `border-neutral-800 bg-[#0b0e13] ${TONE_RING[tone]}`
          : `border-neutral-200 bg-white ${TONE_RING[tone]}`
      } ${className}`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
            isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-neutral-100 border-neutral-200'
          }`}
        >
          {Icon && <Icon className={`h-4 w-4 ${TONE_ICON[tone]}`} />}
        </span>
        {showBadge && (
          <span
            className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              isDark ? TONE_BADGE_DARK[tone] : TONE_BADGE_LIGHT[tone]
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="min-w-0 w-full">
        <div className={`truncate text-xs font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>{label}</div>
        {metric !== undefined ? (
          <div className={`mt-0.5 text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>{metric}</div>
        ) : (
          hint && (
            <div className={`mt-0.5 line-clamp-2 text-[10px] leading-snug ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
              {hint}
            </div>
          )
        )}
      </div>
    </button>
  );
};

export default TileButton;
