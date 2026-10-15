import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { buildNativeAccountTestMessage, buildNativeTestMessage } from './supabase/functions/onesignal-gateway/nativeTest';

const { invoke, getStatus, platform } = vi.hoisted(() => ({ invoke: vi.fn(), getStatus: vi.fn(), platform: { value: 'android', native: true } }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => platform.value },
  registerPlugin: () => ({ getStatus }),
}));
vi.mock('./src/lib/supabase', () => ({ supabase: { functions: { invoke } } }));
import { sendNativeAndroidTestPush } from './src/utils/nativePushTest';

const appId = '7f67ab94-3c85-4702-9cd8-d158cf294593';
const subscriptionId = '11111111-2222-4333-8444-555555555555';
const target = { action: 'test-native-account', platform: 'android-native', appId };
const singleDeviceTarget = { action: 'test-native', platform: 'android-native', appId, subscriptionId };
beforeEach(() => {
  vi.clearAllMocks();
  platform.value = 'android'; platform.native = true;
  getStatus.mockResolvedValue({ initialized: true, appId, subscriptionId, permission: false, optedIn: false });
  invoke.mockResolvedValue({ data: { accepted: true, id: 'message-1', recipients: 2, targetScope: 'signed-in-staff-android-devices', platform: 'android-native' }, error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('native Android push test', () => {
  it('sends to Android devices linked to the signed-in staff account, without browser fallback', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(await sendNativeAndroidTestPush()).toEqual({ appId, recipients: 2, messageId: 'message-1' });
    expect(invoke).toHaveBeenCalledWith('onesignal-gateway', expect.objectContaining({ body: target }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['web', 'ios'])('rejects the %s runtime without dispatch', async value => {
    platform.value = value; platform.native = value !== 'web';
    await expect(sendNativeAndroidTestPush()).rejects.toThrow('Staff Android APK');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('blocks when the native SDK is not initialized', async () => {
    getStatus.mockResolvedValue({ initialized: false, appId });
    await expect(sendNativeAndroidTestPush()).rejects.toThrow('not initialized');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('does not claim success for zero recipients', async () => {
    invoke.mockResolvedValue({ data: { accepted: true, id: 'message-1', recipients: 0 }, error: null });
    await expect(sendNativeAndroidTestPush()).rejects.toThrow('did not accept');
  });
  it('allows an empty errors array on acceptance', async () => {
    invoke.mockResolvedValue({ data: { accepted: true, id: 'message-1', errors: [], recipients: 2, targetScope: 'signed-in-staff-android-devices', platform: 'android-native' }, error: null });
    expect((await sendNativeAndroidTestPush()).messageId).toBe('message-1');
  });
  it('checks the returned target is the signed-in staff Android-device scope', async () => {
    invoke.mockResolvedValue({ data: { accepted: true, id: 'message-1', platform: 'android-native', targetScope: 'owner_email' }, error: null });
    await expect(sendNativeAndroidTestPush()).rejects.toThrow('did not confirm');
  });
  it('shows a server authentication failure without a local notification', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'Staff access required' }), { status: 403 }) } });
    await expect(sendNativeAndroidTestPush()).rejects.toThrow('Staff access required');
  });
});

describe('server native test target', () => {
  it('restricts dispatch to one subscription and Android push', () => {
    const message = buildNativeTestMessage(singleDeviceTarget, appId);
    expect(message).toMatchObject({ app_id: appId, include_subscription_ids: [subscriptionId], target_channel: 'push', isAndroid: true, isIos: false, isAnyWeb: false,
      small_icon: 'ic_stat_stakeys', android_accent_color: 'FF05C147', android_channel_id: 'stakeys_cycles_updates' });
    expect(message).not.toHaveProperty('included_segments');
    expect(message).not.toHaveProperty('filters');
    expect(message).not.toHaveProperty('include_aliases');
  });
  it.each(['segment', 'tag', 'email', 'externalUserId', 'filters', 'include_aliases', 'include_subscription_ids', 'included_segments'])('rejects a mixed %s target', field => {
    expect(() => buildNativeTestMessage({ ...singleDeviceTarget, [field]: 'anything' }, appId)).toThrow('only this phone');
  });
  it('rejects a web app ID and a list of subscription IDs', () => {
    expect(() => buildNativeTestMessage({ ...singleDeviceTarget, appId: 'web-app' }, appId)).toThrow('native Android');
    expect(() => buildNativeTestMessage({ ...singleDeviceTarget, subscriptionId: [subscriptionId] }, appId)).toThrow('One native');
  });
});

describe('server native multi-device test target', () => {
  const staffId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  it('targets only Android push subscriptions linked to the authenticated staff user', () => {
    const message = buildNativeAccountTestMessage(target, appId, staffId);
    expect(message).toMatchObject({
      app_id: appId,
      include_aliases: { external_id: [staffId] },
      target_channel: 'push',
      isAndroid: true,
      isIos: false,
      isAnyWeb: false,
      small_icon: 'ic_stat_stakeys',
    });
    expect(message).not.toHaveProperty('include_subscription_ids');
    expect(message).not.toHaveProperty('filters');
    expect(message).not.toHaveProperty('included_segments');
  });
  it.each(['subscriptionId', 'externalUserId', 'email', 'tag', 'segment', 'include_aliases', 'include_subscription_ids', 'included_segments', 'filters'])(
    'rejects a caller-supplied %s target', field => {
      expect(() => buildNativeAccountTestMessage({ ...target, [field]: 'anything' }, appId, staffId)).toThrow('only the signed-in staff account');
    }
  );
  it('rejects an invalid staff identity and wrong OneSignal app', () => {
    expect(() => buildNativeAccountTestMessage(target, appId, 'not-a-user-id')).toThrow('signed-in staff account');
    expect(() => buildNativeAccountTestMessage({ ...target, appId: 'web-app' }, appId, staffId)).toThrow('native Android');
  });
});
