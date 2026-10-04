/**
 * PushEngage Web Push integration.
 *
 * The PushEngage snippet in index.html loads the SDK and queues `init`, so this
 * module waits for `window.PushEngage` to appear instead of initialising a
 * second time. It identifies each signed-in user (profile_id) and puts them in
 * a role segment so pushes can be targeted, and exposes the helpers the booking
 * flow uses. Real delivery to a phone requires a configured app id and, for
 * background/server sends, the REST API key on the backend.
 */

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured';

declare global {
  interface Window {
    PushEngage?: any;
    /** V2 command queue / legacy API, replaced by the SDK once it initialises. */
    _peq?: any;
    /** V1 legacy API. */
    _pe?: any;
  }
}

interface PushEngageRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
}

const envAppId = (import.meta as any).env?.VITE_PUSHENGAGE_APP_ID as string | undefined;

let runtimeConfig: PushEngageRuntimeConfig | null = null;
let readyPromise: Promise<any | null> | null = null;

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getRuntimeConfig(): Promise<PushEngageRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const res = await fetch('/api/pushengage/config');
    runtimeConfig = (await res.json()) as PushEngageRuntimeConfig;
  } catch {
    runtimeConfig = { appId: envAppId || null, serverPush: false };
  }
  const resolved: PushEngageRuntimeConfig = runtimeConfig ?? {
    appId: envAppId || null,
    serverPush: false,
  };
  runtimeConfig = resolved;
  if (!resolved.appId && envAppId) resolved.appId = envAppId;
  return resolved;
}

/** Pushes a command onto the PushEngage queue if the SDK exposes it. */
function peq(command: any[]) {
  try {
    window._peq?.push?.(command);
  } catch {
    /* SDK not ready / queue frozen */
  }
}

/**
 * Resolves with the live PushEngage API once the SDK has initialised, or null
 * when it never loads (unsupported browser, blocked script, tests).
 */
export async function initPushEngage(): Promise<any | null> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!browserReady()) return null;
    const cfg = await getRuntimeConfig();
    if (!cfg.appId) return null;
    if (window.PushEngage) return window.PushEngage;

    // The head snippet drives init; the SDK invokes queued callbacks once ready.
    return await new Promise<any | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(window.PushEngage ?? null), 8000);
      try {
        window._peq = window._peq || [];
        window._peq.push(() => {
          window.clearTimeout(timer);
          resolve(window.PushEngage ?? null);
        });
      } catch {
        window.clearTimeout(timer);
        resolve(window.PushEngage ?? null);
      }
    });
  })();
  return readyPromise;
}

export async function getPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';

  const api = await initPushEngage();
  if (api?.getPermission) {
    try {
      const perm = await api.getPermission();
      if (perm) return perm as PushPermission;
    } catch {
      /* fall back to the raw browser permission */
    }
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return 'default';
}

/**
 * Requests permission through the native single-step opt-in and subscribes the
 * device. Returns the effective permission state; 'granted' means the device is
 * registered for push.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const cfg = await getRuntimeConfig();
  if (!cfg.appId) return 'not_configured';

  const api = await initPushEngage();
  if (!api) return 'unsupported';

  try {
    const res = await api.showNativePermissionPrompt?.();
    if (res?.permission) return res.permission as PushPermission;
  } catch (err) {
    console.warn('[PushEngage] permission request failed:', err);
  }

  return getPushPermission();
}

/** Identifies the signed-in user and tags them so targeted pushes can reach them. */
export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  const configured = await initPushEngage();
  if (!configured) return;
  try {
    peq(['identify', { profile_id: userId }]);
    if (tags) {
      const attributes: Record<string, string> = {};
      for (const [k, v] of Object.entries(tags)) attributes[k] = String(v);
      peq(['set-attributes', attributes]);
    }
    // Role segment (e.g. 'staff') so pushes can target a group. The segment must
    // exist in the PushEngage dashboard.
    const role = tags?.role;
    if (role) peq(['add-to-segment', String(role)]);
  } catch (err) {
    console.warn('[PushEngage] linkUser failed:', err);
  }
}

/** Clears the personal identifiers added by linkUser. */
export async function unlinkUser() {
  try {
    if (browserReady()) peq(['logout']);
  } catch {
    /* ignore */
  }
}

export async function getSubscriptionId(): Promise<string | null> {
  try {
    const api = await initPushEngage();
    if (!api?.getSubscriberId) return null;
    return (await api.getSubscriberId()) || null;
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
      const res = await fetch('/api/pushengage/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          url,
          ...(userId ? { profileId: userId } : {}),
          ...(userId ? {} : tagFallback ? { segment: tagFallback.value } : {}),
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
