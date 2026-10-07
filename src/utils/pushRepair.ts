/**
 * OneSignal push repair — the logic behind the Feature Test Bench's
 * "Repair Push Notifications" section.
 *
 * Web push has several independent failure points (server env, SDK, browser
 * permission, this device's subscription, the signed-in identity, and the
 * server-to-provider dispatch). This runs one ordered pass over all of them,
 * repairing the parts the browser can (permission, login, email) and telling a
 * human exactly what to set where for the parts it cannot (env vars, redeploy).
 *
 * Dependency-injected so the flow is testable without a live OneSignal SDK.
 */
import type { PushPermission } from './pushNotifications';

export type PushRepairStatus = 'pass' | 'warn' | 'fail' | 'fixed';

export interface PushRepairStep {
  id: string;
  label: string;
  status: PushRepairStatus;
  detail: string;
  hint?: string;
  /** Raw probe values behind this step, so a failure can be pinned precisely. */
  facts?: { label: string; value: string; ok?: boolean }[];
}

/** Shortens a secret-ish identifier for display without hiding which one it is. */
function mask(value: string | null | undefined, keep = 8): string {
  const v = String(value ?? '').trim();
  if (!v) return '—';
  return v.length <= keep ? v : `${v.slice(0, keep)}…`;
}

export interface PushRepairServerConfig {
  appId: string | null;
  serverPush: boolean;
  restKeyEnv?: string | null;
  restKeyEnvNames?: string[];
}

export interface PushRepairDeps {
  getServerConfig: () => Promise<PushRepairServerConfig>;
  initSdk: () => Promise<boolean>;
  getPermission: () => Promise<PushPermission>;
  requestPermission: () => Promise<PushPermission>;
  getSubscriptionId: () => Promise<string | null>;
  isSubscribed: () => Promise<boolean | null>;
  optInSubscription: () => Promise<string | null>;
  getConfiguredAppId: () => string;
  linkUser: (userId: string, tags?: Record<string, string | number>) => Promise<void>;
  registerEmail: (email: string) => Promise<void>;
  sendTestPush: () => Promise<{
    ok: boolean;
    via: string;
    envelope?: { id?: string; recipients?: number; errors?: string[] } | null;
  }>;
}

export interface PushRepairContext {
  userId?: string;
  displayName?: string;
  membershipNumber?: string;
  ownerEmail?: string;
}

const DEFAULT_REST_KEY_NAMES = [
  'ONESIGNAL_REST_API_KEY',
  'ONESIGNAL_API_KEY',
  'VITE_ONESIGNAL_REST_API_KEY',
];

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function identityTags(ctx: PushRepairContext): Record<string, string | number> {
  const tags: Record<string, string | number> = {};
  if (ctx.membershipNumber) tags.membership = ctx.membershipNumber;
  if (ctx.displayName) tags.name = ctx.displayName;
  return tags;
}

function permissionStep(perm: PushPermission, repaired: boolean): PushRepairStep {
  const base = { id: 'permission', label: 'Notification permission' };
  if (perm === 'granted') {
    return { ...base, status: 'pass', detail: 'This device is allowed to receive push notifications.' };
  }
  if (perm === 'denied') {
    return {
      ...base,
      status: 'fail',
      detail: 'Notifications are blocked for this site in the browser.',
      hint: 'Open the browser site settings (padlock icon) and allow notifications, then reload the app.',
    };
  }
  if (perm === 'unsupported') {
    return {
      ...base,
      status: 'fail',
      detail: 'This browser does not support web push.',
      hint: 'Use Chrome, Edge, Firefox or Safari 16.4+ on desktop or Android.',
    };
  }
  if (perm === 'not_configured') {
    return {
      ...base,
      status: 'fail',
      detail: 'Push is not configured — no App ID was resolved.',
      hint: 'Set VITE_ONESIGNAL_APP_ID (or ONESIGNAL_APP_ID) and redeploy.',
    };
  }
  if (repaired) {
    return {
      ...base,
      status: 'warn',
      detail: 'Permission is still pending — the browser prompt may have been dismissed.',
      hint: 'Reload the app and tap Allow on the notification prompt.',
    };
  }
  return {
    ...base,
    status: 'warn',
    detail: 'This device has not been granted notification permission yet.',
    hint: 'Press “Repair Push” to request it, or tap Allow on the browser prompt.',
  };
}


/** Which step repairs which part of the chain, for a single-step "Fix" button. */
export const PUSH_STEP_FIX_ACTION: Record<string, string> = {
  'server-config': 'Re-check server config',
  'sdk-loaded': 'Reload & re-initialise',
  permission: 'Request permission',
  subscription: 'Opt this device in',
  identity: 'Re-link this user',
  email: 'Re-attach email',
  dispatch: 'Re-send test push',
};

export async function runPushRepair(
  deps: PushRepairDeps,
  ctx: PushRepairContext,
  opts: { repair?: boolean; only?: string } = {}
): Promise<PushRepairStep[]> {
  const repair = Boolean(opts.repair);
  // When `only` is set, the pass still evaluates every step (so the list stays
  // complete) but performs a repair side-effect for just that one step.
  const canRepair = (id: string) => repair && (!opts.only || opts.only === id);
  const steps: PushRepairStep[] = [];

  // 1. Server push configuration (env vars + deployed functions).
  let serverPush = false;
  let serverAppId: string | null = null;
  let restKeyEnv: string | null = null;
  let restKeyNames: string[] = [];
  let cfgError: string | null = null;
  try {
    const cfg = await deps.getServerConfig();
    serverPush = Boolean(cfg.serverPush);
    serverAppId = cfg.appId;
    restKeyEnv = cfg.restKeyEnv ?? null;
    restKeyNames = cfg.restKeyEnvNames ?? [];
  } catch (e: any) {
    cfgError = e?.message || 'fetch failed';
  }

  const serverFacts = [
    { label: 'App ID (env)', value: mask(serverAppId), ok: Boolean(serverAppId) },
    { label: 'serverPush', value: String(serverPush), ok: serverPush },
    { label: 'REST key env', value: restKeyEnv || 'not found', ok: Boolean(restKeyEnv) },
    { label: 'Endpoint', value: '/api/onesignal/config', ok: !cfgError },
  ];

  if (cfgError) {
    steps.push({
      id: 'server-config',
      label: 'Server push config',
      status: 'fail',
      detail: `Could not read /api/onesignal/config (${cfgError}).`,
      hint: 'The host may not be deploying the api/onesignal functions. Check the Vercel project branch and redeploy.',
      facts: serverFacts,
    });
  } else if (!serverAppId) {
    steps.push({
      id: 'server-config',
      label: 'Server push config',
      status: 'fail',
      detail: 'The app ID was not returned by /api/onesignal/config.',
      hint: 'Set VITE_ONESIGNAL_APP_ID (or ONESIGNAL_APP_ID) in the deployment, then redeploy.',
      facts: serverFacts,
    });
  } else if (!serverPush) {
    const names = restKeyNames.length ? restKeyNames.join(', ') : DEFAULT_REST_KEY_NAMES.join(', ');
    steps.push({
      id: 'server-config',
      label: 'Server push config',
      status: 'fail',
      detail: 'App ID resolved but serverPush=false — the server cannot see the REST key.',
      hint: `Add the REST key under one of: ${names}. In Vercel set it for all environments, then Redeploy.`,
      facts: serverFacts,
    });
  } else {
    steps.push({
      id: 'server-config',
      label: 'Server push config',
      status: 'pass',
      detail: `App ID resolved and server push is ready${restKeyEnv ? ` (key from ${restKeyEnv})` : ''}.`,
      facts: serverFacts,
    });
  }

  // 2. SDK loaded + which App ID it is using.
  const sdkOk = await safe(() => deps.initSdk(), false);
  const appId = deps.getConfiguredAppId();
  steps.push({
    id: 'sdk-loaded',
    label: 'OneSignal SDK loaded',
    status: sdkOk ? 'pass' : 'fail',
    detail: sdkOk
      ? `The v16 web SDK initialised${appId ? ` with App ID ${appId.slice(0, 8)}…` : ''}.`
      : 'The OneSignal SDK did not initialise.',
    hint: sdkOk
      ? undefined
      : appId
      ? `Check that App ID ${appId.slice(0, 8)}… is a valid OneSignal app, then reload.`
      : 'Set the App ID in the Configure Push section below, then reload.',
    facts: [
      { label: 'Initialised', value: String(sdkOk), ok: sdkOk },
      { label: 'App ID in use', value: mask(appId), ok: Boolean(appId) },
    ],
  });

  // 3. Browser permission (repairable).
  let perm = await safe(() => deps.getPermission(), 'default' as PushPermission);
  if (canRepair('permission') && sdkOk && perm === 'default') {
    perm = await safe(() => deps.requestPermission(), perm);
  }
  const permission = permissionStep(perm, canRepair('permission') && sdkOk);
  const hasNotif = typeof window !== 'undefined' && 'Notification' in window;
  permission.facts = [
    { label: 'Permission', value: perm, ok: perm === 'granted' },
    { label: 'Browser Notification API', value: String(hasNotif), ok: hasNotif },
  ];
  steps.push(permission);

  // 4. This device's push subscription — id + opt-in state (repairable).
  //    Two failure shapes are common: the device has an id but is soft
  //    unsubscribed (optedIn:false), or permission was just granted and the
  //    SDK has not registered a device token yet. Both are fixed by an
  //    explicit optIn(), then giving OneSignal a moment to register.
  const granted = perm === 'granted';
  let subId = sdkOk ? await safe(() => deps.getSubscriptionId(), null) : null;
  let subscribed = sdkOk ? await safe(() => deps.isSubscribed(), null) : null;
  let optedInNow = false;
  if (canRepair('subscription') && sdkOk && granted && (subscribed === false || !subId)) {
    await safe(() => deps.optInSubscription(), null);
    optedInNow = true;
    for (let i = 0; i < 6 && (!subId || subscribed === false); i++) {
      if (i) await sleep(250);
      subId = await safe(() => deps.getSubscriptionId(), subId);
      subscribed = await safe(() => deps.isSubscribed(), subscribed);
    }
  }

  const subscriptionFacts = [
    { label: 'Subscription id', value: mask(subId), ok: Boolean(subId) },
    { label: 'Opted in', value: subscribed === null ? 'unknown' : String(subscribed), ok: subscribed === true },
    { label: 'Permission', value: perm, ok: granted },
  ];

  if (subId && subscribed !== false) {
    steps.push({
      id: 'subscription',
      label: 'Device push subscription',
      status: optedInNow ? 'fixed' : 'pass',
      detail: `Subscription ${mask(subId)} registered and opted in.`,
      facts: subscriptionFacts,
    });
  } else if (subId && subscribed === false) {
    steps.push({
      id: 'subscription',
      label: 'Device push subscription',
      status: 'warn',
      detail: 'This device has a subscription id but is not opted in, so it will not receive pushes.',
      hint: 'Press “Fix” on this step (or “Repair & Configure Push”) to opt this device back in.',
      facts: subscriptionFacts,
    });
  } else {
    steps.push({
      id: 'subscription',
      label: 'Device push subscription',
      status: 'warn',
      detail: granted
        ? 'Permission is granted but OneSignal has not registered this device yet.'
        : 'No subscription id until notification permission is granted.',
      hint: granted
        ? 'Tap “Enable on This Device” (or Allow on the prompt), then re-run in a few seconds.'
        : 'Tap “Enable on This Device” and allow notifications on this device.',
      facts: subscriptionFacts,
    });
  }

  // 5. Signed-in identity (repairable: logs the user into push).
  if (ctx.userId) {
    if (canRepair('identity') && sdkOk) {
      await safe(() => deps.linkUser(ctx.userId as string, identityTags(ctx)), undefined);
      const linkedId = await safe(() => deps.getSubscriptionId(), null);
      steps.push({
        id: 'identity',
        label: 'User linked to push',
        status: 'fixed',
        detail: `Linked external id ${mask(ctx.userId)} so targeted pushes reach this device.`,
        facts: [
          { label: 'User id (external)', value: mask(ctx.userId), ok: true },
          { label: 'Subscription id', value: mask(linkedId), ok: Boolean(linkedId) },
        ],
      });
    } else {
      steps.push({
        id: 'identity',
        label: 'User linked to push',
        status: 'pass',
        detail: `${ctx.displayName || 'This profile'} will be linked to push for targeted sends.`,
        facts: [
          { label: 'User id (external)', value: mask(ctx.userId), ok: true },
          { label: 'Display name', value: ctx.displayName || '—', ok: Boolean(ctx.displayName) },
          { label: 'Membership tag', value: ctx.membershipNumber || '—', ok: Boolean(ctx.membershipNumber) },
        ],
      });
    }
  } else {
    steps.push({
      id: 'identity',
      label: 'User linked to push',
      status: 'warn',
      detail: 'No signed-in profile to link — staff segment pushes still work.',
      hint: 'Sign in as a staff member so targeted pushes can be addressed to you.',
      facts: [{ label: 'Signed in', value: 'no', ok: false }],
    });
  }

  // 6. Owner email subscription (repairable).
  if (ctx.ownerEmail) {
    if (canRepair('email') && sdkOk) {
      await safe(() => deps.registerEmail(ctx.ownerEmail as string), undefined);
      steps.push({
        id: 'email',
        label: 'Email subscription',
        status: 'fixed',
        detail: `Attached ${ctx.ownerEmail} to this device for email-targeted pushes.`,
        facts: [{ label: 'Owner email', value: ctx.ownerEmail, ok: true }],
      });
    } else {
      steps.push({
        id: 'email',
        label: 'Email subscription',
        status: 'pass',
        detail: `${ctx.ownerEmail} can be attached to this device for email-targeted pushes.`,
        facts: [{ label: 'Owner email', value: ctx.ownerEmail, ok: true }],
      });
    }
  } else {
    steps.push({
      id: 'email',
      label: 'Email subscription',
      status: 'warn',
      detail: 'No owner email configured — email-targeted pushes will be skipped.',
      hint: 'Set the workshop owner email in app settings.',
      facts: [{ label: 'Owner email', value: 'not set', ok: false }],
    });
  }

  // 7. End-to-end dispatch probe.
  if (!serverPush) {
    steps.push({
      id: 'dispatch',
      label: 'Test push dispatch',
      status: 'warn',
      detail: 'Skipped — server push is not configured yet.',
      hint: 'Fix the server push config above, then re-run.',
      facts: [{ label: 'Reached OneSignal', value: 'no (skipped)', ok: false }],
    });
  } else {
    const res = await safe(
      () => deps.sendTestPush(),
      { ok: false, via: 'none', envelope: null } as Awaited<ReturnType<PushRepairDeps['sendTestPush']>>
    );
    const errors = res.envelope?.errors || [];
    const recipients = res.envelope?.recipients;
    const dispatchFacts = [
      { label: 'Transport', value: res.via, ok: res.via === 'server' },
      { label: 'OneSignal id', value: mask(res.envelope?.id ?? null), ok: Boolean(res.envelope?.id) },
      { label: 'Recipients', value: recipients === undefined ? 'n/a' : String(recipients), ok: (recipients ?? 0) > 0 },
      { label: 'Errors', value: errors.length ? errors.join('; ') : 'none', ok: errors.length === 0 },
    ];
    if (res.ok) {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'pass',
        detail: `OneSignal accepted and delivered to ${recipients ?? 0} device${(recipients ?? 0) === 1 ? '' : 's'}.`,
        facts: dispatchFacts,
      });
    } else if (errors.some((e) => /not subscribed/i.test(e))) {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'warn',
        detail: 'The server reached OneSignal, but no device is subscribed yet.',
        hint: 'Open the staff app on a phone, tap “Enable on This Device” and Allow, then re-run.',
        facts: dispatchFacts,
      });
    } else if (errors.length) {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'fail',
        detail: `OneSignal error: ${errors.join('; ')}`,
        hint: 'Make sure the App ID and REST key belong to the same OneSignal app.',
        facts: dispatchFacts,
      });
    } else {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'fail',
        detail: 'Push dispatch did not return a usable response.',
        hint: 'Deploy api/onesignal/notify.js and set ONESIGNAL_REST_API_KEY.',
        facts: dispatchFacts,
      });
    }
  }

  return steps;
}
