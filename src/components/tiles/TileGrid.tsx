import React from 'react';

export interface TileGridProps {
  children: React.ReactNode;
  /** Tailwind grid-template classes. Defaults to a compact responsive grid. */
  cols?: string;
  className?: string;
}

/** A responsive grid of square tiles; staggers each tile's entrance animation. */
export const TileGrid: React.FC<TileGridProps> = ({
  children,
  cols = 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  className = '',
}) => (
  <div className={`grid gap-2 ${cols} ${className}`}>
    {React.Children.map(children, (child, i) =>
      React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ index?: number }>, { index: i }) : child
    )}
  </div>
);

export default TileGrid;
