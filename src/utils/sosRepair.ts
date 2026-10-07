/**
 * SOS Emergency Repair.
 *
 * A priority call-out for riders who cannot be off the road — couriers, Uber
 * Eats / delivery drivers, commuters. The customer still *requests* it and
 * describes the fault, but it skips the normal workshop queue and carries a
 * small express surcharge. Staff approve the request, ask for the rider's live
 * location over WhatsApp, send a quote, and only set off once the rider
 * confirms the quoted price.
 *
 * All the pure logic (status flow, surcharge maths, WhatsApp message/link
 * building) lives here so both the customer booking form and the staff terminal
 * share one definition and never drift.
 */
import { ServiceBooking } from '../types/bikeShop';

export type SosStatus =
  | 'requested'
  | 'approved'
  | 'location_requested'
  | 'quoted'
  | 'confirmed'
  | 'declined';

/** Flat priority surcharge added to an SOS job (the "costs a little more"). */
export const SOS_SURCHARGE = 15;

/** Marker written into booking notes so an SOS job is recognisable even if the
 * dedicated columns are missing on an older database. */
export const SOS_NOTES_MARKER = 'SOS EXPRESS REPAIR';

export const SOS_STATUS_FLOW: SosStatus[] = [
  'requested',
  'approved',
  'location_requested',
  'quoted',
  'confirmed',
];

const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  requested: 'SOS requested',
  approved: 'Approved — awaiting location',
  location_requested: 'Live location requested',
  quoted: 'Quote sent — awaiting confirmation',
  confirmed: 'Confirmed — set off now',
  declined: 'SOS declined',
};

export function sosStatusLabel(status: SosStatus | undefined): string {
  return status ? SOS_STATUS_LABELS[status] : 'SOS requested';
}

/** Whether a booking is an SOS express job. */
export function isSosBooking(booking: Pick<ServiceBooking, 'isSos' | 'notes'>): boolean {
  return Boolean(booking.isSos) || Boolean(booking.notes && booking.notes.includes(SOS_NOTES_MARKER));
}

/** Where a booking sits in the SOS flow (defaults to 'requested'). */
export function sosStatusOf(booking: Pick<ServiceBooking, 'sosStatus'>): SosStatus {
  return (booking.sosStatus as SosStatus) || 'requested';
}

/** Total an SOS job will cost once a base price is known. */
export function sosQuoteTotal(basePrice: number, surcharge: number = SOS_SURCHARGE): number {
  const base = Number.isFinite(basePrice) ? basePrice : 0;
  return Math.round((base + surcharge) * 100) / 100;
}

/**
 * Normalise a UK phone number for a wa.me link: wa.me needs the international
 * form, so a leading 0 becomes the 44 country code (07388… -> 447388…).
 */
export function normalisePhoneForWhatsApp(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
}

/** Build a wa.me deep link that opens WhatsApp with the message pre-filled. */
export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalisePhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`;
}

/** WhatsApp message asking the rider to share their live location. */
export function sosLocationRequestMessage(booking: Pick<ServiceBooking, 'customerName' | 'id' | 'vehicleModel'>): string {
  return (
    `Hi ${booking.customerName}, Stakey's Cycles SOS team here 🚨\n\n` +
    `We've approved your emergency repair for ${booking.vehicleModel} (Ref #${booking.id}). ` +
    `To dispatch a mechanic immediately, please share your live location: ` +
    `tap the 📎 (+) icon → Location → Share live location.\n\n` +
    `Reply here with your exact location or any landmark. We'll then send your express quote.`
  );
}

/** WhatsApp message delivering the express quote and asking for confirmation. */
export function sosQuoteMessage(
  booking: Pick<ServiceBooking, 'customerName' | 'id' | 'vehicleModel'>,
  quote: number,
  surcharge: number = SOS_SURCHARGE
): string {
  return (
    `Hi ${booking.customerName}, here's your SOS express quote for ${booking.vehicleModel} (Ref #${booking.id}):\n\n` +
    `Total: £${quote.toFixed(2)}\n` +
    `(includes a £${surcharge.toFixed(2)} priority call-out surcharge — you skip the queue)\n\n` +
    `Reply CONFIRM to authorise the price and we'll set off immediately. 🚴‍♂️`
  );
}

export function buildSosLocationRequestUrl(
  booking: Pick<ServiceBooking, 'customerPhone' | 'customerName' | 'id' | 'vehicleModel'>
): string {
  return whatsAppLink(booking.customerPhone, sosLocationRequestMessage(booking));
}

export function buildSosQuoteUrl(
  booking: Pick<ServiceBooking, 'customerPhone' | 'customerName' | 'id' | 'vehicleModel'>,
  quote: number,
  surcharge: number = SOS_SURCHARGE
): string {
  return whatsAppLink(booking.customerPhone, sosQuoteMessage(booking, quote, surcharge));
}
