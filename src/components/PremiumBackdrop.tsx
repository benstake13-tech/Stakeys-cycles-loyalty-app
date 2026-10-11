import React from 'react';
import { useShop } from '../context/ShopContext';

/**
 * Ambient backdrop for every surface (website, customer, staff). A fine
 * engineering grid, three slow colour blooms and a soft vignette, tuned for
 * the active theme. Purely decorative: `pointer-events: none` and only
 * transform/opacity animate, so it stays on the compositor and never repaints
 * the panels above it.
 */
export const PremiumBackdrop: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme !== 'light';

  return (
    <div className={isDark ? 'os-backdrop' : 'os-backdrop light'} aria-hidden="true">
      <span className="os-bloom emerald" />
      <span className="os-bloom sky" />
      <span className="os-bloom amber" />
    </div>
  );
};

export default PremiumBackdrop;
