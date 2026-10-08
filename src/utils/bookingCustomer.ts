/**
 * Resolve the roster profile behind a booking, so staff screens can show the
 * customer's real avatar (and any other profile data) on the correct card.
 *
 * Matching order is strongest-key-first: profile UUID (`customer_id`), then the
 * exact membership number, then email. Guest bookings carry none of these and
 * return `undefined`, letting the caller fall back to a seeded face. Matching by
 * uid first is what stops two customers with the same display name (e.g. two
 * "Ben pearson" profiles) from getting each other's avatar.
 */
import type { ServiceBooking, UserProfile } from '../types/bikeShop';

export function findCustomerForBooking(
  booking: Pick<ServiceBooking, 'customerId' | 'membershipNumber' | 'customerEmail'>,
  users: UserProfile[]
): UserProfile | undefined {
  const uid = booking.customerId || '';
  const membership = (booking.membershipNumber || '').trim().toUpperCase();
  const email = (booking.customerEmail || '').trim().toLowerCase();

  return users.find((u) => {
    if (uid && u.uid === uid) return true;
    if (membership && (u.membershipNumber || '').trim().toUpperCase() === membership) return true;
    if (email && (u.email || '').trim().toLowerCase() === email) return true;
    return false;
  });
}
