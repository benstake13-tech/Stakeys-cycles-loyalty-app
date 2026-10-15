import { Suspense, lazy } from 'react';
import type { SeasonalThemeId } from '../utils/holidayCalendar';
import { useShop } from '../context/ShopContext';
import { isCustomerSurface } from '../config/surface';
const ThemeWorld = lazy(() => import('./theme/ThemeWorld').then(m => ({default:m.ThemeWorld})));
/** One shared visual renderer for staff, customer and website surfaces. */
export const ThemeStage = ({theme}:{theme:SeasonalThemeId}) => {
 const { currentUser } = useShop();
 const huntUserId = isCustomerSurface && currentUser?.role === 'customer' ? currentUser.uid : undefined;
 return theme && theme !== 'none'
  ? <Suspense fallback={null}><ThemeWorld theme={theme} huntEnabled={isCustomerSurface} huntUserId={huntUserId}/></Suspense> : null;
};
