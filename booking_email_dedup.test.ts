import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  invokes: [] as Array<{ name: string; body: any }>,
  ledger: new Set<string>(),
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

vi.mock('./src/utils/bookingEmailLedger', () => ({
  shouldSendBookingEmail: (bookingId: string, category: string, audience = 'owner') => {
    const key = `${bookingId}:${category}:${audience}`;
    if (hoisted.ledger.has(key)) return false;
    hoisted.ledger.add(key);
    return true;
  },
  bookingEmailKey: (bookingId: string, category: string, audience = 'owner') =>
    `${bookingId}:${category}:${audience}`,
  markBookingEmailSent: (bookingId: string, category: string, audience = 'owner') =>
    hoisted.ledger.add(`${bookingId}:${category}:${audience}`),
  resetBookingEmailLedger: () => hoisted.ledger.clear(),
  rehydrateBookingEmailLedger: () => {},
}));

vi.mock('./src/utils/pushNotifications', () => ({
  sendPushToUser: vi.fn(async () => ({ ok: true, via: 'server' })),
}));

import { sendPushToUser } from './src/utils/pushNotifications';

import {
  dispatchBookingNotifications,
  dispatchBookingApprovalNotification,
  dispatchBookingDeclinedNotification,
  dispatch24hReminderNotification,
} from './src/utils/notificationService';
import type { ServiceBooking, OwnerNotificationConfig } from './src/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.co.uk',
  ownerPhone: '+44 7388 209102',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

const booking: ServiceBooking = {
  id: 'bk-4242',
  customerId: 'cust-4242',
  customerName: 'Sam Carter',
  customerEmail: 'sam@example.com',
  customerPhone: '+44 7911 000000',
  vehicleCategory: 'cycle',
  vehicleModel: 'Trek FX 1',
  serviceId: 'cycle-tune',
  serviceTitle: 'General Safety Check & Tune-Up',
  servicePrice: 0,
  preferredDate: '2026-10-10',
  preferredTimeSlot: 'Morning (09:00 - 12:00)',
  status: 'pending',
  approvalStatus: 'pending_approval',
  createdAt: new Date().toISOString(),
  notifications: [],
};

beforeEach(() => {
  hoisted.invokes = [];
  hoisted.ledger.clear();
});

describe('booking email de-duplication', () => {
  it('sends exactly one workshop alert and one customer confirmation for a booking', async () => {
    await dispatchBookingNotifications(booking, config);

    expect(hoisted.invokes).toHaveLength(2);
    expect(hoisted.invokes.map((i) => i.body.to).sort()).toEqual(['sam@example.com', 'workshop@stakeyscycles.co.uk']);
  });

  it('never re-sends the confirmation when the same booking is dispatched again', async () => {
    await dispatchBookingNotifications(booking, config);
    await dispatchBookingNotifications(booking, config);
    await dispatchBookingNotifications(booking, config);

    // Still only the two original sends — the repeats are suppressed.
    expect(hoisted.invokes).toHaveLength(2);
  });

  it('still sends the separate lifecycle emails (approval, decline) once each', async () => {
    await dispatchBookingNotifications(booking, config);
    await dispatchBookingApprovalNotification({ ...booking, approvalStatus: 'approved' }, 'Bring the key', config);
    await dispatchBookingApprovalNotification({ ...booking, approvalStatus: 'approved' }, 'Bring the key', config);
    await dispatchBookingDeclinedNotification(booking, 'Bench full', config);
    await dispatch24hReminderNotification(booking, config);

    const subjects = hoisted.invokes.map((i) => i.body.subject as string);
    const count = (needle: string) => subjects.filter((s) => s.includes(needle)).length;

    expect(count('Repair Request Received')).toBe(1); // customer confirmation
    expect(count("New Booking #bk-4242")).toBe(1); // workshop alert
    expect(count('APPROVED')).toBe(1); // approval (duplicate suppressed)
    expect(count('could not be approved')).toBe(1); // decline
    // Reminders default to push, so no reminder email is sent.
    expect(count('Slot Reminder')).toBe(0);
  });

  it('sends reminder emails when email mode is explicitly requested', async () => {
    await dispatch24hReminderNotification(booking, config, { pushOnly: false });

    const subjects = hoisted.invokes.map((i) => i.body.subject as string);
    expect(subjects.filter((s) => s.includes('Slot Reminder')).length).toBe(2); // customer + workshop
  });

  it('delivers the full multi-line job detail to the workshop email', async () => {
    const detailed: ServiceBooking = {
      ...booking,
      notes:
        'Bike: Trek FX 1\nSerial: WTU123456\n\nReported Symptoms (1):\n• [Brakes] Squeaky / rubbing\n\nAccess / drop-off notes: Side gate, code 4455\n\nPreferred contact: Email',
    };
    await dispatchBookingNotifications(detailed, config);

    const ownerEmail = hoisted.invokes.find((i) => i.body.to === 'workshop@stakeyscycles.co.uk');
    expect(ownerEmail).toBeTruthy();
    expect(ownerEmail!.body.html).toContain('Full Booking Detail');
    expect(ownerEmail!.body.html).toContain('Access / drop-off notes: Side gate, code 4455');
    expect(ownerEmail!.body.html).toContain('Preferred contact: Email');
  });

  it('escapes HTML in customer notes so the workshop email cannot be injected', async () => {
    await dispatchBookingNotifications(
      { ...booking, notes: 'Suspicious <script>alert(1)</script> text' },
      config
    );
    const ownerEmail = hoisted.invokes.find((i) => i.body.to === 'workshop@stakeyscycles.co.uk');
    expect(ownerEmail!.body.html).not.toContain('<script>alert(1)</script>');
    expect(ownerEmail!.body.html).toContain('&lt;script&gt;');
  });

  it('still confirms the customer when workshop alerts are switched off', async () => {
    // The workshop muting its own inbox must never rob the customer of a receipt.
    const mutedConfig: OwnerNotificationConfig = { ...config, emailAlertsEnabled: false };
    const { failures } = await dispatchBookingNotifications(booking, mutedConfig);

    const recipients = hoisted.invokes.map((i) => i.body.to);
    expect(recipients).toContain('sam@example.com');
    expect(recipients).not.toContain('workshop@stakeyscycles.co.uk');
    expect((failures || []).some((f) => f.includes('Workshop booking alert not sent'))).toBe(true);
  });

  it('still confirms the customer when no workshop recipient is configured', async () => {
    const noOwnerConfig: OwnerNotificationConfig = { ...config, ownerEmail: '' };
    await dispatchBookingNotifications(booking, noOwnerConfig);

    const recipients = hoisted.invokes.map((i) => i.body.to);
    expect(recipients).toEqual(['sam@example.com']);
  });

  it('reports a failure when the booking has no customer email to confirm', async () => {
    const { failures } = await dispatchBookingNotifications({ ...booking, customerEmail: '' }, config);

    expect((failures || []).some((f) => f.includes('no customer email address'))).toBe(true);
    // The workshop alert is unaffected and still goes out.
    expect(hoisted.invokes.map((i) => i.body.to)).toContain('workshop@stakeyscycles.co.uk');
  });

  it('dispatches the 24h reminder as a push to the customer and owner-email devices', async () => {
    await dispatch24hReminderNotification(booking, config, {
      ownerReminderEmail: 'stakeyscycle95@gmail.com',
    });

    const calls = (sendPushToUser as any).mock.calls;
    // Customer push (targeted by profile) …
    expect(calls.some((c: any[]) => c[0] === booking.customerId)).toBe(true);
    // … and a workshop push to every device tagged with the owner email.
    expect(
      calls.some(
        (c: any[]) => c[4]?.tag?.key === 'owner_email' && c[4]?.tag?.value === 'stakeyscycle95@gmail.com'
      )
    ).toBe(true);
  });
});
