import { Suspense, lazy } from 'react';
import type { SeasonalThemeId } from '../utils/holidayCalendar';
const ThemeWorld = lazy(() => import('./theme/ThemeWorld').then(m => ({default:m.ThemeWorld})));
/** One shared visual renderer for staff, customer and website surfaces. */
export const ThemeStage = ({theme}:{theme:SeasonalThemeId}) => theme && theme !== 'none'
 ? <Suspense fallback={null}><ThemeWorld theme={theme}/></Suspense> : null;
