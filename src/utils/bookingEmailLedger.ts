/**
 * Idempotency guard for booking emails.
 *
 * A single booking must produce exactly ONE workshop alert and ONE customer
 * confirmation per lifecycle event. In practice the same send can be triggered
 * more than once: a double-tap on "Confirm booking", a retry after a slow
 * network round-trip, or the same "new booking" being seen by more than one
 * client that watches the shared Supabase table.
 *
 * The key is `<bookingId>:<category>`, so a booking still receives one email
 * per lifecycle event (confirmation, approval, decline, reminder) while a
 * single event is never delivered twice.
 */

export type BookingEmailCategory =
  | 'booking_confirmation'
  | 'booking_approved'
  | 'booking_declined'
  | 'reminder_24h';

const sentKeys = new Set<string>();

export function bookingEmailKey(bookingId: string, category: BookingEmailCategory): string {
  return `${bookingId}:${category}`;
}

/** True the first time a booking/category pair is seen, false on every repeat. */
export function shouldSendBookingEmail(bookingId: string, category: BookingEmailCategory): boolean {
  const key = bookingEmailKey(bookingId, category);
  if (sentKeys.has(key)) return false;
  sentKeys.add(key);
  return true;
}

/** Record a send that already happened (e.g. replayed from a stored log). */
export function markBookingEmailSent(bookingId: string, category: BookingEmailCategory): void {
  sentKeys.add(bookingEmailKey(bookingId, category));
}

/**
 * Rebuilds the ledger from bookings already loaded from the database, so a
 * booking whose confirmation was emailed in an earlier session is not emailed
 * again after the app reloads and re-reads the shared table.
 */
export function rehydrateBookingEmailLedger(
  bookings: Array<{ id: string; notifications?: Array<{ category?: string }> }>
): void {
  for (const booking of bookings) {
    for (const log of booking.notifications || []) {
      if (log.category) markBookingEmailSent(booking.id, log.category as BookingEmailCategory);
    }
  }
}

/** Clears the ledger — used by tests and when the local database is reset. */
export function resetBookingEmailLedger(): void {
  sentKeys.clear();
}
