import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The util reads VITE_PUSHENGAGE_APP_ID and caches init state at module load,
// so each test gets a fresh module instance.
const APP_ID = 'test-app-id';

/** A fake window.PushEngage whose async methods are all mocks. */
function fakeApi(overrides: Record<string, any> = {}) {
  return {
    getPermission: vi.fn(async () => 'granted'),
    showNativePermissionPrompt: vi.fn(async () => ({ permission: 'granted', subscriber_id: 'sub-1' })),
    getSubscriberId: vi.fn(async () => 'sub-1'),
    setProfileId: vi.fn(async () => {}),
    setAttributes: vi.fn(async () => {}),
    ...overrides,
  };
}

async function load() {
  vi.stubEnv('VITE_PUSHENGAGE_APP_ID', APP_ID);
  vi.resetModules();
  return await import('./src/utils/pushNotifications');
}

beforeEach(() => {
  // Default: server push configured, so sendPushToUser exercises the fetch path.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ appId: APP_ID, serverPush: true }) }))
  );
  (window as any)._peq = { push: vi.fn() };
  (window as any).PushEngage = undefined;
  // jsdom has no Notification API; the util guards on it for browser support.
  vi.stubGlobal('Notification', { permission: 'default' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).PushEngage;
  delete (window as any)._peq;
});

describe('pushNotifications (PushEngage)', () => {
  it('linkUser attaches the profile id and attributes via the SDK', async () => {
    const api = fakeApi();
    (window as any).PushEngage = api;
    const { linkUser } = await load();
    await linkUser('uid-123', { role: 'staff', membership: 'STK-1' });

    expect(api.setProfileId).toHaveBeenCalledWith('uid-123');
    expect(api.setAttributes).toHaveBeenCalledWith({ role: 'staff', membership: 'STK-1' });
  });

  it('unlinkUser logs the subscriber out', async () => {
    (window as any).PushEngage = fakeApi();
    const { unlinkUser } = await load();
    await unlinkUser();
    const queued = (window as any)._peq.push.mock.calls.map((c: any[]) => c[0]);
    expect(queued).toContainEqual(['logout']);
  });

  it('getSubscriptionId returns the SDK subscriber id', async () => {
    (window as any).PushEngage = fakeApi();
    const { getSubscriptionId } = await load();
    expect(await getSubscriptionId()).toBe('sub-1');
  });

  it('getPushPermission prefers the SDK permission', async () => {
    (window as any).PushEngage = fakeApi({ getPermission: vi.fn(async () => 'denied') });
    const { getPushPermission } = await load();
    expect(await getPushPermission()).toBe('denied');
  });

  it('requestPushPermission returns the permission from the native prompt', async () => {
    (window as any).PushEngage = fakeApi({
      showNativePermissionPrompt: vi.fn(async () => ({ permission: 'granted' })),
    });
    const { requestPushPermission } = await load();
    expect(await requestPushPermission()).toBe('granted');
  });

  it('sendPushToUser posts the target profile to the pushengage-send edge function', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser('uid-9', 'Title', 'Body', 'https://x.test');
    const call = (fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/functions/v1/pushengage-send') && c[1]?.method === 'POST'
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ title: 'Title', body: 'Body', profileId: 'uid-9' });
  });

  it('sendPushToUser targets the admin audience when no profile is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B');
    const call = (fetch as any).mock.calls.find(
      (c: any[]) => String(c[0]).includes('/functions/v1/pushengage-send') && c[1]?.method === 'POST'
    );
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ audience: 'admin' });
    expect(body.profileId).toBeUndefined();
    expect(body.segment).toBeUndefined();
  });

  it('falls back to a local notification when the edge function rejects the send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        if (String(url).includes('/functions/v1/pushengage-send')) {
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

  it('initPushEngage resolves the SDK from the queue and is idempotent', async () => {
    (window as any)._peq = {
      push: (cb: any) => {
        (window as any).PushEngage = fakeApi();
        if (typeof cb === 'function') cb();
      },
    };
    const { initPushEngage } = await load();
    const first = await initPushEngage();
    const second = await initPushEngage();
    expect(first).toBe(second);
    expect(first).toBe((window as any).PushEngage);
  });
});
