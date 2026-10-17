import type { SeasonalThemeId } from '../utils/holidayCalendar';
import { ThemeWorld } from './theme/ThemeWorld';

/** One photo renderer for the website, staff app and customer app. */
export const ThemeStage = ({ theme }: { theme: SeasonalThemeId }) => <ThemeWorld theme={theme} />;
