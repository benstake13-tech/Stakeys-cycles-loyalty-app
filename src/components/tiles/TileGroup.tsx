import React from 'react';

export interface TileGroupProps {
  /** Section heading (e.g. "Operations"). */
  label: string;
  children: React.ReactNode;
  /** Optional trailing content on the heading row (e.g. the notification bell). */
  action?: React.ReactNode;
  className?: string;
}

/** A labelled section with a heading + rule, wrapping a grid of tiles. */
export const TileGroup: React.FC<TileGroupProps> = ({ label, children, action, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
      <div className="h-px flex-1 bg-neutral-800/70" />
      {action}
    </div>
    {children}
  </div>
);

export default TileGroup;
