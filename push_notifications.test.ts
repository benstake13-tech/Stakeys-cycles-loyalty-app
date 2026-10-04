import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The util reads VITE_ONESIGNAL_APP_ID and caches init state at module load,
// so each test gets a fresh module instance.
const APP_ID = 'test-app-id';

/** A fake window.OneSignal whose async methods are all mocks. */
function fakeApi(overrides: Record<string, any> = {}) {
  const api: any = {
    login: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    Notifications: {
      permissionNative: 'granted',
      permission: true,
      requestPermission: vi.fn(async () => true),
    },
    User: {
      addTags: vi.fn(async () => {}),
      PushSubscription: { id: 'sub-1' },
    },
  };
  return { ...api, ...overrides };
}

async function load() {
  vi.stubEnv('VITE_ONESIGNAL_APP_ID', APP_ID);
  vi.resetModules();
  return await import('./src/utils/pushNotifications');
}

beforeEach(() => {
  // Default: server push configured, so sendPushToUser exercises the fetch path.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ appId: APP_ID, serverPush: true }) }))
  );
  (window as any).OneSignalDeferred = [];
  (window as any).OneSignal = undefined;
  // jsdom has no Notification API; the util guards on it for browser support.
  vi.stubGlobal('Notification', { permission: 'default' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).OneSignal;
  delete (window as any).OneSignalDeferred;
});

describe('pushNotifications (OneSignal)', () => {
  it('linkUser attaches the external id via login and sets tags', async () => {
    const api = fakeApi();
    (window as any).OneSignal = api;
    const { linkUser } = await load();
    await linkUser('uid-123', { role: 'staff', membership: 'STK-1' });

    expect(api.login).toHaveBeenCalledWith('uid-123');
    expect(api.User.addTags).toHaveBeenCalledWith({ role: 'staff', membership: 'STK-1' });
  });

  it('unlinkUser logs the subscriber out', async () => {
    const api = fakeApi();
    (window as any).OneSignal = api;
    const { unlinkUser } = await load();
    await unlinkUser();
    expect(api.logout).toHaveBeenCalled();
  });

  it('getSubscriptionId returns the SDK subscription id', async () => {
    (window as any).OneSignal = fakeApi();
    const { getSubscriptionId } = await load();
    expect(await getSubscriptionId()).toBe('sub-1');
  });

  it('getPushPermission prefers the native SDK permission', async () => {
    (window as any).OneSignal = fakeApi({
      Notifications: { permissionNative: 'denied', permission: false },
    });
    const { getPushPermission } = await load();
    expect(await getPushPermission()).toBe('denied');
  });

  it('requestPushPermission returns the permission from the native prompt', async () => {
    (window as any).OneSignal = fakeApi({
      Notifications: { permissionNative: 'granted', requestPermission: vi.fn(async () => true) },
    });
    const { requestPushPermission } = await load();
    expect(await requestPushPermission()).toBe('granted');
  });

  it('sendPushToUser posts the target external id to the onesignal-send edge function', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser('uid-9', 'Title', 'Body', 'https://x.test');
    const call = (fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/functions/v1/onesignal-send') && c[1]?.method === 'POST'
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ title: 'Title', body: 'Body', externalId: 'uid-9' });
  });

  it('sendPushToUser targets the admin audience when no user is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B');
    const call = (fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/functions/v1/onesignal-send') && c[1]?.method === 'POST'
    );
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ audience: 'admin' });
    expect(body.externalId).toBeUndefined();
    expect(body.segment).toBeUndefined();
  });

  it('falls back to a local notification when the edge function rejects the send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        if (String(url).includes('/functions/v1/onesignal-send')) {
          if (init?.method === 'POST') {
            return { ok: false, status: 502, text: async () => '{"error":"bad key"}' } as any;
          }
          return { ok: true, json: async () => ({ appId: APP_ID, serverPush: true }) } as any;
        }
        return { ok: false, status: 404, json: async () => ({}) } as any;
      })
    );
    const notifications: any[] = [];
    vi.stubGlobal(
      'Notification',
      Object.assign(
        function (this: any, title: string, opts: any) {
          notifications.push({ title, opts });
        },
        { permission: 'granted' }
      )
    );
    const { sendPushToUser } = await load();
    const res = await sendPushToUser('uid-1', 'T', 'B');
    expect(res.via).toBe('local');
    expect(notifications).toHaveLength(1);
  });

  it('initOneSignal resolves the SDK from the deferred queue and is idempotent', async () => {
    const api = fakeApi();
    (window as any).OneSignalDeferred = {
      push: (cb: any) => {
        (window as any).OneSignal = api;
        if (typeof cb === 'function') cb(api);
      },
    };
    const { initOneSignal } = await load();
    const first = await initOneSignal();
    const second = await initOneSignal();
    expect(first).toBe(second);
    expect(first).toBe(api);
  });
});
