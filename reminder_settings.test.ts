import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  invokes: [] as Array<{ name: string; body: any }>,
  pushes: [] as any[],
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    functions: {
      invoke: async (name: string, opts: { body: any }) => {
        hoisted.invokes.push({ name, body: opts.body });
        return { data: { success: true }, error: null };
      },
    },
  }),
}));

vi.mock('./src/utils/pushNotifications', () => ({
  sendPushToUser: vi.fn(async (...args: any[]) => {
    hoisted.pushes.push(args);
    return { ok: true, via: 'server' };
  }),
}));

import {
  resolveReminderSettings,
  isWithinQuietHours,
  isBookingDueForReminder,
  dispatch24hReminderNotification,
  getHoursUntilBooking,
} from './src/utils/notificationService';
import { resetBookingEmailLedger } from './src/utils/bookingEmailLedger';
import { DEFAULT_REMINDER_SETTINGS } from './src/types/bikeShop';
import type { ServiceBooking, OwnerNotificationConfig, ReminderSettings } from './src/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.co.uk',
  ownerPhone: '+44 7388 209102',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeBooking(overrides: Partial<ServiceBooking> = {}): ServiceBooking {
  return {
    id: `bk-${Math.random().toString(36).slice(2)}`,
    customerId: 'cust-1',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    customerPhone: '+44 7911 000000',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 1',
    serviceId: 'cycle-tune',
    serviceTitle: 'General Safety Check & Tune-Up',
    servicePrice: 0,
    preferredDate: daysFromNow(3),
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    status: 'pending',
    approvalStatus: 'pending_approval',
    createdAt: new Date().toISOString(),
    notifications: [],
    ...overrides,
  };
}

beforeEach(() => {
  hoisted.invokes = [];
  hoisted.pushes = [];
  resetBookingEmailLedger();
});

describe('resolveReminderSettings', () => {
  it('falls back to the documented defaults', () => {
    expect(resolveReminderSettings()).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(resolveReminderSettings({}).leadHours).toBe(24);
    expect(resolveReminderSettings({}).channel).toBe('push');
  });

  it('clamps out-of-range numbers and ignores invalid enums', () => {
    const r = resolveReminderSettings({
      leadHours: 9999,
      repeatHours: -5,
      quietStartHour: 42,
      quietEndHour: -1,
      channel: 'carrier-pigeon' as any,
      recipients: 'nobody' as any,
    });
    expect(r.leadHours).toBe(168);
    expect(r.repeatHours).toBe(0);
    expect(r.quietStartHour).toBe(23);
    expect(r.quietEndHour).toBe(0);
    expect(r.channel).toBe('push');
    expect(r.recipients).toBe('both');
  });
});

describe('isWithinQuietHours', () => {
  const quiet: ReminderSettings = { ...DEFAULT_REMINDER_SETTINGS, quietStartHour: 21, quietEndHour: 8 };

  it('is true inside a window that wraps midnight', () => {
    expect(isWithinQuietHours(quiet, new Date(2026, 0, 1, 23, 0))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date(2026, 0, 1, 3, 0))).toBe(true);
  });

  it('is false outside the window', () => {
    expect(isWithinQuietHours(quiet, new Date(2026, 0, 1, 12, 0))).toBe(false);
    expect(isWithinQuietHours(quiet, new Date(2026, 0, 1, 8, 0))).toBe(false);
    expect(isWithinQuietHours(quiet, new Date(2026, 0, 1, 20, 59))).toBe(false);
  });

  it('supports a same-day window and can be switched off entirely', () => {
    const daytime: ReminderSettings = { ...quiet, quietStartHour: 9, quietEndHour: 17 };
    expect(isWithinQuietHours(daytime, new Date(2026, 0, 1, 12, 0))).toBe(true);
    expect(isWithinQuietHours(daytime, new Date(2026, 0, 1, 18, 0))).toBe(false);
    expect(isWithinQuietHours({ ...quiet, quietHoursEnabled: false }, new Date(2026, 0, 1, 23, 0))).toBe(false);
  });
});

describe('isBookingDueForReminder', () => {
  const quietOff: Partial<ReminderSettings> = { quietHoursEnabled: false };

  it('is not due before the lead window opens', () => {
    const booking = makeBooking();
    const hours = getHoursUntilBooking(booking);
    expect(isBookingDueForReminder(booking, { ...quietOff, leadHours: Math.max(1, Math.floor(hours) - 1) })).toBe(
      false
    );
  });

  it('is due once inside the lead window', () => {
    const booking = makeBooking();
    const hours = getHoursUntilBooking(booking);
    expect(isBookingDueForReminder(booking, { ...quietOff, leadHours: Math.min(168, Math.ceil(hours) + 1) })).toBe(
      true
    );
  });

  it('never reminds a completed or cancelled booking', () => {
    expect(isBookingDueForReminder(makeBooking({ status: 'completed' }), quietOff)).toBe(false);
    expect(isBookingDueForReminder(makeBooking({ status: 'cancelled' }), quietOff)).toBe(false);
  });

  it('sends once when repeatHours is 0', () => {
    const booking = makeBooking({ reminderCount: 1, reminder24hSent: true, reminderLastSentAt: new Date().toISOString() });
    expect(isBookingDueForReminder(booking, { ...quietOff, leadHours: 168, repeatHours: 0 })).toBe(false);
  });

  it('repeats only after the repeat interval has elapsed', () => {
    const last = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    const booking = makeBooking({ reminderCount: 1, reminder24hSent: true, reminderLastSentAt: last });
    expect(isBookingDueForReminder(booking, { ...quietOff, leadHours: 168, repeatHours: 6 })).toBe(true);
    expect(isBookingDueForReminder(booking, { ...quietOff, leadHours: 168, repeatHours: 12 })).toBe(false);
  });

  it('suppresses sends during quiet hours', () => {
    const booking = makeBooking();
    const settings: Partial<ReminderSettings> = {
      leadHours: 168,
      quietHoursEnabled: true,
      quietStartHour: 21,
      quietEndHour: 8,
    };
    expect(isBookingDueForReminder(booking, settings, new Date(2026, 0, 1, 23, 0))).toBe(false);
    expect(isBookingDueForReminder(booking, settings, new Date(2026, 0, 1, 12, 0))).toBe(true);
  });
});

describe('dispatch24hReminderNotification honours the channel + recipients', () => {
  it('sends email only to both parties when channel is email', async () => {
    const booking = makeBooking();
    await dispatch24hReminderNotification(booking, config, {
      settings: { channel: 'email', recipients: 'both', ownerEmail: 'stakeyscycle95@gmail.com' },
    });
    expect(hoisted.pushes).toHaveLength(0);
    expect(hoisted.invokes.map((i) => i.body.to).sort()).toEqual(['sam@example.com', 'stakeyscycle95@gmail.com']);
  });

  it('sends email only to the customer when recipients is customer', async () => {
    const booking = makeBooking();
    await dispatch24hReminderNotification(booking, config, {
      settings: { channel: 'email', recipients: 'customer' },
    });
    expect(hoisted.invokes).toHaveLength(1);
    expect(hoisted.invokes[0].body.to).toBe('sam@example.com');
  });

  it('sends push only (no email) when channel is push', async () => {
    const booking = makeBooking();
    await dispatch24hReminderNotification(booking, config, {
      settings: { channel: 'push', recipients: 'both', ownerEmail: 'stakeyscycle95@gmail.com' },
    });
    expect(hoisted.invokes).toHaveLength(0);
    // Customer profile push + owner-email tagged push.
    expect(hoisted.pushes.some((c) => c[0] === booking.customerId)).toBe(true);
    expect(hoisted.pushes.some((c) => c[4]?.tag?.value === 'stakeyscycle95@gmail.com')).toBe(true);
  });

  it('sends both push and email when channel is both', async () => {
    const booking = makeBooking();
    await dispatch24hReminderNotification(booking, config, {
      settings: { channel: 'both', recipients: 'both', ownerEmail: 'stakeyscycle95@gmail.com' },
    });
    expect(hoisted.pushes.length).toBeGreaterThan(0);
    expect(hoisted.invokes).toHaveLength(2);
  });

  it('records the reminder number on the booking', async () => {
    const booking = makeBooking({ reminderCount: 2 });
    const { updatedBooking } = await dispatch24hReminderNotification(booking, config, {
      settings: { channel: 'push', recipients: 'customer' },
    });
    expect(updatedBooking.reminderCount).toBe(3);
    expect(updatedBooking.reminderLastSentAt).toBeTruthy();
  });
});
