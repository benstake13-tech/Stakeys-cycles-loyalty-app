import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records every Edge Function invocation so we can assert exactly what the
// client sends when a booking is created.
const hoisted = vi.hoisted(() => ({
  invokes: [] as { name: string; body: any }[],
  fail: false,
}));

vi.mock('./src/lib/supabase', () => ({
  getSupabaseClient: () => ({
    functions: {
      invoke: (name: string, opts: any) => {
        hoisted.invokes.push({ name, body: opts?.body });
        return Promise.resolve(
          hoisted.fail ? { data: null, error: { message: 'provider down' } } : { data: { success: true }, error: null }
        );
      },
    },
  }),
}));

import { dispatchBookingNotifications } from './src/utils/notificationService';
import type { ServiceBooking, OwnerNotificationConfig } from './src/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.com',
  ownerPhone: '+44 7700 900821',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

const booking: ServiceBooking = {
  id: 'bk-9001',
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
  hoisted.fail = false;
});

describe('dispatchBookingNotifications — workshop alert is server-side', () => {
  it('emails only the customer and never the workshop from the browser', async () => {
    const result = await dispatchBookingNotifications(booking, config);

    expect(hoisted.invokes).toHaveLength(1);
    expect(hoisted.invokes[0].name).toBe('send-email');
    expect(hoisted.invokes[0].body.to).toBe('sam@example.com');
    // The workshop alert is delivered by the service_bookings DB webhook, so
    // sending it here too would double-alert the workshop.
    expect(hoisted.invokes.some((i) => i.body.to === config.ownerEmail)).toBe(false);
    expect(result.failures).toEqual([]);
  });

  it('surfaces a customer-confirmation failure without claiming success', async () => {
    hoisted.fail = true;

    const result = await dispatchBookingNotifications(booking, config);

    expect(result.failures && result.failures.length).toBeGreaterThan(0);
    expect(result.failures?.join(' ')).toContain('provider down');
  });
});
