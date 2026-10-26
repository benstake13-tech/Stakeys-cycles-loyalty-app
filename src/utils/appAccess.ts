import type { AppSurface } from '../config/surface';

export function requiresInstalledApp(surface: AppSurface, native: boolean, pathname: string): boolean {
  // Recovery emails must remain usable; the recovery session authorises the reset.
  const recovery = /^\/reset-password\/?$/.test(pathname);
  // Staff can use the authenticated workshop website as well as its APK.
  return !native && surface === 'customer' && !recovery;
}
