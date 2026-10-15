import { supabase } from '../lib/supabase';
import { getNativeAndroidAppId } from './pushNotifications';

export interface NativePushTestResult {
  messageId: string;
  appId: string;
  recipients: number | null;
}

/** Called only by the deliberate native test button. Targets Android
 * subscriptions linked to the signed-in staff account, never an email tag or
 * broad segment. */
export async function sendNativeAndroidTestPush(): Promise<NativePushTestResult> {
  const appId = await getNativeAndroidAppId();
  const { data, error } = await supabase.functions.invoke('onesignal-gateway', {
    body: { action: 'test-native-account', platform: 'android-native', appId },
    signal: AbortSignal.timeout(20000),
  });
  if (error) {
    let detail;
    if (error.context instanceof Response) detail = await error.context.clone().json().catch(() => null);
    throw new Error(detail?.error || 'Native test could not reach the push gateway. Check your staff session and server configuration.');
  }
  const hasErrors = Array.isArray(data?.errors) ? data.errors.length > 0 : Boolean(data?.errors);
  if (data?.error || hasErrors || !data?.accepted || !data?.id || data?.recipients === 0) {
    const reasons = Array.isArray(data?.errors) ? data.errors.join('; ') : '';
    throw new Error(data?.error || reasons || 'OneSignal did not accept this native test. Check the Android subscription and FCM settings.');
  }
  if (data.platform !== 'android-native' || data.targetScope !== 'signed-in-staff-android-devices') {
    throw new Error('The server response did not confirm the signed-in staff Android-device target.');
  }
  return { appId, messageId: data.id, recipients: typeof data.recipients === 'number' ? data.recipients : null };
}
