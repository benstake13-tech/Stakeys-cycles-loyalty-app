/**
 * Idempotency guard for booking emails.
 *
 * A single booking must produce exactly ONE workshop alert and ONE customer
 * confirmation per lifecycle event. In practice the same send can be triggered
 * more than once: a double-tap on "Confirm booking", a retry after a slow
 * network round-trip, or the same "new booking" being seen by more than one
 * client that watches the shared Supabase table.
 *
 * The two recipients are tracked SEPARATELY. They have different gates — the
 * workshop alert is skipped when staff mute their own inbox, while the customer
 * confirmation always goes out — so a single shared key would let a suppressed
 * workshop alert release the customer's dedup and send them a second copy.
 *
 * The key is `<bookingId>:<category>:<audience>`, so a booking still receives
 * one email per lifecycle event while a single event is never delivered twice.
 */

export type BookingEmailCategory =
  | 'booking_confirmation'
  | 'booking_approved'
  | 'booking_declined'
  | 'reminder_24h';

/** Who an email is going to. Tracked independently so one cannot mask the other. */
export type BookingEmailAudience = 'customer' | 'owner';

const sentKeys = new Set<string>();

export function bookingEmailKey(
  bookingId: string,
  category: BookingEmailCategory,
  audience: BookingEmailAudience = 'owner'
): string {
  return `${bookingId}:${category}:${audience}`;
}

/**
 * True the first time a booking/category/audience triple is seen, false on
 * every repeat. `audience` defaults to `'owner'` to preserve the original
 * single-key behaviour for callers that only guard the workshop alert.
 */
export function shouldSendBookingEmail(
  bookingId: string,
  category: BookingEmailCategory,
  audience: BookingEmailAudience = 'owner'
): boolean {
  const key = bookingEmailKey(bookingId, category, audience);
  if (sentKeys.has(key)) return false;
  sentKeys.add(key);
  return true;
}

/** Record a send that already happened (e.g. replayed from a stored log). */
export function markBookingEmailSent(
  bookingId: string,
  category: BookingEmailCategory,
  audience: BookingEmailAudience = 'owner'
): void {
  sentKeys.add(bookingEmailKey(bookingId, category, audience));
}

/**
 * Rebuilds the ledger from bookings already loaded from the database, so a
 * booking whose confirmation was emailed in an earlier session is not emailed
 * again after the app reloads and re-reads the shared table. Each stored log
 * records which role it went to, so both audiences are restored.
 */
export function rehydrateBookingEmailLedger(
  bookings: Array<{
    id: string;
    notifications?: Array<{ category?: string; recipientRole?: string }>;
  }>
): void {
  for (const booking of bookings) {
    for (const log of booking.notifications || []) {
      if (!log.category) continue;
      const audience: BookingEmailAudience = log.recipientRole === 'customer' ? 'customer' : 'owner';
      markBookingEmailSent(booking.id, log.category as BookingEmailCategory, audience);
    }
  }
}

/** Clears the ledger — used by tests and when the local database is reset. */
export function resetBookingEmailLedger(): void {
  sentKeys.clear();
}
