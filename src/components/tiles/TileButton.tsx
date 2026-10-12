import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import type { TabTone } from '../SegmentedTabs';

export type TileTone = TabTone;

/** Tone-tinted glyph colour on the icon medallion. */
const TONE_ICON: Record<TileTone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  neutral: 'text-neutral-300',
  rose: 'text-rose-300',
  sky: 'text-sky-300',
};

/** RGB used for the medallion halo + rotating sheen (CSS `--tile-glow`). */
const TONE_RGB: Record<TileTone, string> = {
  emerald: '16,185,129',
  amber: '245,158,11',
  neutral: '163,163,163',
  rose: '244,63,94',
  sky: '14,165,233',
};

/** The medallion: a jewellery-like ring with a soft internal gradient. */
const TONE_MEDALLION: Record<TileTone, string> = {
  emerald: 'border-emerald-400/30 bg-gradient-to-br from-emerald-400/25 to-emerald-500/[0.05]',
  amber: 'border-amber-400/30 bg-gradient-to-br from-amber-400/25 to-amber-500/[0.05]',
  neutral: 'border-white/15 bg-gradient-to-br from-white/15 to-white/[0.03]',
  rose: 'border-rose-400/30 bg-gradient-to-br from-rose-400/25 to-rose-500/[0.05]',
  sky: 'border-sky-400/30 bg-gradient-to-br from-sky-400/25 to-sky-500/[0.05]',
};
const TONE_MEDALLION_LIGHT: Record<TileTone, string> = {
  emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
  amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
  neutral: 'border-neutral-200 bg-gradient-to-br from-neutral-100 to-white',
  rose: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white',
  sky: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white',
};

/** A faint brand wash that gives each card its own tone, top-lit. */
const TONE_PANEL_DARK: Record<TileTone, string> = {
  emerald: 'from-emerald-500/[0.14] via-emerald-500/[0.03] to-transparent',
  amber: 'from-amber-500/[0.14] via-amber-500/[0.03] to-transparent',
  neutral: 'from-white/[0.08] via-white/[0.02] to-transparent',
  rose: 'from-rose-500/[0.14] via-rose-500/[0.03] to-transparent',
  sky: 'from-sky-500/[0.14] via-sky-500/[0.03] to-transparent',
};
const TONE_PANEL_LIGHT: Record<TileTone, string> = {
  emerald: 'from-emerald-100 via-emerald-50/30 to-white',
  amber: 'from-amber-100 via-amber-50/30 to-white',
  neutral: 'from-neutral-100 via-neutral-50/30 to-white',
  rose: 'from-rose-100 via-rose-50/30 to-white',
  sky: 'from-sky-100 via-sky-50/30 to-white',
};

/** Hover/active accents. */
const TONE_RING: Record<TileTone, string> = {
  emerald: 'hover:border-emerald-400/45',
  amber: 'hover:border-amber-400/45',
  neutral: 'hover:border-white/25',
  rose: 'hover:border-rose-400/45',
  sky: 'hover:border-sky-400/45',
};
const TONE_ACCENT: Record<TileTone, string> = {
  emerald: 'bg-gradient-to-r from-transparent via-emerald-400 to-transparent',
  amber: 'bg-gradient-to-r from-transparent via-amber-400 to-transparent',
  neutral: 'bg-gradient-to-r from-transparent via-white/50 to-transparent',
  rose: 'bg-gradient-to-r from-transparent via-rose-400 to-transparent',
  sky: 'bg-gradient-to-r from-transparent via-sky-400 to-transparent',
};
const TONE_ARROW: Record<TileTone, string> = {
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  neutral: 'text-neutral-300',
  rose: 'text-rose-300',
  sky: 'text-sky-300',
};

const TONE_BADGE_DARK: Record<TileTone, string> = {
  emerald: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30',
  amber: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
  neutral: 'bg-white/10 text-neutral-200 border-white/20',
  rose: 'bg-rose-400/15 text-rose-200 border-rose-300/30',
  sky: 'bg-sky-400/15 text-sky-200 border-sky-300/30',
};
const TONE_BADGE_LIGHT: Record<TileTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
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
 * A premium launcher card — a tone-lit icon medallion, display-type label and
 * an explicit call-to-action, framed in layered glass rather than a flat
 * button. Rises in with a stagger, lifts on hover, sweeps a sheen across the
 * surface and springs its medallion. The building block of the staff and
 * customer navigation.
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
      style={
        {
          animationDelay: `${Math.min(index, 20) * 35}ms`,
          '--tile-glow': TONE_RGB[tone],
        } as React.CSSProperties
      }
      className={`tile group relative flex min-h-[136px] flex-col overflow-hidden rounded-[1.25rem] border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? isDark
            ? 'border-emerald-400/50 bg-emerald-500/[0.08]'
            : 'border-emerald-500/60 bg-emerald-50'
          : isDark
          ? `border-white/[0.08] bg-white/[0.02] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_44px_-30px_rgba(0,0,0,0.9)] ${TONE_RING[tone]}`
          : `border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-30px_rgba(15,23,42,0.3)] ${TONE_RING[tone]}`
      } ${className}`}
    >
      {/* Brand wash — the card's own tone, top-lit. */}
      <span
        aria-hidden="true"
        className={`tile-panel absolute inset-0 bg-gradient-to-br ${
          isDark ? TONE_PANEL_DARK[tone] : TONE_PANEL_LIGHT[tone]
        }`}
      />
      {/* Soft radial bloom behind the medallion. */}
      <span aria-hidden="true" className="tile-bloom absolute -left-10 -top-12 h-28 w-28 rounded-full" />
      {/* Slow rotating colour sweep — a permanently "live" brand cue. */}
      <span className="tile-spin" aria-hidden="true" />
      {/* Light sheen that sweeps across on hover. */}
      <span className="tile-sheen" aria-hidden="true" />
      {/* Specular top edge + tone accent rail, revealed on hover. */}
      <span aria-hidden="true" className="tile-edge absolute inset-x-0 top-0 h-px" />
      <span
        aria-hidden="true"
        className={`tile-accent absolute inset-x-6 bottom-0 h-px ${TONE_ACCENT[tone]} ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity duration-300`}
      />

      {/* Header — the medallion + an optional corner badge. */}
      <div className="relative z-10 flex w-full items-start justify-between gap-3">
        <span
          className={`tile-icon relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-inner ${
            isDark ? TONE_MEDALLION[tone] : TONE_MEDALLION_LIGHT[tone]
          }`}
        >
          <span aria-hidden="true" className="tile-halo absolute inset-0 rounded-2xl" />
          {Icon && <Icon className={`tile-glyph relative z-10 h-[22px] w-[22px] ${TONE_ICON[tone]}`} />}
        </span>
        {showBadge && (
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
              isDark ? TONE_BADGE_DARK[tone] : TONE_BADGE_LIGHT[tone]
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Body — label, supporting line and the call-to-action footer. */}
      <div className="relative z-10 mt-auto w-full min-w-0 pt-3">
        <div
          className={`font-display truncate text-[13.5px] font-bold leading-tight tracking-tight ${
            isDark ? 'text-white' : 'text-neutral-900'
          }`}
        >
          {label}
        </div>
        {metric !== undefined ? (
          <div className={`mt-1 text-[10px] font-semibold ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            {metric}
          </div>
        ) : (
          hint && (
            <div
              className={`mt-1 line-clamp-2 text-[10.5px] leading-snug ${
                isDark ? 'text-neutral-500' : 'text-neutral-500'
              }`}
            >
              {hint}
            </div>
          )
        )}
        {!disabled && (
          <div
            className={`mt-2.5 flex items-center gap-1 border-t pt-2 text-[9px] font-bold uppercase tracking-[0.16em] ${
              isDark ? 'border-white/[0.06] text-neutral-500' : 'border-neutral-100 text-neutral-400'
            }`}
          >
            <span className="transition-colors group-hover:text-emerald-400">{actionLabel}</span>
            <ArrowUpRight className={`tile-arrow h-3 w-3 ${TONE_ARROW[tone]}`} />
          </div>
        )}
      </div>
    </button>
  );
};

export default TileButton;
