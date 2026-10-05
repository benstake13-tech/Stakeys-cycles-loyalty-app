/**
 * Workshop performance analytics.
 *
 * A service request is a booking; its channel is derived from the notes the
 * booking form writes. Phone bookings carry a "BOOKING CHANNEL: Phone call"
 * marker (see PhoneBookingPanel), everything else is an online request. This
 * module turns raw bookings into the weekly + call-log figures the Performance
 * Tracker shows, and is kept pure so it can be unit tested.
 */
import type { ServiceBooking } from '../types/bikeShop';

export type RequestChannel = 'online' | 'phone' | 'in_person';

const PHONE_CHANNEL_RE = /BOOKING CHANNEL:\s*Phone call/i;
const IN_PERSON_CHANNEL_RE = /BOOKING CHANNEL:\s*(In.?person|Walk.?in|Counter)/i;

/** Which intake channel a booking came through. */
export function classifyBookingChannel(booking: ServiceBooking): RequestChannel {
  const notes = booking.notes || '';
  if (PHONE_CHANNEL_RE.test(notes)) return 'phone';
  if (IN_PERSON_CHANNEL_RE.test(notes)) return 'in_person';
  return 'online';
}

/** A booking counts as "answered" on the phone when it carries the phone marker. */
export function isPhoneCall(booking: ServiceBooking): boolean {
  return classifyBookingChannel(booking) === 'phone';
}

/** Approved or past-approval means the phone call actually converted to work. */
const CONVERTED_STATUSES = new Set(['approved', 'in_progress', 'completed']);

export function didConvert(booking: ServiceBooking): boolean {
  if (booking.approvalStatus === 'approved') return true;
  return CONVERTED_STATUSES.has(booking.status);
}

export interface DailyRequests {
  /** Weekday short name, e.g. "Mon". */
  name: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  online: number;
  phone: number;
  total: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Service requests for the trailing 7 days (oldest first, ending today),
 * split by channel. `now` is injectable for deterministic tests.
 */
export function weeklyServiceRequests(bookings: ServiceBooking[], now: Date = new Date()): DailyRequests[] {
  const days: DailyRequests[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ name: WEEKDAYS[d.getDay()], date: isoDay(d), online: 0, phone: 0, total: 0 });
  }
  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const booking of bookings) {
    if (!booking.createdAt) continue;
    const created = new Date(booking.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const day = byDate.get(isoDay(created));
    if (!day) continue;
    if (classifyBookingChannel(booking) === 'phone') day.phone += 1;
    else day.online += 1;
    day.total += 1;
  }
  return days;
}

export interface CallLogEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceTitle: string;
  status: string;
  approvalStatus?: string;
  converted: boolean;
  at: number;
}

/** Phone bookings as call-log rows, newest first. */
export function callLog(bookings: ServiceBooking[]): CallLogEntry[] {
  return bookings
    .filter(isPhoneCall)
    .map((b) => ({
      id: b.id,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      serviceTitle: b.serviceTitle,
      status: b.status,
      approvalStatus: b.approvalStatus,
      converted: didConvert(b),
      at: new Date(b.createdAt).getTime() || 0,
    }))
    .sort((a, b) => b.at - a.at);
}

export interface PerformanceSummary {
  requests7d: number;
  online7d: number;
  phone7d: number;
  /** Same metrics for the previous 7 days, for trend deltas. */
  requestsPrior7d: number;
  phonePrior7d: number;
  /** Percentage change in total requests vs the previous week (0 when no base). */
  requestsDelta: number;
  phoneDelta: number;
  /** Share of phone calls that turned into approved/completed work, 0-100. */
  callConversionPct: number;
  callsLogged: number;
}

function pctDelta(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prior) / prior) * 100);
}

export function summarizePerformance(
  bookings: ServiceBooking[],
  now: Date = new Date()
): PerformanceSummary {
  const week = weeklyServiceRequests(bookings, now);
  const requests7d = week.reduce((n, d) => n + d.total, 0);
  const online7d = week.reduce((n, d) => n + d.online, 0);
  const phone7d = week.reduce((n, d) => n + d.phone, 0);

  const priorEnd = new Date(now);
  priorEnd.setDate(priorEnd.getDate() - 7);
  const priorWeek = weeklyServiceRequests(bookings, priorEnd);
  const requestsPrior7d = priorWeek.reduce((n, d) => n + d.total, 0);
  const phonePrior7d = priorWeek.reduce((n, d) => n + d.phone, 0);

  const calls = callLog(bookings);
  const converted = calls.filter((c) => c.converted).length;

  return {
    requests7d,
    online7d,
    phone7d,
    requestsPrior7d,
    phonePrior7d,
    requestsDelta: pctDelta(requests7d, requestsPrior7d),
    phoneDelta: pctDelta(phone7d, phonePrior7d),
    callConversionPct: calls.length ? Math.round((converted / calls.length) * 100) : 0,
    callsLogged: calls.length,
  };
}
