/**
 * OneSignal Web Push integration.
 *
 * The v16 SDK is initialised from the page head (index.html) via the
 * `OneSignalDeferred` queue, so this module never calls `init` a second time —
 * the live SDK instance is only reachable through that queue. It identifies
 * each signed-in user (external_id = uid) so pushes can be targeted, attaches
 * the workshop owner's email so reminders can reach their devices, and exposes
 * the helpers the booking / reminder flows use. Real delivery to a phone
 * requires a configured app id and, for background/server sends, the REST key
 * on the backend.
 */

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured';

declare global {
  interface Window {
    /** Set by the inline <head> snippet in index.html. */
    __oneSignalHeadInit?: boolean;
    /** Command queue that hands the live SDK instance to callbacks. */
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
  }
}

interface OneSignalRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
}

const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID as string | undefined;

let runtimeConfig: OneSignalRuntimeConfig | null = null;
let initPromise: Promise<boolean> | null = null;

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getRuntimeConfig(): Promise<OneSignalRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const res = await fetch('/api/onesignal/config');
    const data = (await res.json()) as Partial<OneSignalRuntimeConfig> & { appId?: string | null };
    // A static host without the serverless function rewrites unknown paths to
    // index.html, so a non-JSON body (or missing appId field) must not be
    // treated as a configured backend.
    if (data && typeof data === 'object' && 'appId' in data) {
      runtimeConfig = {
        appId: data.appId ?? null,
        serverPush: Boolean(data.serverPush),
      };
    } else {
      runtimeConfig = { appId: envAppId || null, serverPush: false };
    }
  } catch {
    runtimeConfig = { appId: envAppId || null, serverPush: false };
  }
  const resolved: OneSignalRuntimeConfig = runtimeConfig ?? {
    appId: envAppId || null,
    serverPush: false,
  };
  runtimeConfig = resolved;
  if (!resolved.appId && envAppId) resolved.appId = envAppId;
  return resolved;
}

/**
 * Runs `fn` with the live OneSignal SDK instance. The v16 SDK is only handed
 * out through the `OneSignalDeferred` queue (window.OneSignal is a stub), so
 * every SDK call must go through here. Resolves `null` when the SDK never
 * loads (unsupported browser, blocked script, tests).
 */
function withOneSignal<T>(fn: (oneSignal: any) => Promise<T> | T): Promise<T | null> {
  if (!browserReady()) return Promise.resolve(null);
  return new Promise<T | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 8000);
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (oneSignal: any) => {
        window.clearTimeout(timer);
        try {
          resolve(await fn(oneSignal));
        } catch (err) {
          console.warn('[OneSignal] call failed:', err);
          resolve(null);
        }
      });
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Resolves once the SDK is initialised. index.html already initialises it in the
 * <head>, so we only wait for the instance — calling `init` again is rejected.
 */
export async function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!browserReady()) return false;
    const cfg = await getRuntimeConfig();
    if (!cfg.appId) return false;
    const ok = await withOneSignal((os) => Boolean(os));
    return Boolean(ok);
  })();
  return initPromise;
}

export async function getPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';

  const perm = await withOneSignal((os) => os?.Notifications?.permission ?? null);
  if (perm === true) return 'granted';
  if (perm === false) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return 'default';
}

/**
 * Requests permission and opts the device into push. Returns the effective
 * permission state; 'granted' means the device is registered for push.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';

  await withOneSignal(async (os) => {
    try {
      await os?.Notifications?.requestPermission?.();
    } catch (err) {
      console.warn('[OneSignal] permission request failed:', err);
    }
  });

  return getPushPermission();
}

/** Identifies the signed-in user and tags them so targeted pushes can reach them. */
export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  const configured = await initOneSignal();
  if (!configured) return;
  await withOneSignal(async (os) => {
    try {
      await os?.login?.(userId);
      if (tags) {
        const stringTags: Record<string, string> = {};
        for (const [k, v] of Object.entries(tags)) stringTags[k] = String(v);
        await os?.User?.addTags?.(stringTags);
      }
    } catch (err) {
      console.warn('[OneSignal] linkUser failed:', err);
    }
  });
}

/** Clears the personal identifiers added by linkUser. */
export async function unlinkUser() {
  await withOneSignal(async (os) => {
    try {
      await os?.logout?.();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Attaches an email to this device's OneSignal subscription so pushes addressed
 * to that email (e.g. the workshop owner's Gmail) reach this device. Safe to
 * call repeatedly; the SDK de-duplicates.
 */
export async function registerEmailSubscription(email: string) {
  const clean = String(email || '').trim();
  if (!clean) return;
  await withOneSignal(async (os) => {
    try {
      await os?.User?.addEmail?.(clean);
    } catch (err) {
      console.warn('[OneSignal] addEmail failed:', err);
    }
  });
}

export async function getSubscriptionId(): Promise<string | null> {
  const id = await withOneSignal((os) => os?.User?.PushSubscription?.id ?? null);
  return (id as string) || null;
}

/**
 * Sends a push through the backend so it lands even when the tab is closed.
 * Targets, in order of preference: a specific profile (external_id), an email
 * subscription, or a tag segment. Falls back to a foreground local notification
 * when the server isn't configured.
 */
export async function sendPushToUser(
  userId: string | undefined,
  title: string,
  body: string,
  url?: string,
  target?: { segment?: string; email?: string; tag?: { key: string; value: string } }
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
          url,
          ...(userId ? { externalUserId: userId } : {}),
          ...(!userId && target?.tag ? { tag: target.tag } : {}),
          ...(!userId && !target?.tag && target?.email ? { email: target.email } : {}),
          ...(!userId && !target?.tag && !target?.email && target?.segment ? { segment: target.segment } : {}),
        }),
      });
      // The function returns OneSignal's JSON envelope. A static host with no
      // serverless function rewrites this path to index.html, so require a JSON
      // body before trusting the 200 (otherwise we'd report a false success).
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data === 'object') return { ok: true, via: 'server' };
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
