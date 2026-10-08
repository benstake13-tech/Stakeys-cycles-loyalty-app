import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_EVENT_IDS,
  resolveNotificationPreferences,
  channelsFor,
  isEventMuted,
  setChannel,
  setEventEnabled,
  describeChannels,
  enabledEvents,
} from './src/utils/notificationPreferences';
import { buildWorkshopActivities, relativeTime } from './src/utils/notificationActivity';
import { dispatchWorkshopEvent } from './src/utils/notificationDispatch';

describe('notification preferences matrix', () => {
  it('resolves a full matrix from empty/partial stored data', () => {
    const resolved = resolveNotificationPreferences(null);
    for (const id of NOTIFICATION_EVENT_IDS) {
      expect(resolved[id]).toEqual(DEFAULT_NOTIFICATION_PREFERENCES[id]);
    }
  });

  it('keeps known stored channels and fills missing ones from the default', () => {
    const resolved = resolveNotificationPreferences({
      new_booking: { push: false },
      unknown_event: { visual: true },
    });
    expect(resolved.new_booking.push).toBe(false);
    expect(resolved.new_booking.visual).toBe(DEFAULT_NOTIFICATION_PREFERENCES.new_booking.visual);
    expect((resolved as any).unknown_event).toBeUndefined();
  });

  it('flips one channel immutably', () => {
    const before = resolveNotificationPreferences(null);
    const after = setChannel(before, 'new_member', 'push', true);
    expect(after.new_member.push).toBe(true);
    expect(before.new_member.push).toBe(false);
    expect(after).not.toBe(before);
  });

  it('turns every channel on/off with setEventEnabled', () => {
    const off = setEventEnabled(resolveNotificationPreferences(null), 'new_booking', false);
    expect(isEventMuted(off, 'new_booking')).toBe(true);
    expect(describeChannels(channelsFor(off, 'new_booking'))).toBe('Muted');

    const on = setEventEnabled(off, 'new_booking', true);
    expect(enabledEvents(on)).toContain('new_booking');
  });

  it('describes enabled channels', () => {
    expect(describeChannels({ visual: true, email: true, push: false })).toBe('Visual + Email');
  });
});

describe('workshop activity feed', () => {
  it('turns a booking into a booking-targeted activity', () => {
    const feed = buildWorkshopActivities({
      bookings: [
        {
          id: 'bk-1',
          customerName: 'Ada',
          serviceTitle: 'Full Service',
          vehicleModel: 'Trek FX',
          preferredDate: '2026-10-10',
          status: 'pending',
          createdAt: '2026-10-05T09:00:00Z',
        } as any,
      ],
    });
    const item = feed.find((a) => a.kind === 'new_booking');
    expect(item?.target).toBe('booking');
    expect(item?.refId).toBe('bk-1');
  });

  it('includes prize wins from completed draws and routes them to the member', () => {
    const feed = buildWorkshopActivities({
      draws: [
        {
          id: 'draw-1',
          title: 'October Draw',
          prizeDescription: 'Free Coffee',
          winnerUid: 'member-9',
          winnerName: 'Chloe',
          status: 'completed',
          completedAt: '2026-10-04T10:00:00Z',
        } as any,
      ],
    });
    const item = feed.find((a) => a.kind === 'prize_won');
    expect(item?.target).toBe('member');
    expect(item?.refId).toBe('member-9');
    expect(item?.detail).toContain('Free Coffee');
  });

  it('lists garage bikes and vouchers for a member', () => {
    const feed = buildWorkshopActivities({
      users: [
        {
          uid: 'm1',
          role: 'customer',
          displayName: 'Sam',
          membershipNumber: 'STK-1',
          createdAt: '2026-10-01T00:00:00Z',
          bikes: [{ id: 'b1', brand: 'Trek', model: 'Marlin', addedAt: '2026-10-02T00:00:00Z' }],
          serviceVouchers: [
            { id: 'v1', code: 'V1', title: '£40 credit', value: 40, status: 'available', claimedAt: '2026-10-03T00:00:00Z' },
          ],
        } as any,
      ],
    });
    expect(feed.some((a) => a.kind === 'bike_added' && a.refId === 'm1')).toBe(true);
    expect(feed.some((a) => a.kind === 'voucher_earned' && a.refId === 'm1')).toBe(true);
  });

  it('formats relative ages', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(relativeTime(now - 30 * 1000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe('5m');
    expect(relativeTime(now - 3 * 3600 * 1000, now)).toBe('3h');
    expect(relativeTime(0, now)).toBe('unknown');
  });
});

describe('notification dispatcher honours the matrix', () => {
  const payload = {
    title: 'New booking',
    body: 'Ada booked a service',
    ownerEmail: 'workshop@x.co',
    customerEmail: 'ada@x.co',
  };

  it('sends nothing when the event is muted', async () => {
    const sendEmail = vi.fn(async () => true);
    const sendPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const result = await dispatchWorkshopEvent(
      'new_booking',
      payload,
      setEventEnabled(resolveNotificationPreferences(null), 'new_booking', false),
      { sendEmail, sendPush }
    );
    expect(result.email).toBe('off');
    expect(result.push).toBe('off');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('fires only the channels that are enabled', async () => {
    const sendEmail = vi.fn(async () => true);
    const sendPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const recordVisual = vi.fn();
    const prefs = setChannel(
      setEventEnabled(resolveNotificationPreferences(null), 'new_booking', false),
      'new_booking',
      'email',
      true
    );
    const result = await dispatchWorkshopEvent('new_booking', payload, prefs, {
      sendEmail,
      sendPush,
      recordVisual,
    });
    expect(result.visual).toBe('off');
    expect(result.email).toBe('sent');
    expect(result.push).toBe('off');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('reports a channel failure without blocking the others', async () => {
    const sendEmail = vi.fn(async () => false);
    const sendPush = vi.fn(async () => ({ ok: true, via: 'server' as const }));
    const prefs = resolveNotificationPreferences(null); // new_booking: all on
    const result = await dispatchWorkshopEvent('new_booking', payload, prefs, { sendEmail, sendPush });
    expect(result.email).toBe('failed');
    expect(result.push).toBe('sent');
  });
});
