/**
 * OneSignal Web Push integration.
 *
 * Uses the official `react-onesignal` SDK (installed dependency) instead of
 * injecting the CDN script at runtime. Links each signed-in user
 * (external_id = uid) so pushes can be targeted, and exposes helpers used by
 * the booking flow. Real delivery to a phone requires a configured app id and
 * (for background/server sends) the REST key on the backend.
 */

import OneSignal from 'react-onesignal';

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured';

interface OneSignalRuntimeConfig {
  appId: string | null;
  safariWebId: string | null;
  serverPush: boolean;
}

let runtimeConfig: OneSignalRuntimeConfig | null = null;
let initPromise: Promise<boolean> | null = null;

const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID as string | undefined;

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getRuntimeConfig(): Promise<OneSignalRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const res = await fetch('/api/onesignal/config');
    runtimeConfig = (await res.json()) as OneSignalRuntimeConfig;
  } catch {
    runtimeConfig = { appId: envAppId || null, safariWebId: null, serverPush: false };
  }
  const resolved: OneSignalRuntimeConfig = runtimeConfig ?? {
    appId: envAppId || null,
    safariWebId: null,
    serverPush: false,
  };
  runtimeConfig = resolved;
  // The browser build can also carry the app id directly.
  if (!resolved.appId && envAppId) resolved.appId = envAppId;
  return resolved;
}

/** Initialises the SDK once. Resolves true when push is actually configured. */
export async function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!browserReady()) return false;
    const cfg = await getRuntimeConfig();
    if (!cfg.appId) return false;

    try {
      await OneSignal.init({
        appId: cfg.appId,
        safari_web_id: cfg.safariWebId || undefined,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/' },
      });
      return true;
    } catch (err) {
      console.warn('[OneSignal] init failed:', err);
      return false;
    }
  })();
  return initPromise;
}

export async function getPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return 'default';
}

/**
 * Requests permission and slacks the OneSignal subscription. Returns the effective
 * permission state; 'granted' means the device is registered for push.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';

  const ok = await initOneSignal();
  if (!ok) return 'unsupported';

  try {
    await OneSignal.Notifications.requestPermission();
    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
    }
  } catch (err) {
    console.warn('[OneSignal] permission request failed:', err);
  }

  return getPushPermission();
}

/** Links the signed-in user so targeted pushes can reach this device. */
export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  const configured = await initOneSignal();
  if (!configured) return;
  try {
    await OneSignal.login(userId);
    if (tags) {
      const stringTags: Record<string, string> = {};
      for (const [k, v] of Object.entries(tags)) stringTags[k] = String(v);
      OneSignal.User.addTags(stringTags);
    }
    if (OneSignal.User?.PushSubscription?.optIn && Notification?.permission === 'granted') {
      await OneSignal.User.PushSubscription.optIn();
    }
  } catch (err) {
    console.warn('[OneSignal] linkUser failed:', err);
  }
}

export async function unlinkUser() {
  try {
    if (browserReady()) await OneSignal.logout();
  } catch {
    /* ignore */
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    if (!browserReady()) return null;
    const sub = OneSignal.User?.PushSubscription;
    return sub?.id || null;
  } catch {
    return null;
  }
}

/**
 * Sends a push through the backend so it lands even when the tab is closed.
 * Falls back to a foreground local notification when the server isn't configured.
 */
export async function sendPushToUser(
  userId: string | undefined,
  title: string,
  body: string,
  url?: string,
  tagFallback?: { key: string; value: string }
): Promise<{ ok: boolean; via: 'server' | 'local' | 'none' }> {
  const cfg = await getRuntimeConfig();

  if (cfg.serverPush) {
    try {
      const res = await fetch('/api/onesignal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          externalUserId: userId,
          url,
          ...(userId ? {} : tagFallback ? { tagFilter: tagFallback } : {}),
        }),
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
      return { ok: true, via: 'local' };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, via: 'none' };
}
