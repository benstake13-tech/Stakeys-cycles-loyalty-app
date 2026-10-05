import { describe, it, expect } from 'vitest';
import { selectDueReminderBookings } from './src/utils/notificationService';
import type { ServiceBooking } from './src/types/bikeShop';

/** A booking `days` from now at 09:00, so it sits inside the 24h reminder window. */
function booking(over: Partial<ServiceBooking> & { id: string }): ServiceBooking {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const preferredDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return {
    customerName: 'Chloe Lawrence',
    customerEmail: 'chloe@example.com',
    preferredDate,
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    status: 'pending',
    ...over,
  } as ServiceBooking;
}

describe('selectDueReminderBookings', () => {
  it('selects a due booking with no reminder yet', () => {
    const b = booking({ id: 'bk-1' });
    expect(selectDueReminderBookings([b]).map((x) => x.id)).toEqual(['bk-1']);
  });

  it('skips a booking whose reminder was already persisted as sent', () => {
    const b = booking({ id: 'bk-1', reminder24hSent: true });
    expect(selectDueReminderBookings([b])).toHaveLength(0);
  });

  it('skips ids already dispatched this session even if the flag reads false again', () => {
    // Simulates the bug: a poll reloads reminder24hSent=false after we dispatched.
    const b = booking({ id: 'bk-1', reminder24hSent: false });
    const alreadySent = new Set(['bk-1']);
    expect(selectDueReminderBookings([b], alreadySent)).toHaveLength(0);
  });

  it('ignores completed and cancelled bookings', () => {
    const list = [
      booking({ id: 'bk-1', status: 'completed' }),
      booking({ id: 'bk-2', status: 'cancelled' }),
    ];
    expect(selectDueReminderBookings(list)).toHaveLength(0);
  });

  it('ignores bookings outside the reminder window', () => {
    const far = new Date();
    far.setDate(far.getDate() + 10);
    const b = booking({
      id: 'bk-1',
      preferredDate: `${far.getFullYear()}-${String(far.getMonth() + 1).padStart(2, '0')}-${String(
        far.getDate()
      ).padStart(2, '0')}`,
    });
    expect(selectDueReminderBookings([b])).toHaveLength(0);
  });

  it('returns each due booking once across repeated checks', () => {
    const list = [booking({ id: 'bk-1' }), booking({ id: 'bk-2' })];
    const alreadySent = new Set<string>();
    const first = selectDueReminderBookings(list, alreadySent);
    expect(first.map((x) => x.id)).toEqual(['bk-1', 'bk-2']);
    first.forEach((b) => alreadySent.add(b.id));
    expect(selectDueReminderBookings(list, alreadySent)).toHaveLength(0);
  });
});
