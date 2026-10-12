import React from 'react';

export interface TileGridProps {
  children: React.ReactNode;
  /** Tailwind grid-template classes. Defaults to a premium responsive grid. */
  cols?: string;
  className?: string;
}

/** A responsive grid of launcher cards; staggers each card's entrance. */
export const TileGrid: React.FC<TileGridProps> = ({
  children,
  cols = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  className = '',
}) => (
  <div className={`grid gap-3 ${cols} ${className}`}>
    {React.Children.map(children, (child, i) =>
      React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ index?: number }>, { index: i }) : child
    )}
  </div>
);

export default TileGrid;
