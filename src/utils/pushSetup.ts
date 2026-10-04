/**
 * Staff-facing helper for the PushEngage web-push pipeline.
 *
 * Backs the "Push Setup" modal in the Staff Station. Phone push has three moving
 * parts — device permission, the root-scope service worker, and the server-side
 * REST key used for background sends — and this module reports the state of each
 * so staff can see exactly what is left to finish. Functions that touch the
 * network or the browser take their dependencies as arguments so they stay easy
 * to test.
 */
import type { PushPermission } from './pushNotifications';
import { getStoredSupabaseAnonKey, getStoredSupabaseUrl } from '../supabase';

export interface PushRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
}

/** True when a service worker is registered at the root scope ('/'), which is
 *  what lets PushEngage receive background pushes. */
export function hasRootScopeServiceWorker(
  regs: ReadonlyArray<{ scope?: string }> | null | undefined
): boolean {
  if (!regs || regs.length === 0) return false;
  return regs.some((r) => {
    if (!r?.scope) return false;
    try {
      return new URL(r.scope).pathname === '/';
    } catch {
      return r.scope === '/';
    }
  });
}

/**
 * Reads the push config. Production truth comes from the `pushengage-send` edge
 * function (the static host has no `/api`); falls back to the dev-only Express
 * route so `npm run dev` still works.
 */
export async function fetchPushConfig(fetcher: typeof fetch = fetch): Promise<PushRuntimeConfig> {
  const base = getStoredSupabaseUrl().replace(/\/+$/, '');
  const key = getStoredSupabaseAnonKey();
  if (base && key) {
    try {
      const res = await fetcher(`${base}/functions/v1/pushengage-send`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (res.ok && data && typeof data === 'object') {
        return { appId: data.appId ?? null, serverPush: Boolean(data.serverPush) };
      }
    } catch {
      /* fall through to the dev route */
    }
  }
  try {
    const res = await fetcher('/api/pushengage/config');
    const data = await res.json();
    return { appId: data?.appId ?? null, serverPush: Boolean(data?.serverPush) };
  } catch {
    return { appId: null, serverPush: false };
  }
}

export function permissionLabel(p: PushPermission): string {
  switch (p) {
    case 'granted':
      return 'Allowed on this device';
    case 'denied':
      return 'Blocked — re-allow notifications in your browser/phone settings';
    case 'not_configured':
      return 'No PushEngage app id configured';
    case 'unsupported':
      return 'This browser does not support notifications';
    default:
      return 'Not allowed yet';
  }
}

/**
 * Makes sure the PushEngage shim worker is registered at the root scope. The SDK
 * normally does this once permission is granted, but staff can trigger it
 * explicitly here so step 2 can be fixed on its own. Returns whether a root-scope
 * worker exists afterwards.
 */
export async function ensureRootServiceWorker(
  sw: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
): Promise<boolean> {
  if (!sw) return false;
  const existing = await sw.getRegistrations().catch(() => []);
  if (hasRootScopeServiceWorker(existing as unknown as Array<{ scope?: string }>)) return true;
  try {
    await sw.register('/service-worker.js', { scope: '/' });
    const after = await sw.getRegistrations().catch(() => []);
    return hasRootScopeServiceWorker(after as unknown as Array<{ scope?: string }>);
  } catch {
    return false;
  }
}
