import React from 'react';

export interface TileGroupProps {
  /** Section heading (e.g. "Operations"). */
  label: string;
  children: React.ReactNode;
  /** Optional trailing content on the heading row (e.g. the notification bell). */
  action?: React.ReactNode;
  /** Optional one-line description shown under the heading. */
  description?: string;
  /** Optional leading icon for the section heading. */
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * A labelled section: an icon-led heading with a fading hairline rule, an
 * optional description, and a trailing action slot, wrapping a grid of cards.
 */
export const TileGroup: React.FC<TileGroupProps> = ({
  label,
  children,
  action,
  description,
  icon: Icon,
  className = '',
}) => (
  <div className={`space-y-4 ${className}`}>
    <div className="flex flex-wrap items-center gap-2.5">
      {Icon && (
        <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02]">
          <Icon className="h-3.5 w-3.5 text-emerald-400" />
        </span>
      )}
      <span className="font-display text-[12px] font-bold uppercase tracking-[0.22em] text-neutral-200">
        {label}
      </span>
      <div className="hairline flex-1" />
      {action}
    </div>
    {description && (
      <p className="-mt-1.5 text-[11px] leading-relaxed text-neutral-500">{description}</p>
    )}
    {children}
  </div>
);

export default TileGroup;
