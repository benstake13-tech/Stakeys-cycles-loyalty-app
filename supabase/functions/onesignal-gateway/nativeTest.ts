const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateNativeApp(body: Record<string, unknown>, androidAppId: string) {
  if (body.platform !== 'android-native' || body.appId !== androidAppId) {
    throw new Error('The test must use the initialized native Android OneSignal app.');
  }
}

/** This test action cannot fall through to aliases, tags or segments. */
export function buildNativeTestMessage(body: Record<string, unknown>, androidAppId: string) {
  validateNativeApp(body, androidAppId);
  if (typeof body.subscriptionId !== 'string' || !UUID.test(body.subscriptionId)) {
    throw new Error('One native push subscription ID is required. Enable notifications on this phone first.');
  }
  for (const field of ['externalUserId', 'email', 'tag', 'segment', 'include_aliases', 'include_subscription_ids', 'included_segments', 'filters']) {
    if (field in body) throw new Error('Native tests may target only this phone’s subscription ID.');
  }
  return {
    app_id: androidAppId,
    include_subscription_ids: [body.subscriptionId],
    target_channel: 'push',
    small_icon: 'ic_stat_stakeys',
    android_accent_color: 'FF05C147',
    android_channel_id: 'stakeys_cycles_updates',
    isAndroid: true,
    isIos: false,
    isAnyWeb: false,
    headings: { en: "Stakey's Staff · Android push test" },
    contents: { en: 'This is a native Android push test sent only to this phone from the Staff test bench.' },
    data: { kind: 'native_android_test' },
  };
}

/** Sends only to Android subscriptions linked to the authenticated staff user.
 * This lets the owner's signed-in phones receive one test without using the
 * owner_email tag or a broad segment. */
export function buildNativeAccountTestMessage(
  body: Record<string, unknown>,
  androidAppId: string,
  authenticatedStaffId: string
) {
  validateNativeApp(body, androidAppId);
  if (!UUID.test(authenticatedStaffId)) throw new Error('A signed-in staff account is required.');
  for (const field of ['subscriptionId', 'externalUserId', 'email', 'tag', 'segment', 'include_aliases', 'include_subscription_ids', 'included_segments', 'filters']) {
    if (field in body) throw new Error('Native account tests may target only the signed-in staff account’s Android devices.');
  }
  return {
    app_id: androidAppId,
    include_aliases: { external_id: [authenticatedStaffId] },
    target_channel: 'push',
    isAndroid: true,
    isIos: false,
    isAnyWeb: false,
    small_icon: 'ic_stat_stakeys',
    android_accent_color: 'FF05C147',
    android_channel_id: 'stakeys_cycles_updates',
    headings: { en: "Stakey's Staff · Android push test" },
    contents: { en: 'This native Android test is for Android devices signed in to your staff account.' },
    data: { kind: 'native_android_account_test' },
  };
}
