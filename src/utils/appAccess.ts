import type { AppSurface } from '../config/surface';

export function requiresInstalledApp(surface: AppSurface, native: boolean, pathname: string): boolean {
  // Recovery emails must remain usable; the recovery session authorises the reset.
  const recovery = /^\/reset-password\/?$/.test(pathname);
  return !native && (surface === 'staff' || surface === 'customer') && !recovery;
}
