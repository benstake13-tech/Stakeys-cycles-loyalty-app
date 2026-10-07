import { describe, it, expect, vi, beforeEach } from 'vitest';

// sendPushToUser is the OneSignal entry point; capture how SOS calls target it.
const hoisted = vi.hoisted(() => ({
  calls: [] as any[],
}));

vi.mock('./src/utils/pushNotifications', () => ({
  sendPushToUser: vi.fn(async (...args: any[]) => {
    hoisted.calls.push(args);
    return { ok: true, via: 'server' as const };
  }),
}));

import { dispatchSosNotification } from './src/utils/notificationService';
import { ServiceBooking } from './src/types/bikeShop';

const OWNER = 'stakeyscycle95@gmail.com';

const booking = {
  id: 'bk-7',
  customerName: 'Sam Rider',
  customerPhone: '07388 209102',
  vehicleModel: 'Carrera Vengeance',
} as ServiceBooking;

const config = {
  ownerEmail: OWNER,
  ownerPhone: '+44 7388 209102',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

beforeEach(() => {
  hoisted.calls = [];
});

describe('dispatchSosNotification — owner-only pushes', () => {
  it('targets the owner email tag (not a staff segment or customer device)', async () => {
    const log = await dispatchSosNotification(booking, config, 'requested');

    expect(hoisted.calls).toHaveLength(1);
    const [userId, , , , target] = hoisted.calls[0];
    // No external user id — targeted purely by tag.
    expect(userId).toBeUndefined();
    expect(target).toEqual({ tag: { key: 'owner_email', value: OWNER } });
    expect(log.recipientRole).toBe('owner');
    expect(log.category).toBe('sos_emergency');
  });

  it('lets an explicit owner reminder email override the config', async () => {
    await dispatchSosNotification(booking, config, 'approved', {
      ownerReminderEmail: 'owner-phone@stakeyscycles.com',
    });
    const [, , , , target] = hoisted.calls[0];
    expect(target.tag.value).toBe('owner-phone@stakeyscycles.com');
  });

  it('includes the quoted price in the confirmed push', async () => {
    const log = await dispatchSosNotification(booking, config, 'confirmed', { quotedPrice: 60 });
    const [, title, body] = hoisted.calls[0];
    expect(title).toContain('SET OFF');
    expect(body).toContain('60.00');
    expect(log.content).toContain('60.00');
  });

  it('does not push when no owner email is configured', async () => {
    await dispatchSosNotification(booking, { ...config, ownerEmail: '' }, 'requested');
    expect(hoisted.calls).toHaveLength(0);
  });
});
