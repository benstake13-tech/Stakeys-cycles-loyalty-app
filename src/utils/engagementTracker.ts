/**
 * Customer engagement analytics.
 *
 * Pure helpers that turn the shop's raw records (members, stamp-log activity,
 * bookings, referrals, prize draws, promotions and coupon usage) into the
 * "popular features" and "member activity" figures the Performance Tracker
 * shows. Kept pure so it is unit-testable and cheap to compute.
 *
 * Login frequency is intentionally computed from records the app already has
 * (last visit stamp, last wheel spin, last booking) rather than a dedicated
 * login column: the app writes nothing extra at login, so this stays accurate
 * with no new writes on the sign-in path.
 */
import type {
  UserProfile,
  StampLog,
  ServiceBooking,
  ReferralRecord,
  PrizeDraw,
  ShopPromotion,
  DiscountCode,
} from '../types/bikeShop';

const DAY_MS = 24 * 3600 * 1000;

const toTime = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().getTime();
    } catch {
      /* fall through */
    }
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Epoch ms of a member's most recent visible activity (0 when none). */
export function lastActivityAt(user: UserProfile): number {
  return Math.max(
    toTime(user.lastStampedAt),
    toTime(user.lastSpunAt),
    toTime(user.createdAt)
  );
}

export interface MemberActivity {
  totalMembers: number;
  active30d: number;
  dormant30d: number;
  /** Members who have joined but never earned a stamp. */
  neverVisited: number;
  /** Signups in the last 30 days. */
  joined30d: number;
}

export function memberActivity(users: UserProfile[], now: Date = new Date()): MemberActivity {
  const customers = users.filter((u) => u.role === 'customer');
  const cutoff = now.getTime() - 30 * DAY_MS;
  let active30d = 0;
  let neverVisited = 0;
  let joined30d = 0;
  for (const u of customers) {
    if (lastActivityAt(u) >= cutoff) active30d += 1;
    if ((u.stamps || 0) === 0 && toTime(u.lastStampedAt) === 0) neverVisited += 1;
    if (toTime(u.createdAt) >= cutoff) joined30d += 1;
  }
  return {
    totalMembers: customers.length,
    active30d,
    dormant30d: customers.length - active30d,
    neverVisited,
    joined30d,
  };
}

/** The features a customer can open in the app, in launcher order. */
export const FEATURE_LABELS: Record<string, string> = {
  garage: 'My Garage',
  wheel: 'Prize Wheel',
  booking: 'Book Service',
  repairs: 'Repairs',
  bookings: 'Bookings',
  stamps: 'Loyalty Pass',
  weather: 'Riding Weather',
  refer: 'Refer a Friend',
};

export interface FeatureUsage {
  id: string;
  label: string;
  /** Members who have actually used the feature at least once. */
  users: number;
  /** Raw record count behind the feature (spins, bookings, referrals…). */
  events: number;
  /** Share of members who have used it, 0-100. */
  adoptionPct: number;
  hint: string;
}

/** Builds per-feature usage/adoption from records the app already holds. */
export function featureUsage(data: {
  users?: UserProfile[];
  stampLogs?: StampLog[];
  bookings?: ServiceBooking[];
  draws?: PrizeDraw[];
  referrals?: ReferralRecord[];
}): FeatureUsage[] {
  const users = data.users || [];
  const stampLogs = data.stampLogs || [];
  const bookings = data.bookings || [];
  const draws = data.draws || [];
  const referrals = data.referrals || [];

  const customers = users.filter((u) => u.role === 'customer');
  const total = customers.length || 1;

  const distinct = (values: (string | undefined)[]): number =>
    new Set(values.filter((v): v is string => Boolean(v))).size;

  const garageUsers = customers.filter((u) => (u.bikes || []).length > 0).length;
  const garageEvents = customers.reduce((n, u) => n + (u.bikes || []).length, 0);

  const wheelUsers = distinct([
    ...customers.filter((u) => toTime(u.lastSpunAt) > 0).map((u) => u.uid),
    ...draws.map((d) => d.winnerUid || undefined),
  ]);
  const wheelEvents = draws.length + stampLogs.filter((l) => (l.ticketsAwarded || 0) > 0).length;

  const bookingUsers = distinct(bookings.map((b) => b.customerId));
  const repairUsers = distinct(
    bookings
      .filter((b) => ['approved', 'in_progress', 'completed'].includes(b.status))
      .map((b) => b.customerId)
  );

  const loyaltyUsers = distinct(stampLogs.map((l) => l.customerId).concat(customers.filter((u) => (u.stamps || 0) > 0).map((u) => u.uid)));
  const loyaltyEvents = stampLogs.filter((l) => l.action === 'add_stamp').length;

  const referralUsers = referrals.filter((r) => r.timesShared > 0).length || distinct(referrals.map((r) => r.ownerUid));
  const referralEvents = referrals.reduce((n, r) => n + (r.referredFriends?.length || 0), 0);

  const rows: Omit<FeatureUsage, 'adoptionPct'>[] = [
    { id: 'garage', label: FEATURE_LABELS.garage, users: garageUsers, events: garageEvents, hint: 'bikes registered' },
    { id: 'booking', label: FEATURE_LABELS.booking, users: bookingUsers, events: bookings.length, hint: 'service bookings' },
    { id: 'repairs', label: FEATURE_LABELS.repairs, users: repairUsers, events: bookings.filter((b) => ['approved', 'in_progress', 'completed'].includes(b.status)).length, hint: 'approved/active jobs' },
    { id: 'stamps', label: FEATURE_LABELS.stamps, users: loyaltyUsers, events: loyaltyEvents, hint: 'stamps awarded' },
    { id: 'wheel', label: FEATURE_LABELS.wheel, users: wheelUsers, events: wheelEvents, hint: 'draws + ticket awards' },
    { id: 'refer', label: FEATURE_LABELS.refer, users: referralUsers, events: referralEvents, hint: 'friends referred' },
  ];

  return rows
    .map((r) => ({ ...r, adoptionPct: Math.round((r.users / total) * 100) }))
    .sort((a, b) => b.users - a.users);
}

/** Top members by activity, for the "most engaged" list. */
export interface EngagedMember {
  uid: string;
  name: string;
  membershipNumber: string;
  stamps: number;
  points: number;
  bookings: number;
  lastActivity: number;
}

export function mostEngagedMembers(
  users: UserProfile[],
  bookings: ServiceBooking[] = [],
  limit = 5
): EngagedMember[] {
  const bookingsByUser = new Map<string, number>();
  for (const b of bookings) {
    if (!b.customerId) continue;
    bookingsByUser.set(b.customerId, (bookingsByUser.get(b.customerId) || 0) + 1);
  }
  return users
    .filter((u) => u.role === 'customer')
    .map((u) => ({
      uid: u.uid,
      name: u.displayName || 'Stakey Rider',
      membershipNumber: u.membershipNumber || '—',
      stamps: u.stamps || 0,
      points: u.points || 0,
      bookings: bookingsByUser.get(u.uid) || 0,
      lastActivity: lastActivityAt(u),
    }))
    .sort((a, b) => b.stamps - a.stamps || b.points - a.points || b.lastActivity - a.lastActivity)
    .slice(0, limit);
}

export interface PromotionPerformance {
  code: string;
  title: string;
  type: DiscountCode['type'];
  value: number;
  timesUsed: number;
  usageLimit?: number;
  redemptionPct?: number;
  status: DiscountCode['status'];
}

export function promotionPerformance(codes: DiscountCode[] = []): PromotionPerformance[] {
  return codes
    .map((c) => ({
      code: c.code,
      title: c.title,
      type: c.type,
      value: c.value,
      timesUsed: c.timesUsed || 0,
      usageLimit: c.usageLimit || undefined,
      redemptionPct: c.usageLimit && c.usageLimit > 0 ? Math.round(((c.timesUsed || 0) / c.usageLimit) * 100) : undefined,
      status: c.status,
    }))
    .sort((a, b) => b.timesUsed - a.timesUsed);
}

export interface PromotionOverview {
  total: number;
  active: number;
  upcoming: number;
  expired: number;
  totalRedemptions: number;
  top: PromotionPerformance | null;
}

export function promotionOverview(promotions: ShopPromotion[] = [], codes: DiscountCode[] = []): PromotionOverview {
  const perf = promotionPerformance(codes);
  const byStatus = (s: ShopPromotion['status']) => promotions.filter((p) => p.status === s).length;
  return {
    total: promotions.length,
    active: byStatus('active'),
    upcoming: byStatus('upcoming'),
    expired: byStatus('expired'),
    totalRedemptions: perf.reduce((n, p) => n + p.timesUsed, 0),
    top: perf.find((p) => p.timesUsed > 0) || null,
  };
}
