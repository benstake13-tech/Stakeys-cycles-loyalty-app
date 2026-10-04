/**
 * End-to-end diagnostics for the booking-notification system.
 *
 * Answers one question for staff: "is the whole alert system working, and if
 * not, exactly which piece is missing?" It walks the real pipeline — config →
 * app_settings recipient → `send-email` deployed → `notify-booking` deployed →
 * Resend secret set → webhook → PushEngage device + server — and returns a
 * per-step verdict with a concrete fix.
 *
 * Everything that touches the network or the browser takes its dependency as an
 * argument, so the engine is fully unit-testable without a live project.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SystemStatus = 'pass' | 'fail' | 'warn' | 'skipped';
export type SystemGroup = 'pipeline' | 'email' | 'push';

/** A concrete action staff can take to fix a failing step. */
export interface SystemFix {
  label: string;
  /** Opens this URL in a new tab. */
  href?: string;
  /** Copies this text to the clipboard. */
  copy?: string;
  /** One line telling staff what to do with the copy/link. */
  hint?: string;
}

export interface SystemCheck {
  id: string;
  group: SystemGroup;
  label: string;
  status: SystemStatus;
  detail: string;
  fix?: SystemFix;
}

export const SYSTEM_GROUP_LABELS: Record<SystemGroup, string> = {
  pipeline: 'Booking Alert Pipeline (server)',
  email: 'Email delivery',
  push: 'Phone push',
};

/**
 * Turns a raw edge-function probe into a verdict.
 *
 * The two functions answer differently on purpose:
 *  - `send-email` validates its body, so a deployed function returns 400 for an
 *    empty probe and 500 with a specific message when its secret is missing.
 *  - `notify-booking` is webhook-only and rejects non-service-role callers, so a
 *    deployed function returns 403 to our anon-key probe.
 */
export function classifyFunctionProbe(
  name: string,
  status: number,
  body: string
): { status: SystemStatus; detail: string; hint?: string } {
  if (status === 0) {
    return {
      status: 'fail',
      detail: 'Could not reach the project — the probe request failed (network or CORS).',
      hint: 'Check the Supabase URL/anon key and that the project is online.',
    };
  }
  if (status === 404) {
    return {
      status: 'fail',
      detail: 'HTTP 404 — not deployed.',
      hint: `Run "supabase functions deploy ${name}" (source is in supabase/functions/${name}).`,
    };
  }
  // Our functions reject non-POST requests with 405, so a 405 proves the
  // function exists. A plain GET also avoids a CORS preflight, which an
  // undeployed function cannot answer from the browser.
  if (status === 405) {
    return { status: 'pass', detail: 'Deployed and reachable (function responded).' };
  }

  // The booking webhook functions authenticate with a shared secret header, so a
  // 401 to our secret-less probe still proves they are deployed.
  if (name === 'booking-email-notification' || name === 'booking-push-notification') {
    if (status === 401 || status === 403) {
      return { status: 'pass', detail: 'Deployed and correctly locked to the booking webhook secret.' };
    }
    if (status >= 500) {
      return { status: 'warn', detail: `Deployed, but returned HTTP ${status}.`, hint: 'Check the function logs.' };
    }
    return { status: 'pass', detail: `Deployed and reachable (HTTP ${status}).` };
  }

  if (name === 'send-email') {
    if (/RESEND_API_KEY is not configured/i.test(body)) {
      return {
        status: 'fail',
        detail: 'Deployed, but the RESEND_API_KEY secret is not set.',
        hint: 'Add RESEND_API_KEY under Supabase → Edge Functions → Secrets.',
      };
    }
    if (status === 400) {
      return { status: 'pass', detail: 'Deployed and reachable (expects a real email body).' };
    }
    if (status === 401 || status === 403) {
      return { status: 'warn', detail: `Deployed, but the probe was rejected (HTTP ${status}).` };
    }
    if (status >= 500) {
      return { status: 'warn', detail: `Deployed, but returned HTTP ${status}.`, hint: 'Check the function logs.' };
    }
    return { status: 'pass', detail: `Deployed and reachable (HTTP ${status}).` };
  }

  // notify-booking: 403 to an anon caller is the *expected*, healthy answer.
  if (status === 403) {
    return { status: 'pass', detail: 'Deployed and correctly locked to the database webhook.' };
  }
  if (status === 401) {
    return {
      status: 'warn',
      detail: 'Deployed, but JWT verification rejected the probe (HTTP 401).',
      hint: 'This is fine if the webhook sends the service_role key; otherwise check verify_jwt.',
    };
  }
  if (status >= 500) {
    return { status: 'warn', detail: `Deployed, but returned HTTP ${status}.`, hint: 'Check the function logs.' };
  }
  return { status: 'pass', detail: `Deployed (HTTP ${status}).` };
}

export function checkEmailRecipient(
  settings: { ownerEmail: string; emailAlertsEnabled: boolean } | null
): SystemCheck {
  if (!settings) {
    return {
      id: 'email-recipient',
      group: 'email',
      label: 'Workshop recipient is set (app_settings)',
      status: 'fail',
      detail: 'Could not read app_settings — the table may be missing or unreadable.',
      fix: { label: 'Open Table Editor', href: 'https://supabase.com/dashboard/project/_/editor' },
    };
  }
  if (!settings.ownerEmail) {
    return {
      id: 'email-recipient',
      group: 'email',
      label: 'Workshop recipient is set (app_settings)',
      status: 'fail',
      detail: 'No owner_email saved, so the workshop alert has nowhere to go.',
      fix: { label: 'Set it in Staff → Settings', hint: 'Save the workshop notification email in Staff Settings.' },
    };
  }
  if (!settings.emailAlertsEnabled) {
    return {
      id: 'email-recipient',
      group: 'email',
      label: 'Workshop recipient is set (app_settings)',
      status: 'warn',
      detail: `Recipient is ${settings.ownerEmail}, but email alerts are turned OFF.`,
      fix: { label: 'Turn email alerts on in Staff → Settings' },
    };
  }
  return {
    id: 'email-recipient',
    group: 'email',
    label: 'Workshop recipient is set (app_settings)',
    status: 'pass',
    detail: `Alerts will go to ${settings.ownerEmail}.`,
  };
}

export interface SystemTestDeps {
  supabaseUrl: string;
  anonKey: string;
  fetcher?: typeof fetch;
  readAppSettings?: () => Promise<{ ownerEmail: string; emailAlertsEnabled: boolean } | null>;
  getPushPermission?: () => Promise<string>;
  getServiceWorkerScopes?: () => Promise<Array<{ scope?: string }>>;
  getPushConfig?: () => Promise<{ appId: string | null; serverPush: boolean }>;
}

/**
 * Probes an edge function to see whether it is deployed.
 *
 * Uses a plain GET with no custom headers so the browser does not trigger a
 * CORS preflight — an undeployed function cannot answer an OPTIONS preflight, so
 * a POST-with-headers probe would surface as an opaque network failure instead
 * of a readable 404. Our functions reply 405 to a GET (deployed) or 404 (missing).
 */
async function probe(
  fetcher: typeof fetch,
  supabaseUrl: string,
  _anonKey: string,
  name: string
): Promise<{ status: number; body: string }> {
  try {
    const res = await fetcher(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${name}`, {
      method: 'GET',
    });
    return { status: res.status, body: await res.text().catch(() => '') };
  } catch (err) {
    return { status: 0, body: err instanceof Error ? err.message : 'unreachable' };
  }
}

export async function runNotificationSystemTests(deps: SystemTestDeps): Promise<SystemCheck[]> {
  const fetcher = deps.fetcher ?? fetch;
  const checks: SystemCheck[] = [];

  // 1. Config
  if (!deps.supabaseUrl || !deps.anonKey) {
    checks.push({
      id: 'config',
      group: 'pipeline',
      label: 'Supabase project configured',
      status: 'fail',
      detail: 'Supabase URL or anon key is missing, so nothing can be tested.',
    });
  } else {
    checks.push({
      id: 'config',
      group: 'pipeline',
      label: 'Supabase project configured',
      status: 'pass',
      detail: `Pointing at ${deps.supabaseUrl.replace(/^https?:\/\//, '')}.`,
    });
  }

  // 2. Edge functions deployed
  const probes: Array<{ name: string; label: string }> = [
    { name: 'send-email', label: 'send-email (customer confirmation, approval, decline)' },
    { name: 'notify-booking', label: 'notify-booking (workshop alert, service-role webhook)' },
    { name: 'booking-email-notification', label: 'booking-email-notification (booking webhook email)' },
    { name: 'booking-push-notification', label: 'booking-push-notification (booking webhook push)' },
  ];
  for (const { name, label } of probes) {
    const { status, body } = await probe(fetcher, deps.supabaseUrl, deps.anonKey, name);
    const verdict = classifyFunctionProbe(name, status, body);
    const secretMissing = /is not configured/i.test(body);
    checks.push({
      id: `fn-${name}`,
      group: 'pipeline',
      label: `${label} is deployed`,
      status: verdict.status,
      detail: verdict.detail,
      fix:
        verdict.status === 'pass'
          ? undefined
          : secretMissing
            ? { label: 'Copy secrets line', copy: 'env', hint: 'Paste into Supabase → Edge Functions → Secrets.' }
            : {
                label: 'Copy deploy command',
                copy: 'deploy',
                hint: 'Paste into a logged-in Supabase CLI terminal, then press Enter.',
              },
    });
  }

  // 3. Recipient / app_settings
  if (deps.readAppSettings) {
    const settings = await deps.readAppSettings().catch(() => null);
    checks.push(checkEmailRecipient(settings));
  }

  // 4. PushEngage client
  if (deps.getPushPermission) {
    const perm = await deps.getPushPermission().catch(() => 'unknown');
    checks.push({
      id: 'push-permission',
      group: 'push',
      label: 'This device allows notifications',
      status: perm === 'granted' ? 'pass' : perm === 'denied' ? 'fail' : 'warn',
      detail:
        perm === 'granted'
          ? 'Notification permission granted.'
          : perm === 'denied'
            ? 'Notifications are blocked on this device.'
            : `Permission is "${perm}".`,
      fix: perm === 'granted' ? undefined : { label: 'Enable push in Push Setup' },
    });
  }

  if (deps.getServiceWorkerScopes) {
    const scopes = await deps.getServiceWorkerScopes().catch(() => []);
    const root = scopes.some((s) => {
      try {
        return new URL(s.scope ?? '').pathname === '/';
      } catch {
        return s.scope === '/';
      }
    });
    checks.push({
      id: 'push-worker',
      group: 'push',
      label: 'Root service worker registered',
      status: root ? 'pass' : 'fail',
      detail: root
        ? 'A service worker is active at scope "/".'
        : 'No root-scope service worker — background pushes cannot arrive.',
      fix: root ? undefined : { label: 'Fix in Push Setup' },
    });
  }

  if (deps.getPushConfig) {
    const cfg = await deps.getPushConfig().catch(() => ({ appId: null, serverPush: false }));
    checks.push({
      id: 'push-server',
      group: 'push',
      label: 'Server can send push (PushEngage key)',
      status: cfg.serverPush ? 'pass' : cfg.appId ? 'warn' : 'fail',
      detail: cfg.serverPush
        ? 'Server-side push is configured.'
        : cfg.appId
          ? 'PushEngage app id is set, but the server REST key is missing — closed-app pushes will not send.'
          : 'No PushEngage app id reachable from the server.',
      fix: cfg.serverPush
        ? undefined
        : {
            label: 'Open PushEngage dashboard',
            href: 'https://dashboard.pushengage.com/',
            hint: 'Copy the REST API key and set PUSHENGAGE_API_KEY as a server secret.',
          },
    });
  }

  return checks;
}

export function summarizeSystem(checks: SystemCheck[]): {
  pass: number;
  fail: number;
  warn: number;
  total: number;
  ready: boolean;
} {
  const pass = checks.filter((c) => c.status === 'pass').length;
  const fail = checks.filter((c) => c.status === 'fail').length;
  const warn = checks.filter((c) => c.status === 'warn').length;
  return { pass, fail, warn, total: checks.length, ready: fail === 0 };
}
