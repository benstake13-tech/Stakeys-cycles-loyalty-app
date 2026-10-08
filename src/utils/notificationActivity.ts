/**
 * The staff notification feed.
 *
 * Turns the raw workshop data (bookings, members, garages, vouchers) into one
 * chronological list of "activities" the bell shows. Each activity knows what it
 * is about and, crucially, where tapping it should go — a booking, a member's
 * account dossier, or nowhere. Nothing here talks to the network: it is a pure
 * projection so it can be unit-tested and reused by the bell and the settings
 * preview.
 */
import type { ServiceBooking, UserProfile, CollectedVoucher, PrizeDraw } from '../types/bikeShop';
import type { NotificationAudience, NotificationEventId } from './notificationPreferences';

export interface WorkshopActivity {
  /** Stable id so a tap can be routed and React can key the list. */
  id: string;
  kind: NotificationEventId;
  title: string;
  detail: string;
  /** Epoch ms; 0 when the source timestamp was missing/unparseable. */
  timestamp: number;
  audience: NotificationAudience;
  /** What tapping the notification should open. */
  target: 'booking' | 'member' | 'none';
  /** Booking id or member uid, depending on `target`. */
  refId?: string;
  /** Free-form extra facts shown in the expanded row. */
  meta?: Record<string, string>;
}

/** Parse the many date shapes the app stores into epoch ms (0 = unknown). */
export function toEpoch(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    try {
      return (value as any).toDate().getTime();
    } catch {
      return 0;
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

const MAX_ACTIVITIES = 60;

export interface ActivitySources {
  bookings?: ServiceBooking[];
  users?: UserProfile[];
  /** Completed prize draws, so a winner shows up in the feed. */
  draws?: PrizeDraw[];
  now?: number;
}

function buildDrawActivity(draw: PrizeDraw): WorkshopActivity | null {
  if (!draw.winnerUid && !draw.winnerName) return null;
  return {
    id: `prize_won:${draw.id}`,
    kind: 'prize_won',
    title: '🏆 Prize draw won',
    detail: `${draw.winnerName || 'A member'} · ${draw.prizeDescription || draw.title}`,
    timestamp: toEpoch(draw.completedAt) || toEpoch(draw.drawDate),
    audience: 'both',
    target: 'member',
    refId: draw.winnerUid || undefined,
    meta: {
      Draw: draw.title,
      Winner: draw.winnerName || 'Unknown',
      Prize: draw.prizeDescription || '',
    },
  };
}

/** A booking's best-known "happened at" time. */
function bookingTime(b: ServiceBooking): number {
  return toEpoch(b.createdAt) || toEpoch(b.preferredDate);
}

function isFinished(b: ServiceBooking): boolean {
  return b.status === 'completed' || b.status === 'cancelled';
}

function buildBookingActivity(b: ServiceBooking): WorkshopActivity | null {
  const timestamp = bookingTime(b);
  const isSos = Boolean(b.isSos);
  const kind: NotificationEventId = isSos ? 'sos_request' : 'new_booking';
  const ref = `#${b.id}`;
  return {
    id: `${kind}:${b.id}`,
    kind,
    title: isSos ? `🚨 SOS call-out ${ref}` : `🔧 New booking ${ref}`,
    detail: `${b.customerName} · ${b.serviceTitle} · ${b.vehicleModel}`,
    timestamp,
    audience: 'staff',
    target: 'booking',
    refId: b.id,
    meta: {
      Service: b.serviceTitle,
      Vehicle: b.vehicleModel,
      Slot: `${b.preferredDate}${b.preferredTimeSlot ? ` · ${b.preferredTimeSlot}` : ''}`,
      Status: b.status,
    },
  };
}

function buildMemberActivity(u: UserProfile): WorkshopActivity[] {
  const out: WorkshopActivity[] = [];
  const name = u.displayName || 'A member';
  const ref = u.membershipNumber || u.uid;

  const joined = toEpoch(u.createdAt);
  if (joined) {
    out.push({
      id: `new_member:${u.uid}`,
      kind: 'new_member',
      title: '🎉 New member joined',
      detail: `${name} · ${ref}`,
      timestamp: joined,
      audience: 'both',
      target: 'member',
      refId: u.uid,
      meta: { Member: name, Membership: ref },
    });
  }

  // A filled card is a completed milestone; `stamps` resets to 0 on redemption,
  // so a member sitting at the threshold is the actionable "reward ready" case.
  if ((u.stamps || 0) >= 10) {
    out.push({
      id: `reward_ready:${u.uid}`,
      kind: 'reward_ready',
      title: '🎁 Reward ready to redeem',
      detail: `${name} · card full (${u.stamps}/10)`,
      timestamp: toEpoch(u.lastStampedAt) || joined,
      audience: 'customer',
      target: 'member',
      refId: u.uid,
      meta: { Member: name, Stamps: `${u.stamps}/10` },
    });
  }

  for (const bike of u.bikes || []) {
    out.push({
      id: `bike_added:${u.uid}:${bike.id}`,
      kind: 'bike_added',
      title: '🚲 Bike added to garage',
      detail: `${name} · ${bike.brand} ${bike.model}`,
      timestamp: toEpoch(bike.addedAt) || joined,
      audience: 'both',
      target: 'member',
      refId: u.uid,
      meta: {
        Member: name,
        Bike: `${bike.brand} ${bike.model}`,
        ...(bike.serialNumber ? { Serial: bike.serialNumber } : {}),
      },
    });
  }

  for (const v of u.serviceVouchers || []) {
    out.push(buildVoucherActivity(u, v, joined));
  }

  return out;
}

function buildVoucherActivity(u: UserProfile, v: CollectedVoucher, fallback: number): WorkshopActivity {
  const name = u.displayName || 'A member';
  return {
    id: `voucher_earned:${v.id}`,
    kind: 'voucher_earned',
    title: '🎟️ Service voucher issued',
    detail: `${name} · ${v.title || v.code} (£${v.value})`,
    timestamp: toEpoch(v.claimedAt) || fallback,
    audience: 'both',
    target: 'member',
    refId: u.uid,
    meta: {
      Member: name,
      Voucher: v.title || v.code,
      Value: `£${v.value}`,
      Status: v.status,
    },
  };
}

/**
 * Build the whole feed, newest first, de-duplicated by id. Only the most recent
 * `MAX_ACTIVITIES` are kept so the bell stays fast on a busy workshop.
 */
export function buildWorkshopActivities(sources: ActivitySources): WorkshopActivity[] {
  const { bookings = [], users = [], draws = [] } = sources;
  const byId = new Map<string, WorkshopActivity>();

  const push = (a: WorkshopActivity | null) => {
    if (!a) return;
    // Keep the earliest timestamp for a given id (the moment it happened).
    const existing = byId.get(a.id);
    if (!existing || (a.timestamp && a.timestamp < existing.timestamp)) byId.set(a.id, a);
  };

  for (const b of bookings) push(buildBookingActivity(b));
  for (const u of users) {
    if (u.role !== 'customer') continue;
    for (const a of buildMemberActivity(u)) push(a);
  }
  for (const d of draws) push(buildDrawActivity(d));

  return [...byId.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACTIVITIES);
}

/**
 * Split a feed into "what the bell shows" (visual channel on) and the rest, and
 * count the fresh ones since a marker timestamp so the bell can show a badge.
 */
export function filterVisibleActivities(
  activities: WorkshopActivity[],
  isVisible: (kind: NotificationEventId) => boolean
): WorkshopActivity[] {
  return activities.filter((a) => isVisible(a.kind));
}

export function countSince(activities: WorkshopActivity[], since: number): number {
  return activities.filter((a) => a.timestamp > since).length;
}

/** A short relative age, e.g. "just now", "12m", "3h", "2d". */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  if (!timestamp) return 'unknown';
  const diff = Math.max(0, now - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}
