/**
 * Booking push-notification content.
 *
 * Every workshop alert (new booking, SOS milestone, realtime staff ping) is
 * built here so the copy is consistent and, crucially, PII-free: a push shows
 * the *booking* details — reference, source surface, service, vehicle, slot,
 * reported symptoms — but never the customer's name, email, phone or address.
 * Staff tap the notification to jump straight to the booking in the staff app
 * (see `bookingDeepLink`).
 *
 * A booking's source surface is inferred without a new database column:
 *   - guest   → booked on the public website (`isGuest` / no account)
 *   - member  → booked in the customer app while signed in (`customerId` set)
 *   - staff   → entered at the counter (the `BOOKING CHANNEL: Phone call` note)
 */
import { ServiceBooking, VehicleCategory } from '../types/bikeShop';
import { SOS_NOTES_MARKER } from './sosRepair';
import { STAFF_APP_ORIGIN } from '../config/surface';

export type BookingChannel = 'member' | 'guest' | 'staff';

/** Query params a push URL carries so the staff app can open the booking. */
export const STAFF_DEEPLINK_PARAM = 'staff';
export const BOOKING_DEEPLINK_PARAM = 'booking';

/** Last-resort origin if a computed origin cannot be parsed (tests, bad input). */
export const DEFAULT_PUSH_ORIGIN = 'https://www.stakeys-cycles.co.uk';

const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  cycle: 'Cycle',
  electric_scooter: 'E-scooter',
  ebike: 'E-bike',
  cargo: 'Cargo bike',
};

export function vehicleCategoryLabel(category: VehicleCategory | undefined): string {
  return (category && CATEGORY_LABEL[category]) || 'Bike';
}

const SOURCE_SHORT: Record<BookingChannel, string> = {
  member: 'Member app',
  guest: 'Website',
  staff: 'Phone booking',
};

const SOURCE_LONG: Record<BookingChannel, string> = {
  member: 'Member · Customer App',
  guest: 'Guest · Website',
  staff: 'Staff · Phone booking',
};

const SOURCE_ICON: Record<BookingChannel, string> = {
  member: '📱',
  guest: '🌐',
  staff: '☎️',
};

export function bookingSourceLabel(channel: BookingChannel): string {
  return SOURCE_LONG[channel];
}

export function bookingSourceShort(channel: BookingChannel): string {
  return SOURCE_SHORT[channel];
}

export function bookingSourceIcon(channel: BookingChannel): string {
  return SOURCE_ICON[channel];
}

/**
 * Works out which surface a booking came from. `staffCreated` short-circuits
 * for call sites that know they are creating the booking themselves.
 */
export function detectBookingChannel(
  booking: Pick<ServiceBooking, 'isGuest' | 'customerId' | 'notes'>,
  options: { staffCreated?: boolean } = {}
): BookingChannel {
  if (options.staffCreated) return 'staff';
  if (booking.notes && /BOOKING CHANNEL:\s*Phone call/i.test(booking.notes)) return 'staff';
  const hasAccount = Boolean(booking.customerId) && !booking.isGuest;
  return hasAccount ? 'member' : 'guest';
}

export interface ParsedBookingNotes {
  mobile: boolean;
  dropOff: boolean;
  symptoms: string[];
  serial?: string;
  motor?: string;
  instructions?: string;
  sosFault?: string;
}

/**
 * Extracts the workshop-relevant, PII-free facts from a booking's free-text
 * notes. The notes were written by the booking form, so the markers are stable.
 */
export function parseBookingNotes(notes: string | undefined): ParsedBookingNotes {
  const out: ParsedBookingNotes = { mobile: false, dropOff: false, symptoms: [] };
  if (!notes) return out;

  const lines = notes.split('\n');
  out.mobile = /SERVICE TYPE:\s*Home visit/i.test(notes);
  out.dropOff = /SERVICE TYPE:\s*Drop off at workshop/i.test(notes);

  const symptomsIdx = lines.findIndex((l) => /Reported Symptoms \(\d+\):/.test(l));
  if (symptomsIdx >= 0) {
    for (let i = symptomsIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('•')) break;
      const label = line.replace(/^•\s*/, '').replace(/^\[[^\]]*\]\s*/, '').trim();
      if (label) out.symptoms.push(label);
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    const serial = line.match(/^Serial:\s*(.+)$/i);
    if (serial) out.serial = serial[1].trim();
    const motor = line.match(/^Motor\/system:\s*(.+)$/i);
    if (motor) out.motor = motor[1].trim();
    const instructions = line.match(/^Customer Instructions:\s*(.+)$/i);
    if (instructions) out.instructions = instructions[1].trim();
    const fault = line.match(/^Fault:\s*(.+)$/i);
    if (fault) out.sosFault = fault[1].trim();
  }

  return out;
}

/** A compact "Bike (Category)" line, e.g. "Trek FX 2 (E-bike)". */
export function bookingVehicleLine(booking: Pick<ServiceBooking, 'vehicleModel' | 'vehicleCategory'>): string {
  return `${booking.vehicleModel} (${vehicleCategoryLabel(booking.vehicleCategory)})`;
}

/** "Mon 2 Oct · Morning" — the slot without repeating the full time-slot text. */
export function bookingSlotLine(
  booking: Pick<ServiceBooking, 'preferredDate' | 'preferredTimeSlot'>
): string {
  const slot = String(booking.preferredTimeSlot || '').split(' ')[0];
  return slot ? `${booking.preferredDate} · ${slot}` : String(booking.preferredDate || '');
}

export interface BookingNotificationOptions {
  /** Treat this as a staff-entered booking regardless of the notes. */
  staffCreated?: boolean;
}

export interface BookingNotificationContent {
  channel: BookingChannel;
  sourceLabel: string;
  title: string;
  body: string;
  url: string;
}

/**
 * Builds the PII-free push copy for a newly-received booking, plus the deep link
 * that opens it in the staff app.
 */
export function buildBookingNotification(
  booking: ServiceBooking,
  options: BookingNotificationOptions = {}
): BookingNotificationContent {
  const channel = detectBookingChannel(booking, options);
  const detail = parseBookingNotes(booking.notes);
  const sos = Boolean(booking.isSos) || Boolean(booking.notes?.includes(SOS_NOTES_MARKER));

  const title = `${sos ? '🚨 SOS call-out' : '🚨 New booking'} #${booking.id} · ${SOURCE_SHORT[channel]}`;

  const lines: string[] = [`${SOURCE_ICON[channel]} ${SOURCE_LONG[channel]}`];
  lines.push(booking.serviceTitle);
  lines.push(
    `${bookingVehicleLine(booking)}${detail.mobile ? ' · Call-out' : detail.dropOff ? ' · Drop-off' : ''}`
  );
  lines.push(`Slot: ${bookingSlotLine(booking)}`);
  if (detail.symptoms.length > 0) {
    const shown = detail.symptoms.slice(0, 3).join(', ');
    const extra = detail.symptoms.length > 3 ? ` +${detail.symptoms.length - 3} more` : '';
    lines.push(`Symptoms: ${shown}${extra}`);
  }
  if (detail.serial) lines.push(`Serial: ${detail.serial}`);
  if (sos && detail.sosFault) lines.push(`Fault: ${detail.sosFault}`);
  if (sos) lines.push('⚡ Priority — jumps the workshop queue');

  return {
    channel,
    sourceLabel: SOURCE_LONG[channel],
    title,
    body: lines.join('\n'),
    url: bookingDeepLink(booking.id),
  };
}

/**
 * The staff-app URL a push should open. `?staff=1&booking=<id>` unlocks the
 * staff view (when the device already has a staff session) and focuses the
 * booking. Existing query params are preserved.
 *
 * The origin is always the staff app, NOT the surface that created the booking:
 * a booking made on the website or in the customer app still has to open the
 * workshop terminal when staff tap the notification.
 */
export function bookingDeepLink(bookingId: string, origin?: string): string {
  const base = origin || STAFF_APP_ORIGIN;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    url = new URL(DEFAULT_PUSH_ORIGIN);
  }
  url.searchParams.set(STAFF_DEEPLINK_PARAM, '1');
  if (bookingId) url.searchParams.set(BOOKING_DEEPLINK_PARAM, bookingId);
  return url.toString();
}

export interface BookingDeepLinkTarget {
  staff: boolean;
  bookingId: string | null;
}

/** Reads the staff/booking deep-link params from a query string. */
export function parseBookingDeepLink(search: string): BookingDeepLinkTarget {
  const params = new URLSearchParams(search || '');
  const bookingId = (params.get(BOOKING_DEEPLINK_PARAM) || '').trim();
  return {
    staff: params.get(STAFF_DEEPLINK_PARAM) === '1',
    bookingId: bookingId || null,
  };
}

/**
 * PII-free SOS milestone copy, shared by the staff push and the SOS panel. The
 * `requested` stage reads like a new-booking alert so staff see the source
 * surface and the fault; later stages are status nudges.
 */
export function sosPushCopy(
  stage: 'requested' | 'approved' | 'quoted' | 'confirmed',
  booking: ServiceBooking,
  options: { quotedPrice?: number; channel?: BookingChannel } = {}
): { title: string; body: string } {
  const channel = options.channel ?? detectBookingChannel(booking);
  const detail = parseBookingNotes(booking.notes);
  const ref = `#${booking.id}`;

  if (stage === 'requested') {
    const lines = [
      `${SOURCE_ICON[channel]} ${SOURCE_LONG[channel]}`,
      booking.serviceTitle,
      bookingVehicleLine(booking),
    ];
    if (detail.sosFault) lines.push(`Fault: ${detail.sosFault}`);
    lines.push('⚡ Priority call-out — tap to review');
    return { title: `🚨 SOS request ${ref} · ${SOURCE_SHORT[channel]}`, body: lines.join('\n') };
  }

  const price = `£${(options.quotedPrice ?? 0).toFixed(2)}`;
  const stageCopy: Record<typeof stage, { title: string; body: string }> = {
    approved: {
      title: `✅ SOS approved ${ref}`,
      body: `${bookingVehicleLine(booking)} — approved. Request the rider's live location over WhatsApp.`,
    },
    quoted: {
      title: `💷 SOS quote sent ${ref}`,
      body: `Quote of ${price} sent for ${bookingVehicleLine(booking)}. Awaiting the rider's confirmation.`,
    },
    confirmed: {
      title: `🚴 SET OFF NOW ${ref}`,
      body: `${bookingVehicleLine(booking)} — price confirmed at ${price}. Dispatch immediately.`,
    },
  };
  return stageCopy[stage];
}
