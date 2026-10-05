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
 * True when a registration's script looks like the legacy PushEngage worker
 * (`/service-worker.js?...appId=...`) rather than the OneSignal worker.
 */
export function isLegacyPushWorker(scriptURL: string | null | undefined): boolean {
  if (!scriptURL) return false;
  return /(^|\/)service-worker\.js(\?|$)/i.test(scriptURL) && !/OneSignalSDKWorker/i.test(scriptURL);
}

/**
 * Removes the PushEngage service worker left over from before the OneSignal
 * migration. It holds the root scope, so OneSignal's own worker can never
 * register and no device ever subscribes — the exact "no pushes arrive"
 * symptom. Returns the number of registrations removed.
 */
export async function unregisterLegacyPushWorkers(
  sw: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
): Promise<number> {
  if (!sw) return 0;
  const regs = await sw.getRegistrations().catch(() => []);
  let removed = 0;
  for (const reg of regs as ReadonlyArray<ServiceWorkerRegistration>) {
    const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
    if (!isLegacyPushWorker(url)) continue;
    try {
      if (await reg.unregister()) removed += 1;
    } catch {
      /* ignore a registration we can't remove */
    }
  }
  return removed;
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
 * explicitly here so step 2 can be fixed on its own. Any leftover PushEngage
 * worker is removed first — otherwise it keeps the root scope and OneSignal's
 * worker can never take over. Returns whether a root-scope worker exists after.
 */
export async function ensureRootServiceWorker(
  sw: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
): Promise<boolean> {
  if (!sw) return false;
  await unregisterLegacyPushWorkers(sw);
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

/**
 * Builds a paste-ready block of the Supabase Edge Function secrets the push
 * pipeline needs, so staff can copy them into Dashboard → Edge Functions →
 * Secrets (or hand them to an AI agent). Placeholder values are used when the
 * real secret is only known to the browser (the App API key never reaches it).
 */
export function supabaseSecretsBlock(opts: {
  projectRef: string;
  appId?: string | null;
  serverPush?: boolean;
}): string {
  const ref = opts.projectRef || '<project-ref>';
  const appId = opts.appId || '<your-onesignal-app-id>';
  const lines = [`ONESIGNAL_APP_ID=${appId}`];
  lines.push(
    opts.serverPush
      ? '# ONESIGNAL_API_KEY is already set on the server.'
      : 'ONESIGNAL_API_KEY=os_v2_app_your-app-api-key'
  );
  lines.push('BOOKING_WEBHOOK_SECRET=<must match the Vault booking_webhook_secret>');
  return [
    `Supabase Edge Function secrets — project "${ref}"`,
    `Dashboard: https://supabase.com/dashboard/project/${ref}/settings/functions`,
    '',
    ...lines,
    '',
    'OneSignal → Settings → Keys & IDs gives the App ID and App API key.',
  ].join('\n');
}
