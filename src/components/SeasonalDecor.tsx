import React from 'react';
import { useShop } from '../context/ShopContext';
import { themeDecorFor } from '../utils/themeDecor';
import { SeasonalHeroBanner } from './SeasonalHeroBanner';
import { SeasonalFooterDecor } from './SeasonalFooterDecor';

/**
 * Root wrapper for every seasonal decor asset on the dashboard. Tagging it with
 * `.seasonal-decor` + the active theme class (`.theme-halloween`, `.theme-christmas`,
 * …) exposes that theme's `--theme-*` custom properties to both the swinging hero
 * and the footer border, so future themes need only a palette block + a registry
 * entry — no component changes.
 *
 * Renders nothing when the active theme has no decor (the default 'none' case).
 */
export const SeasonalDecor: React.FC = () => {
  const { seasonalTheme } = useShop();
  if (!themeDecorFor(seasonalTheme)) return null;

  return (
    <div className={`seasonal-decor theme-${seasonalTheme}`} data-theme={seasonalTheme}>
      <SeasonalHeroBanner theme={seasonalTheme} />
      <SeasonalFooterDecor theme={seasonalTheme} />
    </div>
  );
};
