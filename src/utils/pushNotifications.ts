/**
 * PushEngage Web Push integration.
 *
 * The PushEngage snippet in index.html loads the SDK and queues `init`, so this
 * module waits for `window.PushEngage` to appear instead of initialising a
 * second time. It identifies each signed-in user (profile_id) so pushes can be
 * targeted at that profile id, and exposes the helpers the booking flow uses.
 * Real delivery to a phone requires a configured app id and, for background/
 * server sends, the REST API key on the backend.
 *
 * Note: we target by profile id, never by PushEngage segment — this account's
 * plan has hit its segment limit, so a segment-targeted push would be dropped
 * ("Segment not found") while still returning HTTP 200.
 */

import { getStoredSupabaseAnonKey, getStoredSupabaseUrl } from '../supabase';

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
  const resolved: PushEngageRuntimeConfig = { appId: envAppId || null, serverPush: false };

  // Production: the pushengage-send edge function knows whether the REST key is
  // set. The static host has no /api, so this is the only config source there.
  try {
    const base = getStoredSupabaseUrl().replace(/\/+$/, '');
    const key = getStoredSupabaseAnonKey();
    if (base && key) {
      const res = await fetch(`${base}/functions/v1/pushengage-send`, {
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
      const res = await fetch('/api/pushengage/config');
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
    if (res?.permission) {
      const perm = res.permission as PushPermission;
      // A brand-new device subscription only exists after opt-in, so re-apply
      // the profile id now that it can be attached.
      if (perm === 'granted') await relinkUser();
      return perm;
    }
  } catch (err) {
    console.warn('[PushEngage] permission request failed:', err);
  }

  const perm = await getPushPermission();
  if (perm === 'granted') await relinkUser();
  return perm;
}

/** Identifies the signed-in user and tags them so targeted pushes can reach them. */
let lastLinkedUserId: string | null = null;
let lastLinkedTags: Record<string, string | number> | undefined;

export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  lastLinkedUserId = userId;
  lastLinkedTags = tags;
  const api = await initPushEngage();
  if (!api) return;
  try {
    // Attach the profile id to this device subscription so a server-side
    // `profile_id[]` push reaches it. Keep the legacy `identify` queue command
    // (proven to work) and also call the documented Web SDK `setProfileId` when
    // present, so linking works across SDK versions.
    peq(['identify', { profile_id: userId }]);
    if (typeof api.setProfileId === 'function') {
      await api.setProfileId(userId);
    }

    if (tags) {
      const attributes: Record<string, string> = {};
      for (const [k, v] of Object.entries(tags)) attributes[k] = String(v);
      if (typeof api.setAttributes === 'function') {
        await api.setAttributes(attributes);
      } else {
        peq(['set-attributes', attributes]);
      }
      // NB: no role segment — this PushEngage plan is at its segment limit, so
      // targeting is done by profile id only.
    }
  } catch (err) {
    console.warn('[PushEngage] linkUser failed:', err);
  }
}

/** Re-applies the last profile id — call after a device subscribes. */
export async function relinkUser(): Promise<void> {
  if (lastLinkedUserId) await linkUser(lastLinkedUserId, lastLinkedTags);
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
 * POSTs a push through the Supabase `pushengage-send` edge function, which holds
 * the PushEngage REST key server-side. This is the production path: unlike the
 * Express `/api/pushengage/notify` route (dev-only, never runs on the static
 * host), the edge function is always reachable, so a booking alert lands on the
 * phone even with the app closed.
 */
async function sendViaEdgeFunction(
  body: Record<string, unknown>
): Promise<{ ok: boolean; detail?: string }> {
  const base = getStoredSupabaseUrl().replace(/\/+$/, '');
  const key = getStoredSupabaseAnonKey();
  if (!base || !key) return { ok: false };
  try {
    const res = await fetch(`${base}/functions/v1/pushengage-send`, {
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
 * `pushengage-send` edge function first (production), then the dev-only Express
 * route, and finally a foreground local notification while the page is open.
 *
 * When `userId` is omitted the edge function targets the workshop admins/staff
 * (audience 'admin') resolved server-side — we cannot rely on a PushEngage
 * segment because this plan has hit its segment limit.
 */
export async function sendPushToUser(
  userId: string | undefined,
  title: string,
  body: string,
  url?: string,
  audience: 'admin' | 'all' = 'admin'
): Promise<{ ok: boolean; via: 'server' | 'local' | 'none' }> {
  const cfg = await getRuntimeConfig();

  if (cfg.serverPush) {
    const target = userId ? { profileId: userId } : { audience };
    const edge = await sendViaEdgeFunction({ title, body, url, ...target });
    if (edge.ok) return { ok: true, via: 'server' };

    // Dev fallback: the Express route only exists under `npm run dev`.
    try {
      const res = await fetch('/api/pushengage/notify', {
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
      return { ok: true, via: 'local' };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, via: 'none' };
}
