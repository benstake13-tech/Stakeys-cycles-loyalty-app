import { describe, expect, it } from 'vitest';
import { buildStaffEventMessage, providerAccepted } from './supabase/functions/staff-event-push/message';

const event = { id: 'event-uuid', event_type: 'marketplace_message', source_id: 'row-id', section: 'marketplace', title: 'New marketplace message', recipient_ids: null };
describe('durable native staff events', () => {
  it('uses server-authorized identities, native Android only and a stable retry key', () => {
    const message = buildStaffEventMessage(event, ['admin', 'staff'], 'native-app')!;
    expect(message.include_aliases.external_id).toEqual(['admin', 'staff']);
    expect(message.isAndroid).toBe(true);
    expect(message.isAnyWeb).toBe(false);
    expect(message.existing_android_channel_id).toBe('stakeys_cycles_updates');
    expect(message.idempotency_key).toBe(event.id);
    expect(message.contents.en).not.toContain('body');
  });
  it('does not broadcast private conversation alerts or trust stale staff roles', () => {
    expect(buildStaffEventMessage({ ...event, recipient_ids: ['customer'] }, ['staff'], 'app')).toBe(null);
    expect(buildStaffEventMessage({ ...event, recipient_ids: ['staff', 'customer'] }, ['staff'], 'app')!.include_aliases.external_id).toEqual(['staff']);
  });
  it('deep-links bookings and sections into the staff app', () => {
    const url = new URL(buildStaffEventMessage({ ...event, section: 'bookings' }, ['staff'], 'app')!.url);
    expect(url.searchParams.get('booking')).toBe('row-id');
    expect(url.searchParams.get('staff')).toBe('1');
  });
  it('retries empty 200 responses and treats partial acceptance as accepted', () => {
    expect(providerAccepted({}, true)).toBe(false);
    expect(providerAccepted({ id: '', recipients: 0 }, true)).toBe(false);
    expect(providerAccepted({ id: 'accepted' }, true)).toBe(true);
    expect(providerAccepted({ id: 'accepted' }, false)).toBe(false);
  });
});
