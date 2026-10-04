import { describe, it, expect } from 'vitest';
import type { ServiceBooking } from './src/types/bikeShop';
import {
  classifyBookingChannel,
  isPhoneCall,
  didConvert,
  weeklyServiceRequests,
  callLog,
  summarizePerformance,
} from './src/utils/performanceTracker';

const NOW = new Date('2026-10-03T12:00:00Z');

function booking(partial: Partial<ServiceBooking>): ServiceBooking {
  return {
    id: partial.id || 'bk-1',
    customerName: 'Test Rider',
    customerEmail: 'rider@example.com',
    customerPhone: '07000000000',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek Marlin',
    serviceId: 'svc-1',
    serviceTitle: 'Full Service',
    servicePrice: 0,
    preferredDate: '2026-10-03',
    preferredTimeSlot: 'AM',
    status: 'pending',
    createdAt: '2026-10-03T09:00:00Z',
    notifications: [],
    ...partial,
  } as ServiceBooking;
}

describe('classifyBookingChannel', () => {
  it('treats the phone marker as a phone call', () => {
    expect(
      classifyBookingChannel(booking({ notes: 'BOOKING CHANNEL: Phone call (staff-entered)' }))
    ).toBe('phone');
  });

  it('defaults everything else to online', () => {
    expect(classifyBookingChannel(booking({ notes: 'Booked on the website' }))).toBe('online');
    expect(classifyBookingChannel(booking({ notes: undefined }))).toBe('online');
  });
});

describe('isPhoneCall / didConvert', () => {
  it('flags phone bookings and conversion once approved or completed', () => {
    const call = booking({ notes: 'BOOKING CHANNEL: Phone call (staff-entered)' });
    expect(isPhoneCall(call)).toBe(true);
    expect(didConvert(call)).toBe(false);
    expect(didConvert({ ...call, approvalStatus: 'approved' })).toBe(true);
    expect(didConvert({ ...call, status: 'completed' })).toBe(true);
  });
});

describe('weeklyServiceRequests', () => {
  it('returns exactly 7 trailing days, oldest first, split by channel', () => {
    const bookings = [
      booking({ id: 'a', createdAt: '2026-10-03T09:00:00Z' }),
      booking({ id: 'b', createdAt: '2026-10-03T10:00:00Z', notes: 'BOOKING CHANNEL: Phone call' }),
      booking({ id: 'c', createdAt: '2026-09-29T10:00:00Z' }),
      // outside the window — must be ignored
      booking({ id: 'd', createdAt: '2026-09-01T10:00:00Z' }),
    ];
    const week = weeklyServiceRequests(bookings, NOW);
    expect(week).toHaveLength(7);
    expect(week[6].date).toBe('2026-10-03');
    expect(week[6].online).toBe(1);
    expect(week[6].phone).toBe(1);
    expect(week[6].total).toBe(2);
    const total = week.reduce((n, d) => n + d.total, 0);
    expect(total).toBe(3); // d excluded
  });
});

describe('callLog', () => {
  it('lists phone bookings newest first with conversion flags', () => {
    const bookings = [
      booking({ id: 'old', createdAt: '2026-09-28T10:00:00Z', notes: 'BOOKING CHANNEL: Phone call' }),
      booking({ id: 'new', createdAt: '2026-10-02T10:00:00Z', notes: 'BOOKING CHANNEL: Phone call', status: 'completed' }),
      booking({ id: 'web', createdAt: '2026-10-02T11:00:00Z' }),
    ];
    const calls = callLog(bookings);
    expect(calls.map((c) => c.id)).toEqual(['new', 'old']);
    expect(calls[0].converted).toBe(true);
    expect(calls[1].converted).toBe(false);
  });
});

describe('summarizePerformance', () => {
  it('computes weekly totals, deltas and call conversion', () => {
    const bookings = [
      // this week
      booking({ id: '1', createdAt: '2026-10-03T09:00:00Z' }),
      booking({ id: '2', createdAt: '2026-10-02T09:00:00Z', notes: 'BOOKING CHANNEL: Phone call', approvalStatus: 'approved' }),
      booking({ id: '3', createdAt: '2026-10-01T09:00:00Z', notes: 'BOOKING CHANNEL: Phone call' }),
      // prior week (2026-09-25)
      booking({ id: '4', createdAt: '2026-09-25T09:00:00Z' }),
      booking({ id: '5', createdAt: '2026-09-24T09:00:00Z' }),
      booking({ id: '6', createdAt: '2026-09-23T09:00:00Z' }),
      booking({ id: '7', createdAt: '2026-09-22T09:00:00Z' }),
    ];
    const s = summarizePerformance(bookings, NOW);
    expect(s.requests7d).toBe(3);
    expect(s.online7d).toBe(1);
    expect(s.phone7d).toBe(2);
    expect(s.requestsPrior7d).toBe(4);
    expect(s.requestsDelta).toBe(-25); // 3 vs 4
    expect(s.callsLogged).toBe(2);
    expect(s.callConversionPct).toBe(50); // 1 of 2 converted
  });

  it('reports a 100% delta when the previous week was empty', () => {
    const s = summarizePerformance([booking({ id: 'x', createdAt: '2026-10-03T09:00:00Z' })], NOW);
    expect(s.requestsDelta).toBe(100);
  });
});
