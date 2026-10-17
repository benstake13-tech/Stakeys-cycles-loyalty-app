import type { CSSProperties } from 'react';
import type { SeasonalThemeId } from '../utils/holidayCalendar';
import { ThemeArtwork } from './theme/ThemeArtwork';
import { worldFor } from './theme/worldCatalog';
import './theme/themeWorld.css';

/** The same locally bundled shop photograph on every surface, without a WebGL startup dependency. */
export const ThemeStage = ({ theme }: { theme: SeasonalThemeId }) => {
  const world = worldFor(theme);
  if (!world) return null;
  return <div className="theme-world theme-world-background" data-theme={theme} data-renderer="artwork" aria-hidden="true"
    style={{ '--world-accent': world.accent } as CSSProperties}>
    <ThemeArtwork world={world} />
  </div>;
};
