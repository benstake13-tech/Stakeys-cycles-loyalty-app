import { describe, it, expect } from 'vitest';
import { buildBookingApprovalSms, normalizePhoneForSms, createBookingApprovalSmsUrl } from './src/shared/utils/notificationService';
import { ServiceBooking, OwnerNotificationConfig } from './src/shared/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.com',
  ownerPhone: '+44 7700 900821',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

const baseBooking = (over: Partial<ServiceBooking> = {}): ServiceBooking =>
  ({
    id: 'bk-5436',
    customerName: 'Chloe Lawrence',
    customerEmail: 'chloe@example.com',
    customerPhone: '+44 7911 123456',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 1 (Blue)',
    serviceId: 'cycle-tune',
    serviceTitle: 'General Safety Check & Tune-Up',
    servicePrice: 0,
    preferredDate: '2026-10-07',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    status: 'pending',
    notifications: [],
    createdAt: new Date().toISOString(),
    ...over,
  }) as ServiceBooking;

describe('buildBookingApprovalSms', () => {
  it('is professional and does not use the raw "!"-exclamation draft', () => {
    const sms = buildBookingApprovalSms(baseBooking(), config);
    expect(sms).not.toContain("See you at Stakey's!");
    expect(sms).toContain("STAKEY'S CYCLES & SCOOTER");
    expect(sms).toContain('Booking Confirmed — Ref #bk-5436');
    expect(sms).toContain('Hi Chloe');
  });

  it('lists every tickbox the customer selected', () => {
    const sms = buildBookingApprovalSms(
      baseBooking({ selectedIssues: ['brakes-squeaky', 'gears-slipping'] }),
      config
    );
    expect(sms).toContain('You asked us to look at:');
    expect(sms).toContain('• Squeaky / noisy brakes');
    expect(sms).toContain('• Gears slipping or jumping teeth while pedaling');
  });

  it('falls back to the service title when no issues were selected (e.g. a package)', () => {
    const sms = buildBookingApprovalSms(
      baseBooking({ serviceTitle: 'Winterization Check (Seasonal Tune-Up)', selectedIssues: [] }),
      config
    );
    expect(sms).toContain('• Winterization Check (Seasonal Tune-Up)');
  });

  it('formats the date and time slot in a human, professional way', () => {
    const sms = buildBookingApprovalSms(baseBooking(), config);
    expect(sms).toContain('Drop-off: Wed, 7 Oct 2026, 09:00–12:00');
  });

  it('shows the estimate when a quote is present', () => {
    const sms = buildBookingApprovalSms(baseBooking({ quotedPrice: 60 }), config);
    expect(sms).toContain('Estimate: £60.00 (estimated)');
  });

  it('shows a clear fallback when no estimate is present', () => {
    const sms = buildBookingApprovalSms(baseBooking({ quotedPrice: undefined }), config);
    expect(sms).toContain('Estimate: To be confirmed on inspection');
  });

  it('includes an optional workshop note when supplied', () => {
    const sms = buildBookingApprovalSms(baseBooking(), config, 'Please bring the battery key.');
    expect(sms).toContain('Note from the workshop: Please bring the battery key.');
  });

  it('omits the note line entirely when there is no note', () => {
    const sms = buildBookingApprovalSms(baseBooking(), config, '   ');
    expect(sms).not.toContain('Note from the workshop:');
  });

  it('includes the workshop phone number for questions', () => {
    const sms = buildBookingApprovalSms(baseBooking(), config);
    expect(sms).toContain('+44 7700 900821');
  });
});

describe('normalizePhoneForSms', () => {
  it('converts a UK national number (Chloe: 07309103782) to E.164', () => {
    expect(normalizePhoneForSms('07309103782')).toBe('+447309103782');
  });

  it('handles a spaced UK national number', () => {
    expect(normalizePhoneForSms('0730 910 3782')).toBe('+447309103782');
  });

  it('leaves an already-international number intact', () => {
    expect(normalizePhoneForSms('+44 7309 103782')).toBe('+447309103782');
  });

  it('handles the 0044 international prefix', () => {
    expect(normalizePhoneForSms('00447309103782')).toBe('+447309103782');
  });

  it('handles a bare 44-prefixed number', () => {
    expect(normalizePhoneForSms('447309103782')).toBe('+447309103782');
  });

  it('returns empty string for blank input', () => {
    expect(normalizePhoneForSms('')).toBe('');
    expect(normalizePhoneForSms('   ')).toBe('');
  });
});

describe('createBookingApprovalSmsUrl', () => {
  it('addresses the SMS to the normalised customer number', () => {
    const url = createBookingApprovalSmsUrl(
      baseBooking({ customerPhone: '07309103782' }),
      config
    );
    expect(url.startsWith('sms:+447309103782?body=')).toBe(true);
    expect(decodeURIComponent(url.split('body=')[1])).toContain('Booking Confirmed — Ref #bk-5436');
  });
});
