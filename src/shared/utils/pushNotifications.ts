/**
 * OneSignal Web Push integration (v16).
 *
 * The snippet in index.html loads the SDK and queues `init`, so this module
 * waits on `window.OneSignalDeferred` instead of initialising a second time. It
 * identifies each signed-in user via `OneSignal.login(profileId)` so pushes can
 * be targeted at that external id, and exposes the helpers the booking flow
 * uses. Real delivery to a phone requires a configured app id and, for
 * background/server sends, the App API key on the backend.
 */

import { getStoredSupabaseAnonKey, getStoredSupabaseUrl } from '../supabase';
import { unregisterLegacyPushWorkers } from './pushSetup';

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured';

declare global {
  interface Window {
    OneSignal?: any;
    /** V16 command queue; the SDK drains it once it initialises. */
    OneSignalDeferred?: any[];
  }
}

interface PushRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
}

const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID as string | undefined;

let runtimeConfig: PushRuntimeConfig | null = null;
let readyPromise: Promise<any | null> | null = null;

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getRuntimeConfig(): Promise<PushRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  const resolved: PushRuntimeConfig = { appId: envAppId || null, serverPush: false };

  // Production: the onesignal-send edge function knows whether the App API key
  // is set. The static host has no /api, so this is the only config source there.
  try {
    const base = getStoredSupabaseUrl().replace(/\/+$/, '');
    const key = getStoredSupabaseAnonKey();
    if (base && key) {
      const res = await fetch(`${base}/functions/v1/onesignal-send`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.appId) resolved.appId = data.appId;
        resolved.serverPush = Boolean(data?.serverPush);
      }
    }
  } catch {
    /* fall through to the dev route */
  }

  // Dev: the Express config route (only exists under `npm run dev`).
  if (!resolved.serverPush) {
    try {
      const res = await fetch('/api/onesignal/config');
      const data = await res.json();
      if (data?.appId) resolved.appId = data.appId;
      if (data?.serverPush) resolved.serverPush = true;
    } catch {
      /* ignore */
    }
  }

  runtimeConfig = resolved;
  return resolved;
}

/**
 * Resolves with the live OneSignal API once the SDK has initialised, or null
 * when it never loads (unsupported browser, blocked script, tests).
 */
export async function initOneSignal(): Promise<any | null> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!browserReady()) return null;
    const cfg = await getRuntimeConfig();
    if (!cfg.appId) return null;
    if (window.OneSignal?.User) return window.OneSignal;

    // A PushEngage worker from before the OneSignal migration can still hold the
    // root scope and block the SDK's worker, silently killing all pushes. Clear
    // it before the SDK initialises so its own worker can register.
    await unregisterLegacyPushWorkers().catch(() => {});

    // The head snippet drives init; the SDK drains OneSignalDeferred in order,
    // so a callback queued here runs only after the SDK is ready.
    return await new Promise<any | null>((resolve) => {
      const timer = window.setTimeout(
        () => resolve(window.OneSignal?.User ? window.OneSignal : null),
        8000
      );
      try {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push((OneSignal: any) => {
          window.clearTimeout(timer);
          resolve(OneSignal ?? null);
        });
      } catch {
        window.clearTimeout(timer);
        resolve(window.OneSignal?.User ? window.OneSignal : null);
      }
    });
  })();
  return readyPromise;
}

export async function getPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';

  const api = await initOneSignal();
  try {
    const native = api?.Notifications?.permissionNative;
    if (native === 'granted' || native === 'denied' || native === 'default') return native;
    const granted = api?.Notifications?.permission;
    if (typeof granted === 'boolean') return granted ? 'granted' : 'default';
  } catch {
    /* fall back to the raw browser permission */
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return 'default';
}

/**
 * Requests permission through the native prompt and subscribes the device.
 * Returns the effective permission state; 'granted' means the device is
 * registered for push.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';

  const api = await initOneSignal();
  if (!api) return 'unsupported';

  try {
    const granted = await api.Notifications?.requestPermission?.();
    // A brand-new device subscription only exists after opt-in, so re-apply the
    // external id now that it can be attached.
    if (granted) await relinkUser();
  } catch (err) {
    console.warn('[OneSignal] permission request failed:', err);
  }

  const perm = await getPushPermission();
  if (perm === 'granted') await relinkUser();
  return perm;
}

/**
 * Returns the error `OneSignal.init()` threw, if any. The most common cause is
 * an origin mismatch: the OneSignal app is configured for one host but the app
 * is served from another (e.g. app set to the apex, site served from `www`).
 * In that case the SDK refuses to initialise and no device ever subscribes.
 */
export function getOneSignalInitError(): string | null {
  if (!browserReady()) return null;
  const msg = (window as any).__onesignalInitError;
  return typeof msg === 'string' ? msg : null;
}

/** Identifies the signed-in user so targeted pushes (external_id) reach them. */
let lastLinkedUserId: string | null = null;
let lastLinkedTags: Record<string, string | number> | undefined;

export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  lastLinkedUserId = userId;
  lastLinkedTags = tags;
  const api = await initOneSignal();
  if (!api) return;
  try {
    // `login` sets the external_id alias on this device's subscription, so a
    // server-side `include_aliases.external_id` push reaches it.
    if (typeof api.login === 'function') await api.login(userId);
    if (tags && typeof api.User?.addTags === 'function') {
      const attributes: Record<string, string> = {};
      for (const [k, v] of Object.entries(tags)) attributes[k] = String(v);
      await api.User.addTags(attributes);
    }
  } catch (err) {
    console.warn('[OneSignal] linkUser failed:', err);
  }
}

/** Re-applies the last external id — call after a device subscribes. */
export async function relinkUser(): Promise<void> {
  if (lastLinkedUserId) await linkUser(lastLinkedUserId, lastLinkedTags);
}

/** Clears the personal identifiers added by linkUser. */
export async function unlinkUser() {
  try {
    const api = await initOneSignal();
    if (api && typeof api.logout === 'function') await api.logout();
  } catch {
    /* ignore */
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    const api = await initOneSignal();
    return api?.User?.PushSubscription?.id || null;
  } catch {
    return null;
  }
}

/**
 * POSTs a push through the Supabase `onesignal-send` edge function, which holds
 * the App API key server-side. This is the production path: unlike the Express
 * `/api/onesignal/notify` route (dev-only, never runs on the static host), the
 * edge function is always reachable, so a booking alert lands on the phone even
 * with the app closed.
 */
async function sendViaEdgeFunction(
  body: Record<string, unknown>
): Promise<{ ok: boolean; detail?: string }> {
  const base = getStoredSupabaseUrl().replace(/\/+$/, '');
  const key = getStoredSupabaseAnonKey();
  if (!base || !key) return { ok: false };
  try {
    const res = await fetch(`${base}/functions/v1/onesignal-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => '');
    return { ok: false, detail: `HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}` };
  } catch {
    return { ok: false };
  }
}

/**
 * Sends a push so it lands even when the tab is closed. Tries the Supabase
 * `onesignal-send` edge function first (production), then the dev-only Express
 * route, and finally a foreground local notification while the page is open.
 *
 * When `userId` is omitted the edge function targets the workshop admins/staff
 * (audience 'admin') resolved server-side.
 */
export async function sendPushToUser(
  userId: string | undefined,
  title: string,
  body: string,
  url?: string,
  audience: 'admin' | 'all' = 'admin'
): Promise<{ ok: boolean; via: 'server' | 'local' | 'none'; detail?: string }> {
  const cfg = await getRuntimeConfig();

  let serverDetail: string | undefined;
  if (cfg.serverPush) {
    const target = userId ? { externalId: userId } : { audience };
    const edge = await sendViaEdgeFunction({ title, body, url, ...target });
    if (edge.ok) return { ok: true, via: 'server' };
    serverDetail = edge.detail;

    // Dev fallback: the Express route only exists under `npm run dev`.
    try {
      const res = await fetch('/api/onesignal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, url, ...target }),
      });
      if (res.ok) return { ok: true, via: 'server' };
    } catch {
      /* fall through to local */
    }
  }

  // Local fallback (works while the page is open and permission is granted).
  try {
    if (browserReady() && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.svg', badge: '/logo.svg', requireInteraction: true });
      return { ok: true, via: 'local', detail: serverDetail };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, via: 'none', detail: serverDetail };
}
