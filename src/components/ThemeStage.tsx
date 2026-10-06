import { Suspense, lazy } from 'react';
import type { SeasonalThemeId } from '../utils/holidayCalendar';

// The whole theme engine (software renderer + every scene/particle builder) is
// split into its own chunk and only fetched once a seasonal theme is active, so
// it never weighs down the initial bundle for the common "none" case.
const SeasonalThemeCanvas = lazy(() =>
  import('./SeasonalThemeCanvas').then((m) => ({ default: m.SeasonalThemeCanvas }))
);
const ChristmasTreeOverlay = lazy(() =>
  import('./ChristmasTreeOverlay').then((m) => ({ default: m.ChristmasTreeOverlay }))
);

/**
 * Mounts the active theme's background world plus any interactive foreground
 * prop (currently the wind-dodging Christmas tree). Renders nothing when no
 * theme is selected, and mounts/unmounts cleanly on theme changes.
 */
export const ThemeStage = ({ theme }: { theme: SeasonalThemeId }) => {
  if (!theme || theme === 'none') return null;
  return (
    <Suspense fallback={null}>
      <SeasonalThemeCanvas theme={theme} />
      {theme === 'christmas' && <ChristmasTreeOverlay />}
    </Suspense>
  );
};
