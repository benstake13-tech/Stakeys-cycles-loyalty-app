/**
 * Which public surface this build targets. Each production domain ships its
 * own bundle so a visitor to the marketing site never receives the staff or
 * customer code paths (and vice versa).
 *
 * Set at build time with VITE_SURFACE=website|staff|customer. Unset = 'full',
 * the combined app used for local development.
 */
export type AppSurface = 'website' | 'staff' | 'customer' | 'full';

/**
 * Default surface for this build when VITE_SURFACE is unset. Each branch sets
 * its own value here so `npm run build` on that branch produces its domain's
 * bundle without extra flags. 'full' (all surfaces, local dev) is the default.
 */
const DEFAULT_SURFACE: AppSurface = 'customer';

const raw = String(import.meta.env.VITE_SURFACE ?? DEFAULT_SURFACE).toLowerCase();

export const APP_SURFACE: AppSurface =
  raw === 'website' || raw === 'staff' || raw === 'customer' ? raw : 'full';

export const isWebsiteSurface = APP_SURFACE === 'website';
export const isStaffSurface = APP_SURFACE === 'staff';
export const isCustomerSurface = APP_SURFACE === 'customer';
export const isFullSurface = APP_SURFACE === 'full';

/**
 * The origin of the staff app. Staff push notifications must open here — never
 * the surface that created the booking — so a booking made on the website or in
 * the customer app still deep-links to the workshop terminal. Overridable with
 * `VITE_STAFF_APP_ORIGIN` if the staff domain ever changes.
 */
export const STAFF_APP_ORIGIN = String(
  import.meta.env.VITE_STAFF_APP_ORIGIN || 'https://www.stakeys-cycles.co.uk'
).replace(/\/+$/, '');
