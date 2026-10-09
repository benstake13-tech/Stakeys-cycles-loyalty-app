/**
 * Session "send once per key" guard for one-off transactional emails.
 *
 * Booking lifecycle emails already carry their own per-booking ledger
 * (bookingEmailLedger) so a booking is confirmed/approved/declined/reminded
 * exactly once. This guard covers the one-off sends that had no dedupe at all:
 * the staff "test email" button and the website shop-order notification. It
 * stops the same manual action, re-run while testing, from sending duplicate
 * copies and burning the provider's daily email quota.
 *
 * The key must uniquely describe the send. Callers should build it from the
 * recipient plus a stable signature of the content, never from a random id.
 */
const sentKeys = new Set<string>();

/** True the first time a key is seen this session, false on every repeat. */
export function claimEmailSend(key: string): boolean {
  if (sentKeys.has(key)) return false;
  sentKeys.add(key);
  return true;
}

/** Clears the guard — used by tests and when the local app is reset. */
export function resetEmailSendGuard(): void {
  sentKeys.clear();
}
