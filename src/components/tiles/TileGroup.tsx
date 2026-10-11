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
 * optional description, and a trailing action slot, wrapping a grid of tiles.
 */
export const TileGroup: React.FC<TileGroupProps> = ({
  label,
  children,
  action,
  description,
  icon: Icon,
  className = '',
}) => (
  <div className={`space-y-3.5 ${className}`}>
    <div className="flex flex-wrap items-center gap-2.5">
      {Icon && (
        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5">
          <Icon className="h-3.5 w-3.5 text-emerald-400" />
        </span>
      )}
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-300">
        {label}
      </span>
      <div className="hairline flex-1" />
      {action}
    </div>
    {description && (
      <p className="-mt-1 text-[11px] leading-relaxed text-neutral-500">{description}</p>
    )}
    {children}
  </div>
);

export default TileGroup;
