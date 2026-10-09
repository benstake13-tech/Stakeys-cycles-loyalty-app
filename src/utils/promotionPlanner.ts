import { ShopPromotion, VehicleCategory } from '../types/bikeShop';

/**
 * Pure planning helpers for the Promotions planner. Nothing here touches React
 * or the network, so the scheduling maths (overlap detection, badge text,
 * timeline geometry, gap finding) is unit-testable in isolation.
 */

export interface PlannerInput {
  title: string;
  discountPercentage?: number;
  discountAmount?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  eligibleCategories: VehicleCategory[];
}

export interface PromotionPlan extends PlannerInput {
  status: ShopPromotion['status'];
  badgeText: string;
  code: string;
  durationDays: number;
  warnings: string[];
  conflicts: ShopPromotion[];
  summary: string;
}

const DAY_MS = 24 * 3600 * 1000;

export const toDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseDate = (value: string): Date => {
  const [y, m, d] = String(value || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
};

export const addDays = (value: string | Date, days: number): string => {
  const base = value instanceof Date ? value : parseDate(value);
  return toDateOnly(new Date(base.getTime() + days * DAY_MS));
};

export const daysBetween = (a: string | Date, b: string | Date): number => {
  const da = a instanceof Date ? a : parseDate(a);
  const db = b instanceof Date ? b : parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
};

export const formatShort = (value: string): string => {
  const d = parseDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** Status is derived from the dates, never trusted from stale input. */
export const deriveStatus = (startDate: string, endDate: string, today = new Date()): ShopPromotion['status'] => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'upcoming';
  const t = parseDate(toDateOnly(today));
  if (t < start) return 'upcoming';
  if (t > end) return 'expired';
  return 'active';
};

export const deriveBadge = (status: ShopPromotion['status'], startDate: string): string => {
  if (status === 'active') return 'Active Now';
  if (status === 'upcoming') return `Starts ${formatShort(startDate)}`;
  return 'Ended';
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean =>
  parseDate(aStart) <= parseDate(bEnd) && parseDate(bStart) <= parseDate(aEnd);

const sharesCategory = (a: VehicleCategory[], b: VehicleCategory[]): boolean =>
  a.some((c) => b.includes(c));

const CODE_PREFIX = 'STK';

/** Builds a short, human-readable campaign code that does not clash with existing ones. */
export const generatePromoCode = (title: string, existing: ShopPromotion[] = []): string => {
  const initials = (title.match(/[A-Za-z]/g) || []).slice(0, 3).join('').toUpperCase() || 'PRM';
  const used = new Set(existing.map((p) => p.code));
  let attempt = `${CODE_PREFIX}-${initials}`;
  let n = 1;
  while (used.has(attempt)) {
    attempt = `${CODE_PREFIX}-${initials}${n}`;
    n += 1;
  }
  return attempt;
};

export interface PlanOptions {
  today?: Date;
  /** Days from `today` within which an overlapping campaign counts as a conflict. */
  conflictHorizonDays?: number;
}

export function planPromotion(
  input: PlannerInput,
  existing: ShopPromotion[] = [],
  opts: PlanOptions = {}
): PromotionPlan {
  const today = opts.today ?? new Date();
  const warnings: string[] = [];

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const validDates = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime());

  if (!validDates) warnings.push('Please set a valid start and end date.');
  else if (end < start) warnings.push('The end date is before the start date.');

  const durationDays = validDates ? daysBetween(start, end) + 1 : 0;
  if (durationDays > 90) warnings.push('This campaign runs longer than 90 days — consider splitting it.');

  const pct = input.discountPercentage || 0;
  const amt = input.discountAmount || 0;
  if (pct <= 0 && amt <= 0) warnings.push('No discount set — this campaign will not change pricing.');
  if (pct > 70) warnings.push(`A ${pct}% discount is unusually high — please double-check.`);

  const conflicts = validDates
    ? existing.filter(
        (p) =>
          p.status !== 'expired' &&
          sharesCategory(p.eligibleCategories || [], input.eligibleCategories) &&
          overlaps(input.startDate, input.endDate, p.startDate, p.endDate)
      )
    : [];

  if (conflicts.length) {
    warnings.push(
      `Overlaps ${conflicts.length} live campaign${conflicts.length > 1 ? 's' : ''} in the same category: ${conflicts
        .map((c) => c.title)
        .join(', ')}.`
    );
  }

  const status = validDates ? deriveStatus(input.startDate, input.endDate, today) : 'upcoming';
  const badgeText = deriveBadge(status, input.startDate);
  const code = generatePromoCode(input.title, existing);

  const discountLabel = pct > 0 ? `${pct}% off` : amt > 0 ? `£${amt} credit` : 'no discount';
  const summary = validDates
    ? `${durationDays}-day ${discountLabel} campaign for ${input.eligibleCategories.join(', ') || 'all categories'} (${formatShort(
        input.startDate
      )} → ${formatShort(input.endDate)}).`
    : `${discountLabel} campaign — set the dates to see the schedule.`;

  return {
    ...input,
    status,
    badgeText,
    code,
    durationDays,
    warnings,
    conflicts,
    summary,
  };
}

export interface DurationPreset {
  id: string;
  label: string;
  days: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: 'weekend', label: 'Weekend', days: 2 },
  { id: '1w', label: '1 week', days: 6 },
  { id: '2w', label: '2 weeks', days: 13 },
  { id: '30d', label: '30 days', days: 29 },
  { id: '90d', label: '90 days', days: 89 },
];

/**
 * Resolves a preset into concrete dates. The 'weekend' preset snaps to the
 * coming Friday→Sunday; the others count forward from the start date.
 */
export function applyDurationPreset(
  presetId: string,
  startDate: string,
  today = new Date()
): { startDate: string; endDate: string } {
  if (presetId === 'weekend') {
    const base = parseDate(toDateOnly(today));
    const day = base.getDay(); // 0 Sun … 6 Sat
    const daysUntilFri = (5 - day + 7) % 7;
    const friday = addDays(base, daysUntilFri);
    return { startDate: friday, endDate: addDays(friday, 2) };
  }
  const preset = DURATION_PRESETS.find((p) => p.id === presetId);
  const days = preset ? preset.days : 13;
  return { startDate, endDate: addDays(startDate, days) };
}

export interface TimelineRow {
  id: string;
  label: string;
  leftPct: number;
  widthPct: number;
  tone: 'active' | 'upcoming' | 'expired' | 'planned' | 'conflict';
  isPlanned: boolean;
}

export interface Timeline {
  windowStart: string;
  windowEnd: string;
  ticks: { label: string; leftPct: number }[];
  rows: TimelineRow[];
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Lays out a Gantt-style schedule for a window of `spanDays` from today. Only
 * campaigns intersecting the window are included; the planned campaign is shown
 * as a distinct row and tinted 'conflict' when it clashes with another row.
 */
export function buildTimeline(
  existing: ShopPromotion[],
  planned: PlannerInput | null,
  opts: { today?: Date; spanDays?: number } = {}
): Timeline {
  const today = opts.today ?? new Date();
  const spanDays = opts.spanDays ?? 120;
  const windowStart = toDateOnly(today);
  const windowEnd = addDays(today, spanDays);
  const totalDays = daysBetween(windowStart, windowEnd) || 1;

  const pctOf = (dateStr: string): number => clampPct((daysBetween(windowStart, dateStr) / totalDays) * 100);

  const rows: TimelineRow[] = [];

  const conflictIds = new Set(
    planned
      ? existing
          .filter(
            (p) =>
              p.status !== 'expired' &&
              sharesCategory(p.eligibleCategories || [], planned.eligibleCategories) &&
              overlaps(planned.startDate, planned.endDate, p.startDate, p.endDate)
          )
          .map((p) => p.id)
      : []
  );

  for (const p of existing) {
    if (!overlaps(windowStart, windowEnd, p.startDate, p.endDate)) continue;
    const left = pctOf(p.startDate < windowStart ? windowStart : p.startDate);
    const right = pctOf(p.endDate > windowEnd ? windowEnd : p.endDate);
    rows.push({
      id: p.id,
      label: p.title,
      leftPct: left,
      widthPct: clampPct(right - left),
      tone: conflictIds.has(p.id) ? 'conflict' : p.status,
      isPlanned: false,
    });
  }

  if (planned) {
    const left = pctOf(planned.startDate < windowStart ? windowStart : planned.startDate);
    const right = pctOf(planned.endDate > windowEnd ? windowEnd : planned.endDate);
    rows.push({
      id: '__planned__',
      label: planned.title || 'New campaign',
      leftPct: left,
      widthPct: clampPct(right - left),
      tone: conflictIds.size ? 'conflict' : 'planned',
      isPlanned: true,
    });
  }

  const ticks: { label: string; leftPct: number }[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i <= 6; i++) {
    const tick = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1);
    if (daysBetween(windowStart, toDateOnly(tick)) > spanDays) break;
    ticks.push({
      label: tick.toLocaleDateString('en-GB', { month: 'short' }),
      leftPct: pctOf(toDateOnly(tick)),
    });
  }

  return { windowStart, windowEnd, ticks, rows };
}

export interface SuggestedWindow {
  startDate: string;
  endDate: string;
  days: number;
  label: string;
}

/**
 * Finds clear stretches (>= `minDays`) in the next `horizonDays` where no live
 * campaign is running, so a new promotion can be scheduled without clashing.
 */
export function suggestWindows(
  existing: ShopPromotion[],
  opts: { today?: Date; horizonDays?: number; minDays?: number; count?: number } = {}
): SuggestedWindow[] {
  const today = opts.today ?? new Date();
  const horizonDays = opts.horizonDays ?? 180;
  const minDays = opts.minDays ?? 7;
  const count = opts.count ?? 3;

  const live = existing.filter((p) => p.status !== 'expired');
  const busy = (dateStr: string): boolean =>
    live.some((p) => parseDate(p.startDate) <= parseDate(dateStr) && parseDate(dateStr) <= parseDate(p.endDate));

  const windows: SuggestedWindow[] = [];
  let runStart: string | null = null;

  for (let i = 0; i <= horizonDays; i++) {
    const dateStr = addDays(today, i);
    if (!busy(dateStr)) {
      if (!runStart) runStart = dateStr;
    } else if (runStart) {
      const days = daysBetween(runStart, addDays(today, i - 1)) + 1;
      if (days >= minDays) {
        windows.push({ startDate: runStart, endDate: addDays(today, i - 1), days, label: `From ${formatShort(runStart)}` });
      }
      runStart = null;
    }
    if (windows.length >= count) break;
  }
  if (windows.length < count && runStart) {
    const days = daysBetween(runStart, addDays(today, horizonDays)) + 1;
    if (days >= minDays) {
      windows.push({ startDate: runStart, endDate: addDays(today, horizonDays), days, label: `From ${formatShort(runStart)}` });
    }
  }

  return windows.slice(0, count);
}
