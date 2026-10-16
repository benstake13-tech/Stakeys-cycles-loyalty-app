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

  // A known ID is authoritative even if older contact details point elsewhere.
  if (uid) return users.find(u => u.uid === uid);
  const unique = (matches: UserProfile[]) => matches.length === 1 ? matches[0] : undefined;
  if (membership) return unique(users.filter(u => (u.membershipNumber || '').trim().toUpperCase() === membership));
  if (email) return unique(users.filter(u => (u.email || '').trim().toLowerCase() === email));
  return undefined;
}
