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
  it('linkUser identifies the profile and adds the role segment via the _peq queue', async () => {
    (window as any).PushEngage = fakeApi();
    const { linkUser } = await load();
    await linkUser('uid-123', { role: 'staff', membership: 'STK-1' });

    const queued = (window as any)._peq.push.mock.calls.map((c: any[]) => c[0]);
    expect(queued).toContainEqual(['identify', { profile_id: 'uid-123' }]);
    expect(queued).toContainEqual(['add-to-segment', 'staff']);
    expect(queued).toContainEqual(['set-attributes', { role: 'staff', membership: 'STK-1' }]);
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

  it('sendPushToUser posts the target profile to the backend when server push is configured', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser('uid-9', 'Title', 'Body', 'https://x.test');
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/pushengage/notify'));
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ title: 'Title', body: 'Body', profileId: 'uid-9' });
  });

  it('sendPushToUser falls back to a segment when no profile is given', async () => {
    const { sendPushToUser } = await load();
    await sendPushToUser(undefined, 'T', 'B', undefined, { key: 'role', value: 'staff' });
    const call = (fetch as any).mock.calls.find((c: any[]) => String(c[0]).includes('/api/pushengage/notify'));
    expect(JSON.parse(call[1].body).segment).toBe('staff');
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
