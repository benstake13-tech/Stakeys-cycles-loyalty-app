/**
 * Decide which incoming bookings are "brand new" and should raise the staff
 * ping/push. The booking list is re-read on every poll/realtime tick, so a
 * naive "not in the last snapshot" compare re-announces a booking whenever it
 * temporarily drops out of the (filtered) read. A monotonic `everSeen` set —
 * which only ever grows — guarantees each booking alerts at most once.
 *
 * `everSeen` is mutated in place (it is the caller's long-lived ref set).
 * Returns the ids that were genuinely new this call.
 */
export function newBookingIds(
  everSeen: Set<string>,
  incomingIds: string[]
): string[] {
  // Seed a fresh session from the first non-empty read without alerting, so a
  // login never replays the whole ledger as "new".
  if (everSeen.size === 0) {
    incomingIds.forEach((id) => everSeen.add(id));
    return [];
  }
  const fresh: string[] = [];
  for (const id of incomingIds) {
    if (!everSeen.has(id)) {
      everSeen.add(id);
      fresh.push(id);
    }
  }
  return fresh;
}
