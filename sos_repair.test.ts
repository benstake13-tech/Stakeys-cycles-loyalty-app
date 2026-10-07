import { describe, it, expect } from 'vitest';
import {
  SOS_SURCHARGE,
  SOS_NOTES_MARKER,
  isSosBooking,
  sosStatusOf,
  sosStatusLabel,
  sosQuoteTotal,
  normalisePhoneForWhatsApp,
  whatsAppLink,
  sosLocationRequestMessage,
  sosQuoteMessage,
  buildSosLocationRequestUrl,
  buildSosQuoteUrl,
} from './src/utils/sosRepair';

const job = {
  id: 'bk-42',
  customerName: 'Sam Rider',
  customerPhone: '07388 209102',
  vehicleModel: 'Carrera Vengeance',
};

describe('SOS emergency repair — pure logic', () => {
  it('recognises an SOS job by the flag or the notes marker', () => {
    expect(isSosBooking({ isSos: true, notes: '' })).toBe(true);
    expect(isSosBooking({ isSos: false, notes: `🚨 ${SOS_NOTES_MARKER} — PRIORITY CALL-OUT` })).toBe(true);
    expect(isSosBooking({ isSos: false, notes: 'normal booking' })).toBe(false);
  });

  it('defaults the status to requested and labels each step', () => {
    expect(sosStatusOf({})).toBe('requested');
    expect(sosStatusOf({ sosStatus: 'quoted' })).toBe('quoted');
    expect(sosStatusLabel(undefined)).toBe('SOS requested');
    expect(sosStatusLabel('confirmed')).toBe('Confirmed — set off now');
  });

  it('adds the express surcharge to the base price', () => {
    expect(sosQuoteTotal(45)).toBe(60);
    expect(sosQuoteTotal(45, 15)).toBe(60);
    expect(sosQuoteTotal(0)).toBe(SOS_SURCHARGE);
    expect(sosQuoteTotal(Number.NaN)).toBe(SOS_SURCHARGE);
    // Floating-point safety.
    expect(sosQuoteTotal(10.1)).toBe(25.1);
  });

  it('normalises UK numbers for wa.me', () => {
    expect(normalisePhoneForWhatsApp('07388 209102')).toBe('447388209102');
    expect(normalisePhoneForWhatsApp('+44 7388 209102')).toBe('447388209102');
    expect(normalisePhoneForWhatsApp('447388209102')).toBe('447388209102');
  });

  it('builds a wa.me link with the message URL-encoded', () => {
    const link = whatsAppLink('07388 209102', 'Hello there');
    expect(link.startsWith('https://wa.me/447388209102?text=')).toBe(true);
    expect(link).toContain(encodeURIComponent('Hello there'));
  });

  it('asks the rider for their live location, naming the job', () => {
    const msg = sosLocationRequestMessage(job);
    expect(msg).toContain('Sam Rider');
    expect(msg).toContain('#bk-42');
    expect(msg).toContain('live location');
  });

  it('quotes the total and the surcharge, and asks for CONFIRM', () => {
    const msg = sosQuoteMessage(job, 60, 15);
    expect(msg).toContain('£60.00');
    expect(msg).toContain('£15.00');
    expect(msg).toContain('CONFIRM');
  });

  it('exposes ready-made deep links for staff', () => {
    const loc = buildSosLocationRequestUrl(job);
    expect(loc).toContain('https://wa.me/447388209102');
    const quote = buildSosQuoteUrl(job, 60);
    expect(quote).toContain('https://wa.me/447388209102');
    expect(decodeURIComponent(quote)).toContain('£60.00');
  });
});
