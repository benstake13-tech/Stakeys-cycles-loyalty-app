import { describe, it, expect } from 'vitest';
import {
  buildBookingNotification,
  bookingDeepLink,
  bookingSourceLabel,
  detectBookingChannel,
  parseBookingDeepLink,
  parseBookingNotes,
  sosPushCopy,
} from './src/utils/bookingNotifications';
import { ServiceBooking } from './src/types/bikeShop';

const NOTES = [
  'SERVICE TYPE: Drop off at workshop',
  'Reported Symptoms (2):',
  '• [Brakes] Brake pads worn',
  '• [Drivetrain] Chain skipping',
  'Bike: Trek FX 2',
  'Serial: WTU123456',
  'Motor/system: Bosch Performance Line',
].join('\n');

function booking(overrides: Partial<ServiceBooking> = {}): ServiceBooking {
  return {
    id: 'bk-9',
    customerName: 'Sam Rider',
    customerEmail: 'sam@example.com',
    customerPhone: '07388 209102',
    customerId: 'user-1',
    isGuest: false,
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 2',
    serviceId: 'svc-1',
    serviceTitle: 'General Safety Check & Tune-Up',
    servicePrice: 45,
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    status: 'pending',
    notes: NOTES,
    ...overrides,
  } as ServiceBooking;
}

describe('detectBookingChannel', () => {
  it('treats a signed-in account booking as a member (customer app)', () => {
    expect(detectBookingChannel(booking())).toBe('member');
  });

  it('treats a guest booking as the website', () => {
    expect(detectBookingChannel(booking({ customerId: undefined, isGuest: true }))).toBe('guest');
  });

  it('detects the phone-call marker written by the counter panel', () => {
    expect(detectBookingChannel(booking({ notes: 'BOOKING CHANNEL: Phone call' }))).toBe('staff');
  });

  it('honours an explicit staffCreated flag', () => {
    expect(detectBookingChannel(booking(), { staffCreated: true })).toBe('staff');
  });
});

describe('parseBookingNotes', () => {
  it('pulls the PII-free workshop facts out of the notes', () => {
    const parsed = parseBookingNotes(NOTES);
    expect(parsed.dropOff).toBe(true);
    expect(parsed.mobile).toBe(false);
    expect(parsed.symptoms).toEqual(['Brake pads worn', 'Chain skipping']);
    expect(parsed.serial).toBe('WTU123456');
    expect(parsed.motor).toBe('Bosch Performance Line');
  });

  it('reads the SOS fault line and call-out flag', () => {
    const parsed = parseBookingNotes('SERVICE TYPE: Home visit\nFault: Rear wheel buckled');
    expect(parsed.mobile).toBe(true);
    expect(parsed.sosFault).toBe('Rear wheel buckled');
  });
});

describe('buildBookingNotification', () => {
  it('names the source surface and includes booking details', () => {
    const n = buildBookingNotification(booking({ isGuest: true, customerId: undefined }));
    expect(n.channel).toBe('guest');
    expect(n.title).toContain('#bk-9');
    expect(n.title).toContain('Website');
    expect(n.body).toContain('Guest · Website');
    expect(n.body).toContain('General Safety Check & Tune-Up');
    expect(n.body).toContain('Trek FX 2 (Cycle)');
    expect(n.body).toContain('2026-10-10');
    expect(n.body).toContain('Brake pads worn');
    expect(n.body).toContain('Serial: WTU123456');
  });

  it('never leaks the customer name, email or phone', () => {
    const n = buildBookingNotification(booking());
    expect(n.body).not.toContain('Sam Rider');
    expect(n.body).not.toContain('sam@example.com');
    expect(n.body).not.toContain('07388 209102');
    expect(n.title).not.toContain('Sam Rider');
  });

  it('labels an SOS booking and flags the priority', () => {
    const n = buildBookingNotification(
      booking({ isSos: true, notes: `${NOTES}\nFault: Chain snapped` })
    );
    expect(n.title).toContain('SOS call-out');
    expect(n.body).toContain('Priority');
    expect(n.body).toContain('Fault: Chain snapped');
  });

  it('uses the member label for a customer-app booking', () => {
    expect(bookingSourceLabel(buildBookingNotification(booking()).channel)).toContain('Customer App');
  });
});

describe('deep link', () => {
  it('builds a staff+booking URL and round-trips it', () => {
    const url = bookingDeepLink('bk-9', 'https://stakeys-cycle.co.uk');
    expect(url).toContain('staff=1');
    expect(url).toContain('booking=bk-9');
    const target = parseBookingDeepLink(new URL(url).search);
    expect(target).toEqual({ staff: true, bookingId: 'bk-9' });
  });

  it('targets the staff domain by default, not the booking creator origin', () => {
    // A website or customer-app booking must still open the workshop terminal,
    // so the default origin is the staff app (not window.location.origin).
    const url = bookingDeepLink('bk-42');
    expect(new URL(url).origin).toBe('https://www.stakeys-cycles.co.uk');
    expect(new URL(url).searchParams.get('booking')).toBe('bk-42');
  });

  it('returns nulls for an unrelated query string', () => {
    expect(parseBookingDeepLink('?theme=dark')).toEqual({ staff: false, bookingId: null });
  });
});

describe('sosPushCopy', () => {
  it('requested shows the source and the fault', () => {
    const { title, body } = sosPushCopy('requested', booking({ isGuest: true, customerId: undefined, isSos: true, notes: 'Fault: Chain snapped' }));
    expect(title).toContain('SOS request');
    expect(title).toContain('Website');
    expect(body).toContain('Fault: Chain snapped');
    expect(body).not.toContain('Sam Rider');
  });

  it('confirmed carries the price and the set-off instruction', () => {
    const { title, body } = sosPushCopy('confirmed', booking({ isSos: true }), { quotedPrice: 60 });
    expect(title).toContain('SET OFF');
    expect(body).toContain('60.00');
    expect(body).not.toContain('Sam Rider');
  });
});
