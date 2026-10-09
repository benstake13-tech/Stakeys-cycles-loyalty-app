import React from 'react';

export interface TileGridProps {
  children: React.ReactNode;
  /** Tailwind grid-template classes. Defaults to a responsive 2/3/4 column grid. */
  cols?: string;
  className?: string;
}

/** A responsive grid of square tiles. */
export const TileGrid: React.FC<TileGridProps> = ({
  children,
  cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  className = '',
}) => <div className={`grid gap-2.5 ${cols} ${className}`}>{children}</div>;

export default TileGrid;
