/**
 * OneSignal Web Push integration.
 *
 * Loads the OneSignal SDK, links each signed-in user (external_id = uid) so pushes
 * can be targeted, and exposes helpers used by the booking flow. Real delivery to a
 * phone requires a configured app id and (for background/server sends) the REST key
 * on the backend.
 */

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured';

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

interface OneSignalRuntimeConfig {
  appId: string | null;
  safariWebId: string | null;
  serverPush: boolean;
}

let runtimeConfig: OneSignalRuntimeConfig | null = null;
let sdkLoadPromise: Promise<void> | null = null;
let initPromise: Promise<boolean> | null = null;

const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID as string | undefined;

async function getRuntimeConfig(): Promise<OneSignalRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const res = await fetch('/api/onesignal/config');
    const parsed = (await res.json()) as OneSignalRuntimeConfig;
    runtimeConfig = parsed;
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

function loadSdk(): Promise<void> {
  if (window.OneSignal?.init) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * Resolves the OneSignal SDK instance. v16 only exposes the populated instance
 * through the OneSignalDeferred queue, so we enqueue a callback and await it.
 */
function getOneSignal(): Promise<any> {
  if (window.OneSignalDeferred?.length === 0 && window.OneSignal?.init) {
    return Promise.resolve(window.OneSignal);
  }
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    if (window.OneSignal?.init) return resolve(window.OneSignal);
    const timer = window.setTimeout(() => resolve(window.OneSignal || null), 8000);
    window.OneSignalDeferred.push((OS: any) => {
      window.clearTimeout(timer);
      resolve(OS);
    });
  });
}

/** Initialises the SDK once. Resolves true when push is actually configured. */
export async function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const cfg = await getRuntimeConfig();
    if (!cfg.appId) return false;

    await loadSdk();
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    return await new Promise<boolean>((resolve) => {
      window.OneSignalDeferred!.push(async (OS: any) => {
        try {
          await OS.init({
            appId: cfg.appId,
            safari_web_id: cfg.safariWebId || undefined,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerPath: '/OneSignalSDKWorker.js',
            serviceWorkerParam: { scope: '/' },
            notifyButton: { enable: false },
          });
          resolve(true);
        } catch (err) {
          console.warn('[OneSignal] init failed:', err);
          resolve(false);
        }
      });
    });
  })();
  return initPromise;
}

export async function getPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';
  if (!('Notification' in window)) return 'unsupported';
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

  const OS = await getOneSignal();
  if (!OS) return 'unsupported';

  try {
    // v16: request permission via the native notification API trigger.
    if (OS.Notifications?.requestPermission) {
      await OS.Notifications.requestPermission();
    } else if (OS.requestPermission) {
      await OS.requestPermission();
    } else if ('Notification' in window) {
      await Notification.requestPermission();
    }
    if (OS.User?.PushSubscription?.optIn) {
      await OS.User.PushSubscription.optIn();
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
  const OS = await getOneSignal();
  if (!OS) return;
  try {
    if (OS?.login) await OS.login(userId);
    if (tags && OS?.User?.addTags) await OS.User.addTags(tags);
    if (OS?.User?.PushSubscription?.optIn && Notification?.permission === 'granted') {
      await OS.User.PushSubscription.optIn();
    }
  } catch (err) {
    console.warn('[OneSignal] linkUser failed:', err);
  }
}

export async function unlinkUser() {
  try {
    if (window.OneSignal?.logout) await window.OneSignal.logout();
  } catch {
    /* ignore */
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    const OS = await getOneSignal();
    const sub = OS?.User?.PushSubscription;
    return sub?.id || sub?.getId?.() || null;
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
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.svg', badge: '/logo.svg', requireInteraction: true });
      return { ok: true, via: 'local' };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, via: 'none' };
}
