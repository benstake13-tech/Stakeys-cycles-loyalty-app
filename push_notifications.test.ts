import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The util reads VITE_ONESIGNAL_APP_ID and caches init state at module load, so
// each test gets a fresh module instance.
const APP_ID = 'test-app-id';

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
      PushSubscription: { id: 'sub-1' },
    },
    ...overrides,
  };
  return sdk;
}

beforeEach(() => {
  // Default: server push configured, so sendPushToUser exercises the fetch path.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ appId: APP_ID, serverPush: true }) }))
  );
  (window as any).__oneSignalHeadInit = true;
  // jsdom has no Notification API; the util guards on it for browser support.
  vi.stubGlobal('Notification', { permission: 'default' });
});

afterEach(() => {
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

  it('getPushPermission reflects the SDK permission', async () => {
    installSdk(fakeSdk({ Notifications: { permission: false } }));
    const { getPushPermission } = await load();
    expect(await getPushPermission()).toBe('denied');
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
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/onesignal/notify'));
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ title: 'Title', body: 'Body', externalUserId: 'uid-9' });
  });

  it('sendPushToUser targets a tag when no profile is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, { tag: { key: 'owner_email', value: 'a@b.test' } });
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/onesignal/notify'));
    expect(JSON.parse(call[1].body).tag).toEqual({ key: 'owner_email', value: 'a@b.test' });
  });

  it('sendPushToUser falls back to a segment when no profile or tag is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, { segment: 'staff' });
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/onesignal/notify'));
    expect(JSON.parse(call[1].body).segment).toBe('staff');
  });

  it('initOneSignal resolves the SDK from the deferred queue and is idempotent', async () => {
    installSdk(fakeSdk());
    const { initOneSignal } = await load();
    const first = await initOneSignal();
    const second = await initOneSignal();
    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});
