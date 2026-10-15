import { MilestoneMessage } from './MilestoneArtwork';
import { MILESTONE_NOTICE_MS } from '../utils/milestoneVisuals';
import { createPortal } from 'react-dom';
import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

// Also prevents replays when browser storage is unavailable in the current session.
const playedBookings = new Set<string>();
const storageKey = (id: string) => `stakeys.booking-confirmation-played:${id}`;

function hasPlayed(id: string): boolean {
  if (playedBookings.has(id)) return true;
  try { return localStorage.getItem(storageKey(id)) === '1'; } catch { return false; }
}

/** Mount only after a booking has been successfully saved, keyed by its real ID. */
export const BookingConfirmationAnimation: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const [playing, setPlaying] = useState(() => Boolean(bookingId) && !hasPlayed(bookingId)
    && !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches));

  useEffect(() => {
    if (!bookingId) return;
    playedBookings.add(bookingId);
    try { localStorage.setItem(storageKey(bookingId), '1'); } catch { /* session fallback above */ }
  }, [bookingId]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), MILESTONE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [playing]);

  return playing ? createPortal(
    <div className="stakeys-milestone-overlay" data-testid="booking-confirmation-animation">
      <MilestoneMessage kind="booking" title="Booking request received" detail="Awaiting approval from the team." dismissLabel="Dismiss booking animation" onDismiss={() => setPlaying(false)}/>
    </div>, document.body
  ) : (
    <div role="status" aria-label="Booking request received. Awaiting team approval." className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
      <CheckCircle2 className="w-6 h-6" aria-hidden="true"/>
    </div>
  );
};
