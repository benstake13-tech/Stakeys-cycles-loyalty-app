import { describe, it, expect, vi } from 'vitest';
import {
  classifyFunctionProbe,
  checkEmailRecipient,
  runNotificationSystemTests,
  summarizeSystem,
} from './src/utils/notificationDiagnostics';

const URL = 'https://lhojocpygcnkxvkrcuxh.supabase.co';
const KEY = 'anon-key';

/** Builds a fake fetch that answers the two edge-function probes. */
function fakeFetch(answers: Record<string, { status: number; body?: string }>) {
  return vi.fn(async (url: string) => {
    const name = String(url).split('/functions/v1/')[1];
    const a = answers[name] ?? { status: 404, body: '' };
    return {
      status: a.status,
      text: async () => a.body ?? '',
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('classifyFunctionProbe', () => {
  it('reports a 404 as not deployed', () => {
    const v = classifyFunctionProbe('send-email', 404, '');
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/not deployed/i);
  });

  it('treats send-email 400 as deployed and healthy', () => {
    expect(classifyFunctionProbe('send-email', 400, '').status).toBe('pass');
  });

  it('flags a missing RESEND_API_KEY secret as a failure', () => {
    const v = classifyFunctionProbe('send-email', 500, 'RESEND_API_KEY is not configured');
    expect(v.status).toBe('fail');
    expect(v.hint).toMatch(/RESEND_API_KEY/);
  });

  it('treats a 405 (GET on a POST-only function) as deployed', () => {
    expect(classifyFunctionProbe('send-email', 405, '').status).toBe('pass');
    expect(classifyFunctionProbe('notify-booking', 405, '').status).toBe('pass');
  });

  it('reports an unreachable project (status 0) as a failure, not a pass', () => {
    const v = classifyFunctionProbe('send-email', 0, '');
    expect(v.status).toBe('fail');
    expect(v.detail).toMatch(/could not reach/i);
  });

  it('treats notify-booking 403 as the expected healthy answer', () => {
    const v = classifyFunctionProbe('notify-booking', 403, 'restricted');
    expect(v.status).toBe('pass');
    expect(v.detail).toMatch(/webhook/i);
  });

  it('reads the pushengage-send config to tell closed-app push apart from foreground-only', () => {
    const ready = classifyFunctionProbe('pushengage-send', 200, '{"appId":"a","serverPush":true}');
    expect(ready.status).toBe('pass');
    const noKey = classifyFunctionProbe('pushengage-send', 200, '{"appId":"a","serverPush":false}');
    expect(noKey.status).toBe('warn');
    expect(noKey.hint).toMatch(/PUSHENGAGE_API_KEY/);
    expect(classifyFunctionProbe('pushengage-send', 404, '').status).toBe('fail');
  });
});

describe('checkEmailRecipient', () => {
  it('fails when no recipient is set', () => {
    expect(checkEmailRecipient({ ownerEmail: '', emailAlertsEnabled: true }).status).toBe('fail');
  });
  it('warns when alerts are turned off', () => {
    expect(checkEmailRecipient({ ownerEmail: 'a@b.com', emailAlertsEnabled: false }).status).toBe('warn');
  });
  it('passes when a recipient is set and alerts are on', () => {
    const c = checkEmailRecipient({ ownerEmail: 'a@b.com', emailAlertsEnabled: true });
    expect(c.status).toBe('pass');
    expect(c.detail).toContain('a@b.com');
  });
});

describe('runNotificationSystemTests', () => {
  it('surfaces the deployed/missing state of both functions and the recipient', async () => {
    const fetcher = fakeFetch({
      'send-email': { status: 400, body: '' },
      'notify-booking': { status: 403, body: 'restricted' },
      'booking-email-notification': { status: 401, body: 'Unauthorized' },
      'booking-push-notification': { status: 401, body: '{"error":"Unauthorized"}' },
      'pushengage-send': { status: 200, body: '{"appId":"a","serverPush":true}' },
    });
    const checks = await runNotificationSystemTests({
      supabaseUrl: URL,
      anonKey: KEY,
      fetcher,
      readAppSettings: async () => ({ ownerEmail: 'workshop@stakeys.co.uk', emailAlertsEnabled: true }),
      getPushPermission: async () => 'granted',
      getServiceWorkerScopes: async () => [{ scope: `${URL}/` }],
      getPushConfig: async () => ({ appId: 'app-1', serverPush: true }),
    });

    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId['fn-send-email'].status).toBe('pass');
    expect(byId['fn-notify-booking'].status).toBe('pass');
    expect(byId['fn-booking-email-notification'].status).toBe('pass');
    expect(byId['fn-booking-push-notification'].status).toBe('pass');
    expect(byId['fn-pushengage-send'].status).toBe('pass');
    expect(byId['email-recipient'].status).toBe('pass');
    expect(byId['push-permission'].status).toBe('pass');
    expect(byId['push-worker'].status).toBe('pass');
    expect(byId['push-server'].status).toBe('pass');
    expect(summarizeSystem(checks).ready).toBe(true);
  });

  it('reports the booking webhook functions as deployed when they answer 401', () => {
    // The booking-* functions only accept the shared webhook secret, so a plain
    // GET returning 401 still proves they exist.
    expect(classifyFunctionProbe('booking-email-notification', 401, 'Unauthorized').status).toBe('pass');
    expect(classifyFunctionProbe('booking-push-notification', 401, '{"error":"Unauthorized"}').status).toBe('pass');
  });

  it('offers a copy-the-deploy-command fix when a function is missing', async () => {
    const fetcher = fakeFetch({
      'send-email': { status: 404 },
      'notify-booking': { status: 404 },
    });
    const checks = await runNotificationSystemTests({
      supabaseUrl: URL,
      anonKey: KEY,
      fetcher,
      readAppSettings: async () => ({ ownerEmail: 'x@y.com', emailAlertsEnabled: true }),
    });
    const send = checks.find((c) => c.id === 'fn-send-email')!;
    expect(send.status).toBe('fail');
    expect(send.fix?.copy).toBe('deploy');
    expect(summarizeSystem(checks).ready).toBe(false);
  });

  it('points at the secrets line when only the RESEND key is missing', async () => {
    const fetcher = fakeFetch({
      'send-email': { status: 500, body: 'RESEND_API_KEY is not configured' },
      'notify-booking': { status: 403 },
    });
    const checks = await runNotificationSystemTests({
      supabaseUrl: URL,
      anonKey: KEY,
      fetcher,
      readAppSettings: async () => ({ ownerEmail: 'x@y.com', emailAlertsEnabled: true }),
    });
    const send = checks.find((c) => c.id === 'fn-send-email')!;
    expect(send.status).toBe('fail');
    expect(send.fix?.copy).toBe('env');
  });

  it('reports a missing root service worker as a failure', async () => {
    const fetcher = fakeFetch({ 'send-email': { status: 400 }, 'notify-booking': { status: 403 } });
    const checks = await runNotificationSystemTests({
      supabaseUrl: URL,
      anonKey: KEY,
      fetcher,
      readAppSettings: async () => ({ ownerEmail: 'x@y.com', emailAlertsEnabled: true }),
      getServiceWorkerScopes: async () => [{ scope: `${URL}/assets/` }],
    });
    expect(checks.find((c) => c.id === 'push-worker')!.status).toBe('fail');
  });

  it('warns (not fails) when push is client-only with no server key', async () => {
    const fetcher = fakeFetch({ 'send-email': { status: 400 }, 'notify-booking': { status: 403 } });
    const checks = await runNotificationSystemTests({
      supabaseUrl: URL,
      anonKey: KEY,
      fetcher,
      getPushConfig: async () => ({ appId: 'app-1', serverPush: false }),
    });
    const c = checks.find((x) => x.id === 'push-server')!;
    expect(c.status).toBe('warn');
    expect(c.fix?.href).toContain('pushengage');
  });
});
