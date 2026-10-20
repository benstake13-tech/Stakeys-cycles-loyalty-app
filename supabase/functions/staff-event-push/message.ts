export interface StaffPushEvent {
  id: string;
  event_type: string;
  source_id: string;
  section: string;
  title: string;
  recipient_ids: string[] | null;
}

/** Database roles, never client-editable OneSignal tags, determine recipients. */
export function buildStaffEventMessage(event: StaffPushEvent, staffIds: string[], appId: string) {
  const allowed = new Set(staffIds);
  const recipients = [...new Set(event.recipient_ids ?? staffIds)].filter(id => allowed.has(id));
  if (!recipients.length) return null;
  const url = new URL('https://www.stakeys-cycles.co.uk');
  url.searchParams.set('staff', '1');
  url.searchParams.set('section', event.section);
  if (event.section === 'bookings') url.searchParams.set('booking', event.source_id);
  return {
    app_id: appId,
    include_aliases: { external_id: recipients },
    target_channel: 'push',
    isAndroid: true,
    isIos: false,
    isAnyWeb: false,
    small_icon: 'ic_stat_stakeys',
    android_accent_color: 'FF05C147',
    existing_android_channel_id: 'stakeys_cycles_updates',
    priority: 10,
    headings: { en: event.title },
    contents: { en: "Open Stakey's Staff to review this update." },
    url: url.toString(),
    data: { kind: event.event_type, eventId: event.id, section: event.section, sourceId: event.source_id },
    // A retry after a lost HTTP response must not create a second push.
    idempotency_key: event.id,
  };
}

export function providerAccepted(result: { id?: unknown; recipients?: unknown }, httpOk: boolean) {
  // A message ID means accepted, including partial delivery warnings. An empty
  // 200 with no subscribed recipients must stay retryable in the queue.
  return httpOk && typeof result.id === 'string' && result.id.length > 0 && result.recipients !== 0;
}
