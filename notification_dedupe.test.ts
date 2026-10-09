import { describe, it, expect } from 'vitest';
import { nextStampAnnouncement } from './src/utils/stampAnnouncements';
import { newBookingIds } from './src/utils/bookingAlerts';

// Regression guard for the recording's "notification storm": both the stamp
// toast and the staff booking ping were driven by a value re-read every poll,
// so a transiently-missing local copy re-fired the same alert on every tick.

describe('nextStampAnnouncement', () => {
  it('seeds on first sight and does NOT announce historic stamps', () => {
    const r = nextStampAnnouncement(undefined, 7);
    expect(r.level).toBe(7);
    expect(r.gained).toBeUndefined();
  });

  it('announces a genuine gain exactly once', () => {
    expect(nextStampAnnouncement(7, 8)).toEqual({ level: 8, gained: 1 });
    // The follow-up tick at the same level is silent.
    expect(nextStampAnnouncement(8, 8)).toEqual({ level: 8 });
  });

  it('does NOT re-fire when the remote value is unchanged', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      const r = nextStampAnnouncement(seen.get('u'), 10);
      seen.set('u', r.level);
      expect(r.gained).toBeUndefined();
    }
  });

  it('re-announces after a reset drops the level and it climbs again', () => {
    const reset = nextStampAnnouncement(10, 0);
    expect(reset).toEqual({ level: 0 });
    const back = nextStampAnnouncement(reset.level, 1);
    expect(back).toEqual({ level: 1, gained: 1 });
  });

  it('reports a multi-stamp gain in one step', () => {
    expect(nextStampAnnouncement(3, 6)).toEqual({ level: 6, gained: 3 });
  });
});

describe('newBookingIds', () => {
  it('seeds a fresh session from the first read without alerting', () => {
    const everSeen = new Set<string>();
    expect(newBookingIds(everSeen, ['a', 'b'])).toEqual([]);
    expect([...everSeen].sort()).toEqual(['a', 'b']);
  });

  it('returns only genuinely new ids', () => {
    const everSeen = new Set(['a']);
    expect(newBookingIds(everSeen, ['a', 'b', 'c'])).toEqual(['b', 'c']);
  });

  it('does NOT re-announce an id that dropped out and came back', () => {
    const everSeen = new Set(['a', 'b']);
    // 'b' disappears from this read...
    expect(newBookingIds(everSeen, ['a'])).toEqual([]);
    // ...and reappears — must not be treated as new again.
    expect(newBookingIds(everSeen, ['a', 'b'])).toEqual([]);
  });

  it('announces each real booking exactly once across many ticks', () => {
    const everSeen = new Set<string>(['seed']);
    let announcements = 0;
    for (let i = 0; i < 10; i++) {
      announcements += newBookingIds(everSeen, ['seed', 'new-1']).length;
    }
    expect(announcements).toBe(1);
  });
});
