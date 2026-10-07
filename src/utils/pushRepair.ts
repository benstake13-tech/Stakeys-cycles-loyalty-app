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

export async function runPushRepair(
  deps: PushRepairDeps,
  ctx: PushRepairContext,
  opts: { repair?: boolean } = {}
): Promise<PushRepairStep[]> {
  const repair = Boolean(opts.repair);
  const steps: PushRepairStep[] = [];

  // 1. Server push configuration (env vars + deployed functions).
  let serverPush = false;
  try {
    const cfg = await deps.getServerConfig();
    serverPush = cfg.serverPush;
    if (!cfg.appId) {
      steps.push({
        id: 'server-config',
        label: 'Server push config',
        status: 'fail',
        detail: 'The app ID was not returned by /api/onesignal/config.',
        hint: 'Set VITE_ONESIGNAL_APP_ID (or ONESIGNAL_APP_ID) in the deployment, then redeploy.',
      });
    } else if (!cfg.serverPush) {
      const names = cfg.restKeyEnvNames?.length ? cfg.restKeyEnvNames.join(', ') : DEFAULT_REST_KEY_NAMES.join(', ');
      steps.push({
        id: 'server-config',
        label: 'Server push config',
        status: 'fail',
        detail: 'App ID resolved but serverPush=false — the server cannot see the REST key.',
        hint: `Add the REST key under one of: ${names}. In Vercel set it for all environments, then Redeploy.`,
      });
    } else {
      steps.push({
        id: 'server-config',
        label: 'Server push config',
        status: 'pass',
        detail: `App ID resolved and server push is ready${cfg.restKeyEnv ? ` (key from ${cfg.restKeyEnv})` : ''}.`,
      });
    }
  } catch {
    steps.push({
      id: 'server-config',
      label: 'Server push config',
      status: 'fail',
      detail: 'Could not reach /api/onesignal/config.',
      hint: 'The host may not be deploying the api/onesignal functions. Check the Vercel project branch and redeploy.',
    });
  }

  // 2. SDK loaded.
  const sdkOk = await safe(() => deps.initSdk(), false);
  steps.push(
    sdkOk
      ? { id: 'sdk-loaded', label: 'OneSignal SDK loaded', status: 'pass', detail: 'The v16 web SDK initialised.' }
      : {
          id: 'sdk-loaded',
          label: 'OneSignal SDK loaded',
          status: 'fail',
          detail: 'The OneSignal SDK did not initialise.',
          hint: 'Check that index.html loads the OneSignal SDK and the app ID is correct.',
        }
  );

  // 3. Browser permission (repairable).
  let perm = await safe(() => deps.getPermission(), 'default' as PushPermission);
  if (repair && sdkOk && perm === 'default') {
    perm = await safe(() => deps.requestPermission(), perm);
  }
  steps.push(permissionStep(perm, repair && sdkOk));

  // 4. This device's push subscription id.
  const subId = sdkOk ? await safe(() => deps.getSubscriptionId(), null) : null;
  if (subId) {
    steps.push({
      id: 'subscription',
      label: 'Device push subscription',
      status: 'pass',
      detail: `Subscription ${String(subId).slice(0, 8)}… registered.`,
    });
  } else {
    steps.push({
      id: 'subscription',
      label: 'Device push subscription',
      status: 'warn',
      detail:
        perm === 'granted'
          ? 'No subscription id yet — OneSignal may need a moment to register this device.'
          : 'No subscription id until notification permission is granted.',
      hint: perm === 'granted' ? 'Re-run the repair in a few seconds.' : 'Grant permission on this device, then re-run.',
    });
  }

  // 5. Signed-in identity (repairable: logs the user into push).
  if (ctx.userId) {
    if (repair && sdkOk) {
      await safe(() => deps.linkUser(ctx.userId as string, identityTags(ctx)), undefined);
      steps.push({
        id: 'identity',
        label: 'User linked to push',
        status: 'fixed',
        detail: `Linked external id ${ctx.userId.slice(0, 8)}… so targeted pushes reach this device.`,
      });
    } else {
      steps.push({
        id: 'identity',
        label: 'User linked to push',
        status: 'pass',
        detail: `${ctx.displayName || 'This profile'} will be linked to push for targeted sends.`,
      });
    }
  } else {
    steps.push({
      id: 'identity',
      label: 'User linked to push',
      status: 'warn',
      detail: 'No signed-in profile to link — staff segment pushes still work.',
    });
  }

  // 6. Owner email subscription (repairable).
  if (ctx.ownerEmail) {
    if (repair && sdkOk) {
      await safe(() => deps.registerEmail(ctx.ownerEmail as string), undefined);
      steps.push({
        id: 'email',
        label: 'Email subscription',
        status: 'fixed',
        detail: `Attached ${ctx.ownerEmail} to this device for email-targeted pushes.`,
      });
    } else {
      steps.push({
        id: 'email',
        label: 'Email subscription',
        status: 'pass',
        detail: `${ctx.ownerEmail} can be attached to this device for email-targeted pushes.`,
      });
    }
  }

  // 7. End-to-end dispatch probe.
  if (!serverPush) {
    steps.push({
      id: 'dispatch',
      label: 'Test push dispatch',
      status: 'warn',
      detail: 'Skipped — server push is not configured yet.',
      hint: 'Fix the server push config above, then re-run.',
    });
  } else {
    const res = await safe(
      () => deps.sendTestPush(),
      { ok: false, via: 'none', envelope: null } as Awaited<ReturnType<PushRepairDeps['sendTestPush']>>
    );
    const errors = res.envelope?.errors || [];
    if (res.ok) {
      const recipients = res.envelope?.recipients ?? 0;
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'pass',
        detail: `OneSignal accepted and delivered to ${recipients} device${recipients === 1 ? '' : 's'}.`,
      });
    } else if (errors.some((e) => /not subscribed/i.test(e))) {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'warn',
        detail: 'The server reached OneSignal, but no device is subscribed yet.',
        hint: 'Open the staff app on a phone, tap Allow on the notification prompt (or “Enable Push”), then re-run.',
      });
    } else if (errors.length) {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'fail',
        detail: `OneSignal error: ${errors.join('; ')}`,
        hint: 'Make sure the App ID and REST key belong to the same OneSignal app.',
      });
    } else {
      steps.push({
        id: 'dispatch',
        label: 'Test push dispatch',
        status: 'fail',
        detail: 'Push dispatch did not return a usable response.',
        hint: 'Deploy api/onesignal/notify.js and set ONESIGNAL_REST_API_KEY.',
      });
    }
  }

  return steps;
}
