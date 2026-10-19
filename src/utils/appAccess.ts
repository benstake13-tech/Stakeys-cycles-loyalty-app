import type { AppSurface } from '../config/surface';

/**
 * Browser access is enabled for the staff and customer web portals.
 *
 * Authentication and authorization are still enforced by the existing
 * Supabase-backed login flow and role checks in the app/backend. This helper
 * remains in place for compatibility with existing callers, but no longer
 * blocks the browser behind the "install the app" landing screen.
 *
 * Password recovery continues to work through /reset-password as before.
 */
export function requiresInstalledApp(_surface: AppSurface, _native: boolean, _pathname: string): boolean {
  return false;
}
