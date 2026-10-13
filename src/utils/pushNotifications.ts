/** Platform-aware OneSignal bootstrap with bounded SDK operations. */

import { withPushTimeout } from './pushTimeout';
import { supabase } from '../lib/supabase';

export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported' | 'not_configured' | 'timeout';

declare global {
  interface Window {
    /** Set only after successful web SDK initialization. */
    __oneSignalHeadInit?: boolean;
    /** Command queue that hands the live SDK instance to callbacks. */
    OneSignalDeferred?: Array<(oneSignal: any) => void>;
  }
}

interface OneSignalRuntimeConfig {
  appId: string | null;
  serverPush: boolean;
  androidAppId?: string | null;
}

const envAppId = (import.meta as any).env?.VITE_ONESIGNAL_APP_ID as string | undefined;

type NativePush = {
  initialize(args: { appId: string }): Promise<void>;
  login(args: { externalId: string }): Promise<void>;
  logout(): Promise<void>;
  requestPermission(): Promise<{ granted: boolean }>;
  getStatus(): Promise<{ initialized: boolean; permission?: boolean; subscriptionId?: string; optedIn?: boolean }>;
  optIn(): Promise<void>;
  addTags(args: { tags: Record<string, string> }): Promise<void>;
};
let nativePushPromise: Promise<NativePush | null> | null = null;
function nativePush(): Promise<NativePush | null> {
  if (!nativePushPromise) nativePushPromise = (async () => {
    try {
      const { Capacitor, registerPlugin } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return null;
      const plugin = registerPlugin<NativePush>('NativeOneSignal');
      return new Proxy(plugin, {
        get(target, property) {
          // A thenable proxy would be assimilated by Promise resolution.
          if (property === 'then') return undefined;
          const method = target[property as keyof NativePush];
          return (...args: any[]) => withPushTimeout(
            (method as any).apply(target, args), property === 'requestPermission' ? 30000 : 8000
          );
        },
      });
    } catch { return null; }
  })();
  return nativePushPromise;
}
let nativeReady: Promise<NativePush | null> | null = null;
async function initializeNativePush(): Promise<NativePush | null> {
  const native = await nativePush();
  if (!native) return null;
  // Android and Web Push may be separate OneSignal apps. Never silently
  // register an Android device against the website's Web Push App ID.
  const config = await getRuntimeConfig();
  // OneSignal can serve web and Android from the same app. Use a separate
  // Android App ID when configured; otherwise reuse the configured app ID.
  const androidAppId = String((import.meta as any).env?.VITE_ONESIGNAL_ANDROID_APP_ID || config.androidAppId || config.appId || '').trim();
  if (!androidAppId) {
      console.warn('[OneSignal] No OneSignal App ID is configured for native Android push');
    return null;
  }
  try { await native.initialize({ appId: androidAppId }); return native; }
  catch (err) { console.warn('[OneSignal] native initialization failed', err); return null; }
}

async function readyNativePush(): Promise<NativePush | null> {
  if (!nativeReady) nativeReady = initializeNativePush().then(result => {
    if (!result) nativeReady = null;
    return result;
  });
  return nativeReady;
}

let runtimeConfig: OneSignalRuntimeConfig | null = null;
let initPromise: Promise<boolean> | null = null;

function browserReady(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function getRuntimeConfig(): Promise<OneSignalRuntimeConfig> {
  if (runtimeConfig) return runtimeConfig;
  try {
    const { data, error } = await withPushTimeout(supabase.functions.invoke('onesignal-gateway', { body: { action: 'config' } }));
    if (error) throw error;
    // A static host without the serverless function rewrites unknown paths to
    // index.html, so a non-JSON body (or missing appId field) must not be
    // treated as a configured backend.
    if (data && typeof data === 'object' && 'appId' in data) {
      runtimeConfig = {
        appId: data.appId ?? null,
        androidAppId: data.androidAppId ?? data.appId ?? null,
        serverPush: Boolean(data.serverPush),
      };
    } else {
      runtimeConfig = { appId: envAppId || null, serverPush: false };
    }
  } catch {
    return { appId: envAppId || null, serverPush: false };
  }
  const resolved: OneSignalRuntimeConfig = runtimeConfig ?? {
    appId: envAppId || null,
    serverPush: false,
  };
  runtimeConfig = resolved;
  if (!resolved.appId && envAppId) resolved.appId = envAppId;
  return resolved;
}

/** Safe server configuration probe; the Edge Function never returns its secret. */
export async function getOneSignalServerConfig(): Promise<OneSignalRuntimeConfig & { keySource?: string | null }> {
  const { data, error } = await withPushTimeout(supabase.functions.invoke('onesignal-gateway', { body: { action: 'config' } }));
  if (error) throw error;
  if (!data || typeof data !== 'object' || !('appId' in data)) throw new Error('OneSignal Supabase gateway returned invalid configuration.');
  return {
    appId: data.appId ?? null,
    androidAppId: data.androidAppId ?? null,
    serverPush: Boolean(data.serverPush),
    keySource: data.keySource ?? null,
  };
}

let sdkInitialization: Promise<void> | null = null;
let webSdkLoad: Promise<boolean> | null = null;
async function prepareWebSdk(): Promise<boolean> {
  if (window.__oneSignalHeadInit) return true;
  if (webSdkLoad) return webSdkLoad;
  webSdkLoad = (async () => {
    const config = await getRuntimeConfig();
    let appId = config.appId;
    try { appId = localStorage.getItem('stakeys.onesignal.appId')?.trim() || appId; } catch { /* storage disabled */ }
    if (!appId) return false;
    try {
      await withPushTimeout(new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async os => {
          try {
            if (!sdkInitialization) sdkInitialization = Promise.resolve(os.init({ appId, allowLocalhostAsSecureOrigin: true,
              serviceWorkerPath: '/OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/' } })).catch(error => { sdkInitialization = null; throw error; });
            await sdkInitialization;
            window.__oneSignalHeadInit = true;
            resolve();
          } catch (error) { reject(error); }
        });
        if (!document.querySelector('[data-stakeys-push-sdk]')) {
          const script = document.createElement('script');
          script.dataset.stakeysPushSdk = 'true';
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.async = true;
          script.onerror = () => { script.remove(); reject(new Error('Push SDK failed to load')); };
          document.head.appendChild(script);
        }
      }));
      return true;
    } catch { return false; }
  })();
  const ready = await webSdkLoad;
  if (!ready) webSdkLoad = null;
  return ready;
}

/**
 * Runs `fn` with the live OneSignal SDK instance. The v16 SDK is only handed
 * out through the `OneSignalDeferred` queue (window.OneSignal is a stub), so
 * every SDK call must go through here. Resolves `null` when the SDK never
 * loads (unsupported browser, blocked script, tests).
 */
async function withOneSignal<T>(fn: (oneSignal: any) => Promise<T> | T): Promise<T | null> {
  if (!browserReady() || !(await prepareWebSdk())) return null;
  return new Promise<T | null>((resolve) => {
    let finished = false;
    const finish = (value: T | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (oneSignal: any) => {
        if (finished) return;
        try {
          finish(await fn(oneSignal));
        } catch (err) {
          console.warn('[OneSignal] call failed:', err);
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
}

/**
 * Initializes the appropriate platform SDK once; failed initialization is retryable.
 */
export async function initOneSignal(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (await nativePush()) return Boolean(await readyNativePush());
    if (!browserReady()) return false;
    const cfg = await getRuntimeConfig();
    if (!cfg.appId && !readAppIdOverride()) return false;
    const ok = await withOneSignal((os) => Boolean(os));
    return Boolean(ok);
  })();
  const result = await initPromise;
  if (!result) initPromise = null;
  return result;
}

export async function getPushPermission(): Promise<PushPermission> {
  if (await nativePush()) {
    const native = await readyNativePush();
    if (!native) return 'not_configured';
    try { return (await native.getStatus()).permission ? 'granted' : 'default'; }
    catch { return 'unsupported'; }
  }
  const cfg = await getRuntimeConfig();
  if (!cfg.appId && !readAppIdOverride()) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';

  const perm = await withOneSignal((os) => os?.Notifications?.permission ?? null);
  if (perm === true) return 'granted';
  // OneSignal false means not granted; it does not mean permanently denied.
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return 'default';
}

/**
 * Requests OS/browser permission. Registration and delivery require separate checks.
 */
export async function requestPushPermission(): Promise<PushPermission> {
  if (await nativePush()) {
    const native = await readyNativePush();
    if (!native) return 'not_configured';
    try { return (await native.requestPermission()).granted ? 'granted' : 'denied'; }
    catch { return 'timeout'; }
  }
  const cfg = await getRuntimeConfig();
  if (!cfg.appId && !readAppIdOverride()) return 'not_configured';
  if (!browserReady() || !('Notification' in window)) return 'unsupported';

  const requested = await withOneSignal(async (os) => {
    try {
      if (!os?.Notifications?.requestPermission) return false;
      await os.Notifications.requestPermission();
      return true;
    } catch (err) {
      console.warn('[OneSignal] permission request failed:', err);
    }
  });

  if (!requested) return 'timeout';
  return Notification.permission === 'denied' ? 'denied' :
    Notification.permission === 'granted' ? 'granted' : getPushPermission();
}

/** Identifies the signed-in user and tags them so targeted pushes can reach them. */
export async function linkUser(userId: string, tags?: Record<string, string | number>) {
  const configured = await initOneSignal();
  if (!configured) return;
  const native = await nativePush();
  if (native) {
    await native.login({ externalId: userId });
    if (tags) {
      const stringTags: Record<string, string> = {};
      for (const [key, value] of Object.entries(tags)) stringTags[key] = String(value);
      await native.addTags({ tags: stringTags });
    }
    return;
  }
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
  const native = await nativePush();
  if (native) { await native.logout(); return; }
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
  if (await nativePush()) return; // email subscriptions use the web SDK only
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
  if (await nativePush()) {
    const native = await readyNativePush();
    return native ? (await native.getStatus()).subscriptionId || null : null;
  }
  const id = await withOneSignal((os) => os?.User?.PushSubscription?.id ?? null);
  return (id as string) || null;
}

/** Whether this device's push subscription is opted in (null when unknown). */
export async function isPushSubscribed(): Promise<boolean | null> {
  if (await nativePush()) {
    const native = await readyNativePush();
    return native ? (await native.getStatus()).optedIn ?? null : null;
  }
  const optedIn = await withOneSignal((os) => os?.User?.PushSubscription?.optedIn ?? null);
  return typeof optedIn === 'boolean' ? optedIn : null;
}

/**
 * Explicitly opts this device in. Granting browser permission is not always
 * enough — a device that was previously soft-unsubscribed needs `optIn()` to
 * start receiving pushes again. Returns the subscription id afterwards.
 */
export async function optInPushSubscription(): Promise<string | null> {
  if (await nativePush()) {
    const native = await readyNativePush();
    if (!native) return null;
    await native.optIn();
    return getSubscriptionId();
  }
  await withOneSignal(async (os) => {
    try {
      await os?.User?.PushSubscription?.optIn?.();
    } catch (err) {
      console.warn('[OneSignal] optIn failed:', err);
    }
  });
  return getSubscriptionId();
}

/** localStorage key holding a staff-set App ID override. */
export const APP_ID_OVERRIDE_KEY = 'stakeys.onesignal.appId';

/**
 * The single admin inbox every workshop alert is addressed to. Booking and
 * system pushes are targeted at the devices tagged with this email so they
 * reach the owner only — never a broadcast to every subscriber.
 */
export const ADMIN_NOTIFICATION_EMAIL = 'stakeyscycle95@gmail.com';

/**
 * OneSignal target for admin-only pushes: the `owner_email` tag group. Devices
 * get this tag on sign-in when they belong to the admin or a staff member
 * (see App.tsx). Pass `undefined` as the profile id to use it.
 */
export function adminPushTarget(email: string = ADMIN_NOTIFICATION_EMAIL) {
  return { tag: { key: 'owner_email', value: email } };
}

/** The App ID the app is currently configured to use (override or env). */
export function getConfiguredAppId(): string {
  const override = readAppIdOverride();
  return override || envAppId || '';
}

function readAppIdOverride(): string {
  try {
    return (localStorage.getItem(APP_ID_OVERRIDE_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Stores a Web App ID override for the bootstrap to pick up on the next load, or
 * clears it when given an empty value. Returns true when the stored value
 * actually changed (so the caller knows a reload is required).
 */
export function setConfiguredAppId(appId: string): boolean {
  const clean = String(appId || '').trim();
  try {
    const current = readAppIdOverride();
    if (clean === current) return false;
    if (clean) localStorage.setItem(APP_ID_OVERRIDE_KEY, clean);
    else localStorage.removeItem(APP_ID_OVERRIDE_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface PushSendResult {
  ok: boolean;
  via: 'server' | 'local' | 'none';
  /** OneSignal's raw response, when the server push path was reached. */
  envelope?: { id?: string; recipients?: number; errors?: string[] } | null;
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
): Promise<PushSendResult> {
  const cfg = await getRuntimeConfig();

  if (cfg.serverPush) {
    try {
      const { data, error } = await withPushTimeout(supabase.functions.invoke('onesignal-gateway', {
        body: {
          action: 'notify',
          title,
          body,
          url,
          ...(userId ? { externalUserId: userId } : {}),
          ...(!userId && target?.tag ? { tag: target.tag } : {}),
          ...(!userId && !target?.tag && target?.email ? { email: target.email } : {}),
          ...(!userId && !target?.tag && !target?.email && target?.segment ? { segment: target.segment } : {}),
        },
      }));
      if (error) throw error;
      if (data && typeof data === 'object') {
        const errors = Array.isArray((data as any).errors) ? (data as any).errors : [];
        // OneSignal answers 200 with `errors:["All included players are not
        // subscribed"]` when nothing is opted in — that is NOT a delivery.
        const ok = errors.length === 0 && !(data as any).error;
        return { ok, via: 'server', envelope: data as any };
      }
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
