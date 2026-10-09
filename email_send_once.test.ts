import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  invokes: [] as Array<{ name: string; body: any }>,
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
  sendPushToUser: vi.fn(async () => ({ ok: true, via: 'server' })),
}));

import { claimEmailSend, resetEmailSendGuard } from './src/utils/sendOnce';
import { dispatchTestEmail } from './src/utils/notificationService';
import type { OwnerNotificationConfig } from './src/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.co.uk',
  ownerPhone: '+44 7388 209102',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

beforeEach(() => {
  hoisted.invokes = [];
  resetEmailSendGuard();
});

describe('send-once guard', () => {
  it('claims a key exactly once and resets cleanly', () => {
    expect(claimEmailSend('a')).toBe(true);
    expect(claimEmailSend('a')).toBe(false);
    expect(claimEmailSend('b')).toBe(true);
    resetEmailSendGuard();
    expect(claimEmailSend('a')).toBe(true);
  });
});

describe('dispatchTestEmail de-duplication', () => {
  it('sends one test email however many times the button is pressed', async () => {
    const first = await dispatchTestEmail(config);
    const second = await dispatchTestEmail(config);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.message).toMatch(/already sent/i);
    expect(hoisted.invokes).toHaveLength(1);
  });

  it('allows a fresh send once the guard is reset', async () => {
    await dispatchTestEmail(config);
    resetEmailSendGuard();
    await dispatchTestEmail(config);
    expect(hoisted.invokes).toHaveLength(2);
  });

  it('refuses to send without a recipient', async () => {
    const res = await dispatchTestEmail({ ...config, ownerEmail: '' });
    expect(res.success).toBe(false);
    expect(hoisted.invokes).toHaveLength(0);
  });
});
