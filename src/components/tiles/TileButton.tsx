import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
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

const TONE_ICON_BG: Record<TileTone, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/25',
  amber: 'bg-amber-500/10 border-amber-500/25',
  neutral: 'bg-neutral-800/60 border-neutral-700',
  rose: 'bg-rose-500/10 border-rose-500/25',
  sky: 'bg-sky-500/10 border-sky-500/25',
};

const TONE_ICON_BG_LIGHT: Record<TileTone, string> = {
  emerald: 'bg-emerald-50 border-emerald-200',
  amber: 'bg-amber-50 border-amber-200',
  neutral: 'bg-neutral-100 border-neutral-200',
  rose: 'bg-rose-50 border-rose-200',
  sky: 'bg-sky-50 border-sky-200',
};

const TONE_RING: Record<TileTone, string> = {
  emerald: 'hover:border-emerald-500/60',
  amber: 'hover:border-amber-500/60',
  neutral: 'hover:border-neutral-500/60',
  rose: 'hover:border-rose-500/60',
  sky: 'hover:border-sky-500/60',
};

const TONE_GLOW: Record<TileTone, string> = {
  emerald: 'hover:shadow-emerald-500/20',
  amber: 'hover:shadow-amber-500/20',
  neutral: 'hover:shadow-neutral-900/40',
  rose: 'hover:shadow-rose-500/20',
  sky: 'hover:shadow-sky-500/20',
};

const TONE_ACCENT: Record<TileTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  neutral: 'bg-neutral-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
};

const TONE_BADGE_DARK: Record<TileTone, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  rose: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  sky: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
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
  /** Optional short call-to-action label (defaults to "Open"). */
  actionLabel?: string;
  disabled?: boolean;
  active?: boolean;
  /** 0-based position, used to stagger the entrance animation. */
  index?: number;
  onSelect: () => void;
  className?: string;
  testId?: string;
}

/**
 * A compact launcher tile — icon + label + an explicit "Open" affordance.
 * Keyboard-focusable and tone-tinted; rises in with a stagger, lifts and slides
 * a sheen on hover, and springs its icon. The building block of the tile-based
 * staff and customer navigation.
 */
export const TileButton: React.FC<TileButtonProps> = ({
  icon: Icon,
  label,
  hint,
  tone = 'emerald',
  badge,
  metric,
  actionLabel = 'Open',
  disabled = false,
  active = false,
  index = 0,
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
      aria-label={hint ? `${label} — ${hint}` : label}
      style={{ animationDelay: `${Math.min(index, 20) * 35}ms` }}
      className={`tile group relative flex aspect-square flex-col items-start justify-between overflow-hidden rounded-xl border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? isDark
            ? 'border-emerald-500/60 bg-emerald-500/10'
            : 'border-emerald-500/60 bg-emerald-50'
          : isDark
          ? `border-neutral-800 bg-[#0b0e13] ${TONE_RING[tone]} ${TONE_GLOW[tone]} hover:shadow-lg`
          : `border-neutral-200 bg-white ${TONE_RING[tone]} ${TONE_GLOW[tone]} hover:shadow-lg`
      } ${className}`}
    >
      {/* Light sheen that sweeps across on hover. */}
      <span className="tile-sheen" aria-hidden="true" />
      {/* Tone accent rail down the leading edge. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${TONE_ACCENT[tone]} ${
          active ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'
        } transition-opacity`}
      />

      <div className="flex w-full items-start justify-between gap-2 pl-1">
        <span
          className={`tile-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            isDark ? TONE_ICON_BG[tone] : TONE_ICON_BG_LIGHT[tone]
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

      <div className="w-full min-w-0 pl-1">
        <div
          className={`truncate text-[11px] font-bold leading-tight ${
            isDark ? 'text-white' : 'text-neutral-900'
          }`}
        >
          {label}
        </div>
        {metric !== undefined ? (
          <div className={`mt-0.5 text-[10px] font-semibold ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {metric}
          </div>
        ) : (
          hint && (
            <div
              className={`mt-0.5 line-clamp-2 text-[9.5px] leading-snug ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              {hint}
            </div>
          )
        )}
        {!disabled && (
          <div
            className={`mt-1 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider ${
              isDark ? 'text-neutral-500' : 'text-neutral-400'
            }`}
          >
            <span className="transition-colors group-hover:text-emerald-400">{actionLabel}</span>
            <ChevronRight className={`tile-arrow h-3 w-3 ${TONE_ICON[tone]}`} />
          </div>
        )}
      </div>
    </button>
  );
};

export default TileButton;
