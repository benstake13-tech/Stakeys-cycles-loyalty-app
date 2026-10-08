import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Settings2, Inbox } from 'lucide-react';
import type { WorkshopActivity } from '../utils/notificationActivity';
import { relativeTime } from '../utils/notificationActivity';

const SEEN_KEY = 'stakeys.staff.notifications.seenAt';

export interface NotificationBellProps {
  /** Activities already filtered to the events the workshop shows visually. */
  activities: WorkshopActivity[];
  /** Open a booking in the staff bookings feed. */
  onOpenBooking: (bookingId: string) => void;
  /** Open a member's account in the staff members area. */
  onOpenMember: (memberUid: string) => void;
  /** Jump to the notification settings (the Settings page). */
  onOpenSettings: () => void;
}

type FeedFilter = 'all' | 'bookings' | 'members';

/**
 * The staff notification bell. Shows the latest workshop activity (bookings,
 * members, garage additions, vouchers, prize wins) and routes a tap to the
 * right place: a booking opens in the bookings feed, a member opens their
 * account. The unread badge counts everything newer than the last time the bell
 * was opened; "Mark all read" pins the marker to now.
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  activities,
  onOpenBooking,
  onOpenMember,
  onOpenSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [seenAt, setSeenAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(SEEN_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const unread = useMemo(
    () => activities.filter((a) => a.timestamp > seenAt).length,
    [activities, seenAt]
  );

  const visible = useMemo(() => {
    if (filter === 'bookings') return activities.filter((a) => a.target === 'booking');
    if (filter === 'members') return activities.filter((a) => a.target === 'member');
    return activities;
  }, [activities, filter]);

  const markAllRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* ignore */
    }
  };

  const handleOpen = () => {
    setIsOpen((v) => !v);
  };

  const handleSelect = (a: WorkshopActivity) => {
    if (a.target === 'booking' && a.refId) onOpenBooking(a.refId);
    else if (a.target === 'member' && a.refId) onOpenMember(a.refId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Workshop notifications"
        className="pressable relative p-2.5 rounded-xl border cursor-pointer bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-emerald-500/40 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-black flex items-center justify-center border border-amber-300 shadow-sm">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] rounded-2xl border border-neutral-800 bg-[#0b0e12] shadow-2xl overflow-hidden animate-slide-down z-50">
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">Notifications</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                title="Mark all read"
                className="pressable p-1.5 rounded-lg text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setIsOpen(false);
                }}
                title="Notification settings"
                className="pressable p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-800/70">
            {(['all', 'bookings', 'members'] as FeedFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-neutral-500">
                <Inbox className="w-8 h-8" />
                <span className="text-xs">Nothing here yet.</span>
              </div>
            ) : (
              visible.map((a) => {
                const isNew = a.timestamp > seenAt;
                const clickable = a.target !== 'none' && Boolean(a.refId);
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleSelect(a)}
                    className={`w-full text-left px-3.5 py-3 border-b border-neutral-800/60 transition-colors ${
                      clickable ? 'hover:bg-neutral-900 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                          isNew ? 'bg-amber-400 animate-pulse' : 'bg-neutral-700'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">{a.title}</span>
                          <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                            {relativeTime(a.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{a.detail}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
