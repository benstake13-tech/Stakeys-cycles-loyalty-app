/**
 * Staff-facing helper for the OneSignal web-push pipeline.
 *
 * Backs the "Push Setup" modal in the Staff Station. Phone push has three moving
 * parts — device permission, the root-scope service worker, and the server-side
 * App API key used for background sends — and this module reports the state of
 * each so staff can see exactly what is left to finish. Functions that touch the
 * network or the browser take their dependencies as arguments so they stay easy
 * to test.
 */
import type { PushPermission } from './pushNotifications';
import { getStoredSupabaseAnonKey, getStoredSupabaseUrl } from '../supabase';

export interface PushRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
  /** Public OneSignal web config, used to detect an origin mismatch. */
  webConfig?: WebConfig | null;
}

/** The non-secret parts of the OneSignal app's web configuration. */
export interface WebConfig {
  chromeWebOrigin?: string | null;
  safariSiteOrigin?: string | null;
  siteOrigin?: string | null;
  restrictOrigin?: boolean;
}

export type OriginStatus = 'ok' | 'mismatch' | 'unknown';

export interface OriginCheck {
  status: OriginStatus;
  /** Human-readable explanation, ready to show staff. */
  detail: string;
  /** The origin OneSignal is configured for, when known. */
  configuredOrigin?: string;
}

/** Normalises an origin for comparison: lower-case, no trailing slash, default ports dropped. */
export function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin.includes('://') ? origin : `https://${origin}`);
    const port =
      url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))
        ? `:${url.port}`
        : '';
    return `${url.protocol}//${url.hostname.toLowerCase()}${port}`;
  } catch {
    return null;
  }
}

/**
 * Compares the origin the site is served from against the origin the OneSignal
 * app is locked to. With `restrict_origin` on, the SDK refuses to initialise on
 * any other origin, so this mismatch is the exact reason a device never
 * subscribes even though everything else looks configured.
 */
export function checkPushOrigin(siteOrigin: string, webConfig: WebConfig | null | undefined): OriginCheck {
  const site = normalizeOrigin(siteOrigin);
  const configured =
    normalizeOrigin(webConfig?.chromeWebOrigin) ||
    normalizeOrigin(webConfig?.siteOrigin) ||
    normalizeOrigin(webConfig?.safariSiteOrigin);

  if (!configured) {
    return { status: 'unknown', detail: 'OneSignal web origin could not be read (set the App API key to check).' };
  }
  if (!site) {
    return { status: 'unknown', detail: `Could not read this site's origin; OneSignal expects ${configured}.`, configuredOrigin: configured };
  }
  if (site === configured) {
    return { status: 'ok', detail: `OneSignal is configured for ${configured} — matches this site.`, configuredOrigin: configured };
  }
  // A mismatch only blocks init when OneSignal restricts the origin.
  if (webConfig?.restrictOrigin === false) {
    return {
      status: 'ok',
      detail: `OneSignal is set to ${configured} but origin restriction is off, so this site (${site}) still works.`,
      configuredOrigin: configured,
    };
  }
  return {
    status: 'mismatch',
    detail: `OneSignal is locked to ${configured} but this site is served from ${site}. The SDK will not start, so no device can subscribe.`,
    configuredOrigin: configured,
  };
}

/** True when a service worker is registered at the root scope ('/'), which is
 *  what lets OneSignal receive background pushes. */
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
 * Reads the push config. Production truth comes from the `onesignal-send` edge
 * function (the static host has no `/api`); falls back to the dev-only Express
 * route so `npm run dev` still works.
 */
export async function fetchPushConfig(fetcher: typeof fetch = fetch): Promise<PushRuntimeConfig> {
  const base = getStoredSupabaseUrl().replace(/\/+$/, '');
  const key = getStoredSupabaseAnonKey();
  if (base && key) {
    try {
      const res = await fetcher(`${base}/functions/v1/onesignal-send`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (res.ok && data && typeof data === 'object') {
        return { appId: data.appId ?? null, serverPush: Boolean(data.serverPush), webConfig: data.webConfig ?? null };
      }
    } catch {
      /* fall through to the dev route */
    }
  }
  try {
    const res = await fetcher('/api/onesignal/config');
    const data = await res.json();
    return { appId: data?.appId ?? null, serverPush: Boolean(data?.serverPush), webConfig: data?.webConfig ?? null };
  } catch {
    return { appId: null, serverPush: false, webConfig: null };
  }
}

export function permissionLabel(p: PushPermission): string {
  switch (p) {
    case 'granted':
      return 'Allowed on this device';
    case 'denied':
      return 'Blocked — re-allow notifications in your browser/phone settings';
    case 'not_configured':
      return 'No OneSignal app id configured';
    case 'unsupported':
      return 'This browser does not support notifications';
    default:
      return 'Not allowed yet';
  }
}

/**
 * Makes sure the OneSignal worker is registered at the root scope. The SDK
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
    await sw.register('/OneSignalSDKWorker.js', { scope: '/' });
    const after = await sw.getRegistrations().catch(() => []);
    return hasRootScopeServiceWorker(after as unknown as Array<{ scope?: string }>);
  } catch {
    return false;
  }
}
