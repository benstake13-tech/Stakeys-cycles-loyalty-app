import type { AppSurface } from './surface';

/** A stale hosted surface setting must never put an app-login gate on the public shop domain. */
export function isPublicWebsiteHost(hostname: string): boolean {
  return ['stakeyswheels.co.uk', 'www.stakeyswheels.co.uk'].includes(hostname.toLowerCase().replace(/\.$/, ''));
}

/** Production source branches take precedence over stale per-project VITE_SURFACE values. */
export function hostedSurfaceForBranch(branch?: string): AppSurface | undefined {
  return ({ 'staff-terminal': 'staff', 'customer-app': 'customer', 'main-website': 'website' } as const)[branch as 'staff-terminal' | 'customer-app' | 'main-website'];
}
