import { withPushTimeout } from './pushTimeout';
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
import type { PushPermission, PushRuntimeDiagnostic } from './pushNotifications';

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
  getRuntimeDiagnostic: () => Promise<PushRuntimeDiagnostic>;
  getPermission: () => Promise<PushPermission>;
  requestPermission: () => Promise<PushPermission>;
  getSubscriptionId: () => Promise<string | null>;
  isSubscribed: () => Promise<boolean | null>;
  optInSubscription: () => Promise<string | null>;
  getConfiguredAppId: () => string;
  linkUser: (userId: string, tags?: Record<string, string | number>) => Promise<void>;
  registerEmail: (email: string) => Promise<void>;
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
    return await withPushTimeout(fn(), 30000);
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
      hint: 'Open this app or site’s notification settings and allow notifications, then reload.',
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
  'sdk-loaded': 'Re-check SDK status',
  permission: 'Request permission',
  subscription: 'Opt this device in',
  identity: 'Re-link this user',
  email: 'Re-attach email',
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
    const cfg = await withPushTimeout(deps.getServerConfig());
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

  // 2. Verify the actual client. A browser SDK pass is not proof that native
  //    Android OneSignal initialized from ApplicationClass.
  const runtime = await safe(
    () => deps.getRuntimeDiagnostic(),
    { client: 'unknown', appId: null, initialized: false } as PushRuntimeDiagnostic
  );
  const androidNative = runtime.client === 'android-native';
  const sdkOk = androidNative ? runtime.initialized : await safe(() => deps.initSdk(), false);
  const appId = androidNative ? runtime.appId : deps.getConfiguredAppId();
  steps.push({
    id: 'sdk-loaded',
    label: androidNative ? 'Android native SDK startup' : 'Android native client check',
    status: androidNative ? (sdkOk ? 'pass' : 'fail') : 'warn',
    detail: androidNative
      ? sdkOk
        ? `ApplicationClass initialized the native OneSignal SDK${appId ? ` with App ID ${appId.slice(0, 8)}…` : ''}.`
        : 'This Android app did not report OneSignal initialized by ApplicationClass.'
      : runtime.client === 'web'
        ? 'This is the web push client. A browser SDK result does not test native Android push.'
        : 'Could not verify that this client is the native Android app.',
    hint: androidNative && !sdkOk
      ? 'Check ApplicationClass registration, the native App ID resource, and the installed APK, then reopen the Android app.'
      : !androidNative
        ? 'Open this screen inside the Stakeys Cycles Android APK to check native push.'
        : undefined,
    facts: [
      { label: 'Client', value: runtime.client, ok: androidNative },
      { label: 'ApplicationClass initialized', value: androidNative ? String(runtime.initialized) : 'not verified', ok: androidNative && runtime.initialized },
      { label: androidNative ? 'Native Android App ID' : 'Web App ID', value: mask(runtime.appId), ok: androidNative && Boolean(runtime.appId) },
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

  // 6. Email subscriptions are a web channel, not part of native Android push.
  if (androidNative) {
    steps.push({
      id: 'email',
      label: 'Email channel (web only)',
      status: 'pass',
      detail: 'Not used for native Android push; no email subscription was changed.',
      facts: [{ label: 'Android push channel', value: 'not applicable', ok: true }],
    });
  } else if (ctx.ownerEmail) {
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

  // Live delivery is intentionally not part of this diagnostic flow. A test
  // must target the authenticated staff account's Android subscriptions only.
  steps.push({
    id: 'dispatch',
    label: 'Live notification test',
    status: 'warn',
    detail: serverPush
      ? 'Not sent. Server configuration is ready, but delivery has not been tested.'
      : 'Not sent. Fix the server configuration before testing delivery.',
    hint: 'Use Test My Android Devices to send only to Android subscriptions linked to the signed-in staff account. It does not target owner_email or a broad segment. Setup checks never send a notification.',
    facts: [
      { label: 'Server push configured', value: String(serverPush), ok: serverPush },
      { label: 'Remote notification', value: 'not sent', ok: false },
    ],
  });

  return steps;
}
