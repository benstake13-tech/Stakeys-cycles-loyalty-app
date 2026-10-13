import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The util reads VITE_ONESIGNAL_APP_ID and caches init state at module load, so
// each test gets a fresh module instance.
const APP_ID = 'test-app-id';
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock('./src/lib/supabase', () => ({ supabase: { functions: { invoke: mockInvoke } } }));

/**
 * Installs a fake `OneSignalDeferred` queue that immediately hands the live SDK
 * to whatever callback is pushed — mirroring the v16 SDK's behaviour once ready.
 */
function installSdk(oneSignal: any) {
  (window as any).OneSignalDeferred = {
    push: (cb: any) => {
      if (typeof cb === 'function') cb(oneSignal);
    },
  };
  return oneSignal;
}

async function load() {
  vi.stubEnv('VITE_ONESIGNAL_APP_ID', APP_ID);
  vi.resetModules();
  return await import('./src/utils/pushNotifications');
}

function fakeSdk(overrides: Record<string, any> = {}) {
  const sdk: any = {
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    Notifications: {
      permission: true,
      requestPermission: vi.fn(async () => {}),
    },
    User: {
      addTags: vi.fn(async () => {}),
      addEmail: vi.fn(async () => {}),
      PushSubscription: { id: 'sub-1', optedIn: true, optIn: vi.fn(async () => {}) },
    },
    ...overrides,
  };
  return sdk;
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockImplementation(async (_name: string, { body }: any) => body.action === 'config'
    ? { data: { appId: APP_ID, androidAppId: APP_ID, serverPush: true, keySource: 'Supabase Edge Function secret' }, error: null }
    : { data: { id: 'msg-1', recipients: 1 }, error: null });
  (window as any).__oneSignalHeadInit = true;
  // jsdom has no Notification API; the util guards on it for browser support.
  vi.stubGlobal('Notification', { permission: 'default' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as any).OneSignalDeferred;
  delete (window as any).__oneSignalHeadInit;
});

describe('pushNotifications (OneSignal)', () => {
  it('linkUser identifies the profile and adds role tags through the SDK', async () => {
    const sdk = installSdk(fakeSdk());
    const { linkUser } = await load();
    await linkUser('uid-123', { role: 'staff', membership: 'STK-1' });

    expect(sdk.login).toHaveBeenCalledWith('uid-123');
    expect(sdk.User.addTags).toHaveBeenCalledWith({ role: 'staff', membership: 'STK-1' });
  });

  it('unlinkUser logs the subscriber out', async () => {
    const sdk = installSdk(fakeSdk());
    const { unlinkUser } = await load();
    await unlinkUser();
    expect(sdk.logout).toHaveBeenCalled();
  });

  it('registerEmailSubscription attaches the email to the subscription', async () => {
    const sdk = installSdk(fakeSdk());
    const { registerEmailSubscription } = await load();
    await registerEmailSubscription('stakeyscycle95@gmail.com');
    expect(sdk.User.addEmail).toHaveBeenCalledWith('stakeyscycle95@gmail.com');
  });

  it('getSubscriptionId returns the SDK push subscription id', async () => {
    installSdk(fakeSdk());
    const { getSubscriptionId } = await load();
    expect(await getSubscriptionId()).toBe('sub-1');
  });

  it('isPushSubscribed reflects the SDK opted-in flag', async () => {
    installSdk(fakeSdk({ User: { PushSubscription: { id: 'sub-1', optedIn: false } } }));
    const { isPushSubscribed } = await load();
    expect(await isPushSubscribed()).toBe(false);
  });

  it('optInPushSubscription calls optIn and returns the subscription id', async () => {
    const sdk = installSdk(fakeSdk());
    const { optInPushSubscription } = await load();
    expect(await optInPushSubscription()).toBe('sub-1');
    expect(sdk.User.PushSubscription.optIn).toHaveBeenCalled();
  });

  it('setConfiguredAppId stores, reports change, and can clear the override', async () => {
    const { setConfiguredAppId, getConfiguredAppId } = await load();
    expect(setConfiguredAppId('override-app')).toBe(true);
    expect(getConfiguredAppId()).toBe('override-app');
    expect(setConfiguredAppId('override-app')).toBe(false);
    expect(setConfiguredAppId('')).toBe(true);
    expect(getConfiguredAppId()).not.toBe('override-app');
  });

  it('ungranted SDK permission preserves the browser default state', async () => {
    installSdk(fakeSdk({ Notifications: { permission: false } }));
    const { getPushPermission } = await load();
    expect(await getPushPermission()).toBe('default');
  });

  it('requestPushPermission asks the SDK and reports the resulting permission', async () => {
    const sdk = installSdk(fakeSdk());
    const { requestPushPermission } = await load();
    expect(await requestPushPermission()).toBe('granted');
    expect(sdk.Notifications.requestPermission).toHaveBeenCalled();
  });

  it('sendPushToUser posts the target profile to the backend when server push is configured', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser('uid-9', 'Title', 'Body', 'https://x.test');
    const call = mockInvoke.mock.calls.find((c: any[]) => c[0] === 'onesignal-gateway' && c[1].body.action === 'notify');
    expect(call).toBeTruthy();
    const body = call![1].body;
    expect(body).toMatchObject({ title: 'Title', body: 'Body', externalUserId: 'uid-9' });
  });

  it('sendPushToUser targets a tag when no profile is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, { tag: { key: 'owner_email', value: 'a@b.test' } });
    const call = mockInvoke.mock.calls.find((c: any[]) => c[0] === 'onesignal-gateway' && c[1].body.action === 'notify');
    expect(call![1].body.tag).toEqual({ key: 'owner_email', value: 'a@b.test' });
  });

  it('sendPushToUser falls back to a segment when no profile or tag is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, { segment: 'staff' });
    const call = mockInvoke.mock.calls.find((c: any[]) => c[0] === 'onesignal-gateway' && c[1].body.action === 'notify');
    expect(call![1].body.segment).toBe('staff');
  });

  it('sendPushToUser reports ok:false when OneSignal says nothing is subscribed', async () => {
    const { sendPushToUser } = await load();
    mockInvoke.mockImplementation(async (_name: string, { body }: any) => body.action === 'config'
      ? { data: { appId: APP_ID, serverPush: true }, error: null }
      : { data: { id: '', errors: ['All included players are not subscribed'] }, error: null });
    const res = await sendPushToUser('uid-9', 'T', 'B');
    expect(res.ok).toBe(false);
    expect(res.via).toBe('server');
    expect(res.envelope?.errors?.[0]).toMatch(/not subscribed/i);
  });

  it('sendPushToUser reports ok:true when OneSignal accepts and delivers', async () => {
    const { sendPushToUser } = await load();
    mockInvoke.mockImplementation(async (_name: string, { body }: any) => body.action === 'config'
      ? { data: { appId: APP_ID, serverPush: true }, error: null }
      : { data: { id: 'msg-1', recipients: 1 }, error: null });
    const res = await sendPushToUser('uid-9', 'T', 'B');
    expect(res.ok).toBe(true);
    expect(res.envelope?.recipients).toBe(1);
  });

  it('initOneSignal resolves the SDK from the deferred queue and is idempotent', async () => {
    installSdk(fakeSdk());
    const { initOneSignal } = await load();
    const first = await initOneSignal();
    const second = await initOneSignal();
    expect(first).toBe(true);
    expect(second).toBe(true);
  });

  it('adminPushTarget addresses the owner_email tag group at the admin inbox', async () => {
    const { adminPushTarget, ADMIN_NOTIFICATION_EMAIL } = await load();
    expect(ADMIN_NOTIFICATION_EMAIL).toBe('stakeyscycle95@gmail.com');
    expect(adminPushTarget()).toEqual({ tag: { key: 'owner_email', value: 'stakeyscycle95@gmail.com' } });
  });

  it('an admin-targeted push is sent as a tag, never a broadcast segment', async () => {
    const { sendPushToUser, adminPushTarget } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, adminPushTarget());
    const call = mockInvoke.mock.calls.find((c: any[]) => c[0] === 'onesignal-gateway' && c[1].body.action === 'notify');
    const body = call![1].body;
    expect(body.tag).toEqual({ key: 'owner_email', value: 'stakeyscycle95@gmail.com' });
    expect(body.segment).toBeUndefined();
    expect(body.externalUserId).toBeUndefined();
  });
});

describe('push timeout regressions', () => {
 it('finishes when a loaded SDK permission operation never resolves', async () => {
  vi.useFakeTimers();
  installSdk(fakeSdk({Notifications:{requestPermission:()=>new Promise(()=>{})}}));
  const {requestPushPermission}=await load();
  const pending=requestPushPermission();
  await vi.advanceTimersByTimeAsync(8100);
  expect(await pending).toBe('timeout');
 });
 it('does not run an expired queued operation when SDK arrives late', async () => {
  vi.useFakeTimers();
  const callbacks:any[]=[];
  window.OneSignalDeferred=callbacks;
  const {requestPushPermission}=await load();
  const pending=requestPushPermission();
  await vi.advanceTimersByTimeAsync(8100);
  expect(await pending).toBe('timeout');
  const sdk=fakeSdk();
  for(const callback of callbacks)await callback(sdk);
  expect(sdk.Notifications.requestPermission).not.toHaveBeenCalled();
 });
 it('honours a browser denial even when SDK only reports false', async()=>{
  vi.stubGlobal('Notification',{permission:'denied'});
  installSdk(fakeSdk({Notifications:{permission:false}}));
  const {getPushPermission}=await load();
  expect(await getPushPermission()).toBe('denied');
 });
});
