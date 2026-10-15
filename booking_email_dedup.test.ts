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
  it('leaves booking emails to the database webhook and returns honest pending previews', async () => {
    const result = await dispatchBookingNotifications(booking, config);

    expect(hoisted.invokes).toHaveLength(0);
    expect(result.emailLog.status).toBe('pending');
    expect(result.customerEmailLog.status).toBe('pending');
    expect(result.emailLog.recipient).toBe(config.ownerEmail);
    expect(result.customerEmailLog.recipient).toBe(booking.customerEmail);
  });

  it('still sends separate lifecycle emails (approval, decline) once each', async () => {
    await dispatchBookingNotifications(booking, config);
    await dispatchBookingApprovalNotification({ ...booking, approvalStatus: 'approved' }, 'Bring the key', config);
    await dispatchBookingApprovalNotification({ ...booking, approvalStatus: 'approved' }, 'Bring the key', config);
    await dispatchBookingDeclinedNotification(booking, 'Bench full', config);
    await dispatch24hReminderNotification(booking, config);

    const subjects = hoisted.invokes.map((i) => i.body.subject as string);
    const count = (needle: string) => subjects.filter((s) => s.includes(needle)).length;

    expect(count('Repair Request Received')).toBe(0); // initial booking email is database-triggered
    expect(count("New Booking #bk-4242")).toBe(0); // initial workshop alert is database-triggered
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
    const result = await dispatchBookingNotifications(detailed, config);

    expect(result.emailLog.content).toContain('Full Booking Detail');
    expect(result.emailLog.content).toContain('Access / drop-off notes: Side gate, code 4455');
    expect(result.emailLog.content).toContain('Preferred contact: Email');
  });

  it('escapes HTML in customer notes so the workshop email cannot be injected', async () => {
    const result = await dispatchBookingNotifications(
      { ...booking, notes: 'Suspicious <script>alert(1)</script> text' },
      config
    );
    expect(result.emailLog.content).not.toContain('<script>alert(1)</script>');
    expect(result.emailLog.content).toContain('&lt;script&gt;');
  });

  it('does not send a second copy when workshop alerts are switched off', async () => {
    const mutedConfig: OwnerNotificationConfig = { ...config, emailAlertsEnabled: false };
    const { failures } = await dispatchBookingNotifications(booking, mutedConfig);

    expect(hoisted.invokes).toHaveLength(0);
    expect(failures).toEqual([]);
  });

  it('does not send a second customer copy when no workshop recipient is configured', async () => {
    const noOwnerConfig: OwnerNotificationConfig = { ...config, ownerEmail: '' };
    await dispatchBookingNotifications(booking, noOwnerConfig);

    expect(hoisted.invokes).toHaveLength(0);
  });

  it('reports a missing customer address for the database confirmation', async () => {
    const { failures } = await dispatchBookingNotifications({ ...booking, customerEmail: '' }, config);

    expect((failures || []).some((f) => f.includes('no customer email address'))).toBe(true);
    expect(hoisted.invokes).toHaveLength(0);
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
