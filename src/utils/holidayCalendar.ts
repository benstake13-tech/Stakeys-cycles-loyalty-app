/**
 * Holiday scheduling engine for the seasonal theme system.
 *
 * Reads `src/data/holidayCalendar.json` (fixed MM-DD dates + dynamic resolvers)
 * and answers two questions:
 *   1. Which holiday theme should be active on a given date (the 9-day window)?
 *   2. Given a manual override, what is the effective theme?
 *
 * Pure and deterministic — no React, no network — so it is trivially testable and
 * can also run on the server if we ever schedule emails around holidays.
 */
import calendarJson from '../data/holidayCalendar.json';
import {
  ResolverName,
  YearMonthDay,
  addDays,
  dateToYmd,
  resolveHolidayDate,
  startOfDay,
  ymdToDate,
} from './lunar';

export type SeasonalThemeId =
  | 'none'
  | 'halloween'
  | 'christmas'
  | 'stpatricks'
  | 'newyear'
  | 'valentines'
  | 'easter'
  | 'thanksgiving'
  | 'cny'
  | 'midautumn'
  | 'diwali'
  | 'holi'
  | 'eidfitr'
  | 'eidadha'
  | 'hanukkah'
  | 'cincodemayo'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'mayday'
  | 'springbank'
  | 'summerbank'
  | 'fathersday'
  | 'mothersday'
  | 'pancakes'
  | 'ramadan'
  | 'dussehra'
  | 'stgeorge'
  | 'aprilsfools'
  | 'earthday'
  | 'backtoschool'
  | 'bonfirenight'
  | 'remembranceday'
  | 'boxingday'
  | 'januarysales'
  | 'blackfriday'
  | 'cybermonday'
  | 'smallbusinesssaturday';

/** 'AUTO' follows the calendar; a concrete id forces that theme; null = AUTO. */
export type ThemeOverride = SeasonalThemeId | 'AUTO' | null;

interface HolidayDef {
  theme: string;
  name: string;
  month?: number;
  day?: number;
  resolver?: ResolverName;
  priority?: number;
  disabled?: boolean;
}

interface CalendarFile {
  window: { leadDays: number; trailDays: number };
  themes: Record<string, { label: string }>;
  holidays: HolidayDef[];
}

const CAL = calendarJson as unknown as CalendarFile;

export const WINDOW = CAL.window;

/** Labels for every theme, straight from the JSON so UI never hardcodes them. */
export const SEASONAL_THEME_LABELS = Object.fromEntries(
  Object.entries(CAL.themes).map(([id, meta]) => [id, meta.label])
) as Record<SeasonalThemeId, string>;

/** Concrete themes (everything except 'none'), used to populate selectors. */
export const HOLIDAY_THEME_IDS = Object.keys(CAL.themes).filter(
  (id): id is SeasonalThemeId => id !== 'none'
);

export const SEASONAL_THEME_IDS = ['none', ...HOLIDAY_THEME_IDS] as SeasonalThemeId[];

export function isSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return typeof value === 'string' && value in CAL.themes;
}

export interface HolidayOccurrence {
  theme: SeasonalThemeId;
  name: string;
  celebration: Date;
  /** Window opens here (celebration − leadDays). */
  start: Date;
  /** Window closes here (celebration + trailDays). */
  end: Date;
  priority: number;
}

/** Expand every enabled holiday into a concrete date window for one year. */
export function occurrencesForYear(year: number): HolidayOccurrence[] {
  const out: HolidayOccurrence[] = [];
  for (const h of CAL.holidays) {
    if (h.disabled) continue;
    if (!isSeasonalThemeId(h.theme)) continue;
    const ymd: YearMonthDay = resolveHolidayDate(h, year);
    const celebration = ymdToDate(ymd);
    out.push({
      theme: h.theme,
      name: h.name,
      celebration,
      start: addDays(celebration, -WINDOW.leadDays),
      end: addDays(celebration, WINDOW.trailDays),
      priority: h.priority ?? 0,
    });
  }
  return out;
}

const within = (date: Date, o: HolidayOccurrence) => date >= o.start && date <= o.end;

/**
 * The theme that should be active on `date`. A window can span a year boundary
 * (e.g. Christmas → New Year), so we scan the neighbouring years too. When two
 * windows overlap we take the higher priority, then the nearest celebration.
 */
export function activeHoliday(date: Date = new Date()): HolidayOccurrence | null {
  const day = startOfDay(date);
  const year = day.getUTCFullYear();
  const candidates = [
    ...occurrencesForYear(year - 1),
    ...occurrencesForYear(year),
    ...occurrencesForYear(year + 1),
  ].filter((o) => within(day, o));

  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return Math.abs(a.celebration.getTime() - day.getTime()) - Math.abs(b.celebration.getTime() - day.getTime());
  });
  return candidates[0];
}

/**
 * Effective theme given a manual override. `'AUTO'`/`null` falls back to the
 * calendar; a concrete theme id is honoured regardless of the date.
 */
export function resolveTheme(override: ThemeOverride, date: Date = new Date()): SeasonalThemeId {
  if (override && override !== 'AUTO') return isSeasonalThemeId(override) ? override : 'none';
  return activeHoliday(date)?.theme ?? 'none';
}

/** The next `count` upcoming holidays (by celebration date) from `date`. */
export function upcomingHolidays(date: Date = new Date(), count = 4): HolidayOccurrence[] {
  const day = startOfDay(date);
  const year = day.getUTCFullYear();
  const all = [...occurrencesForYear(year), ...occurrencesForYear(year + 1)];
  return all
    .filter((o) => o.celebration >= day)
    .sort((a, b) => a.celebration.getTime() - b.celebration.getTime())
    .slice(0, count);
}

/** Human window summary, e.g. "24 Oct – 2 Nov" (used by the staff selector). */
export function windowLabel(o: HolidayOccurrence): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(o.start)} – ${fmt(o.end)}`;
}

export { dateToYmd };
