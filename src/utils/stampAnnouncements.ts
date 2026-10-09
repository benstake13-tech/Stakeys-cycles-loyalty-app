/**
 * Per-user high-water mark for stamp announcements.
 *
 * The "New Stamp Received" toast is driven by a value that is re-read on every
 * poll/realtime tick. Comparing the remote stamp count against the *current*
 * local snapshot re-fires the toast whenever the local copy lags the database
 * (a roster merge resetting stamps, or a poll racing a write), stacking the same
 * notification forever. Tracking the level we last announced per user makes each
 * gain announce exactly once, while still allowing a reset to be re-announced
 * later.
 */
export interface StampAnnouncementResult {
  /** The level the caller should remember for next time. */
  level: number;
  /** Stamps gained since the last announcement, if this is a new high. */
  gained?: number;
}

export function nextStampAnnouncement(
  previousLevel: number | undefined,
  remoteStamps: number
): StampAnnouncementResult {
  // First sight: remember the level WITHOUT announcing, so a fresh login never
  // replays historic stamps.
  if (previousLevel === undefined) return { level: remoteStamps };
  if (remoteStamps > previousLevel) {
    return { level: remoteStamps, gained: remoteStamps - previousLevel };
  }
  // Equal or a reset/decrease: move the mark to the observed level so a later
  // gain is announced, without re-firing for a level already seen.
  return { level: remoteStamps };
}
