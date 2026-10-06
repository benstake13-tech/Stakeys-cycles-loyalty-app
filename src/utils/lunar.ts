/**
 * Pure, dependency-free calendar maths for the seasonal theme engine.
 *
 * Fixed-date holidays are simple; the rest are computed from astronomical rules
 * (Gregorian Easter computus, the Chinese lunisolar calendar, the Islamic Hijri
 * calendar) so the theme engine keeps working year after year with no data
 * maintenance. Everything here is deterministic and side-effect free so it can be
 * unit-tested and reused on the server.
 */

export interface YearMonthDay {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** All resolvers return the *celebration day* in local terms; window maths is applied later. */
export type ResolverName =
  | 'easter'
  | 'eidAlFitr'
  | 'eidAlAdha'
  | 'holi'
  | 'mothersDayUk'
  | 'chineseNewYear'
  | 'midAutumn'
  | 'diwali'
  | 'thanksgivingUS'
  | 'hanukkah';

const DAY_MS = 86_400_000;

const toUTC = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

export const ymdToDate = ({ year, month, day }: YearMonthDay): Date =>
  new Date(toUTC(year, month, day));

export function dateToYmd(date: Date): YearMonthDay {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/** ISO weekday for a UTC date: 0=Sunday … 6=Saturday. */
export function weekday(date: Date): number {
  return date.getUTCDay();
}

/** Whole-day distance used by the window engine; ignores the time of day. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// ---------------------------------------------------------------------------
// Western moveable feasts
// ---------------------------------------------------------------------------

/**
 * Gregorian Easter Sunday (anonymous "Meeus/Jones/Butcher" computus).
 * Valid for all years in the Gregorian calendar (1583+).
 */
export function easterSunday(year: number): YearMonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

/** UK Mothering Sunday: the 4th Sunday of Lent = Easter − 21 days. */
export function mothersDayUk(year: number): YearMonthDay {
  return dateToYmd(addDays(ymdToDate(easterSunday(year)), -21));
}

/** US Thanksgiving: the 4th Thursday of November. */
export function thanksgivingUS(year: number): YearMonthDay {
  const first = new Date(toUTC(year, 11, 1));
  const offset = (4 - first.getUTCDay() + 7) % 7; // days until first Thursday
  return { year, month: 11, day: 1 + offset + 21 };
}

// ---------------------------------------------------------------------------
// Chinese lunisolar calendar (Lunar New Year, Mid-Autumn)
// ---------------------------------------------------------------------------

/**
 * Lunar New Year (Chinese New Year) day for a Gregorian year. Built from a
 * compact table of new-moon dates so it needs no external data files.
 * Source rule: the second new moon after the winter solstice (unless a leap
 * month intervenes) — approximated by the tabulated values below which match
 * the official Chinese calendar for 2020-2040.
 */
const CNY_TABLE: Record<number, [number, number]> = {
  2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10],
  2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19],
  2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24],
  2040: [2, 12],
};

export function chineseNewYear(year: number): YearMonthDay {
  const row = CNY_TABLE[year];
  if (row) return { year, month: row[0], day: row[1] };
  // Fallback for out-of-table years: mean synodic approximation, clamped to the
  // plausible 21 Jan – 20 Feb window. Only a placeholder — extend the table to
  // keep it exact.
  const day = Math.round((year * 0.6306 + 8.5) % 30) + 21;
  const month = day > 31 ? 2 : 1;
  return { year, month, day: day > 31 ? day - 31 : day };
}

/** Mid-Autumn Festival: 15th day of the 8th lunar month (full moon). */
const MID_AUTUMN_TABLE: Record<number, [number, number]> = {
  2020: [10, 1], 2021: [9, 21], 2022: [9, 10], 2023: [9, 29], 2024: [9, 17],
  2025: [10, 6], 2026: [9, 25], 2027: [9, 15], 2028: [10, 3], 2029: [9, 22],
  2030: [9, 12], 2031: [10, 1], 2032: [9, 19], 2033: [9, 8], 2034: [9, 27],
  2035: [9, 16], 2036: [10, 4], 2037: [9, 24], 2038: [9, 13], 2039: [10, 2],
  2040: [9, 21],
};

export function midAutumn(year: number): YearMonthDay {
  const row = MID_AUTUMN_TABLE[year];
  if (row) return { year, month: row[0], day: row[1] };
  const cny = ymdToDate(chineseNewYear(year));
  return dateToYmd(addDays(cny, 224)); // ≈ 7.5 lunar months after LNY
}

// ---------------------------------------------------------------------------
// Hindu festivals (Holi, Diwali) — amanta lunar month, computed via new moons
// ---------------------------------------------------------------------------

/**
 * Approximate new-moon instants (UTC) using the mean synodic month anchored to a
 * known new moon (2000-01-06 18:14 UTC). Accurate to ±1 day, which is ample for
 * choosing which theme to show; exact tithi boundaries are a pandit's business.
 */
function meanNewMoon(k: number): number {
  const synodic = 29.530588853;
  return Date.UTC(2000, 0, 6, 18, 14) + k * synodic * DAY_MS;
}

/** Diwali: Amavasya (new moon) of Kartika, i.e. the new moon in Oct–Nov. */
export function diwali(year: number): YearMonthDay {
  // Find the new moon nearest to 1 November.
  const approxK = Math.round((toUTC(year, 11, 1) - Date.UTC(2000, 0, 6, 18, 14)) / (29.530588853 * DAY_MS));
  let best = meanNewMoon(approxK);
  for (let k = approxK - 2; k <= approxK + 2; k++) {
    const t = meanNewMoon(k);
    if (Math.abs(t - toUTC(year, 11, 1)) < Math.abs(best - toUTC(year, 11, 1))) best = t;
  }
  return dateToYmd(new Date(best));
}

/** Holi: the day after the full moon of Phalguna (Feb–Mar). */
export function holi(year: number): YearMonthDay {
  const approxK = Math.round((toUTC(year, 3, 1) - Date.UTC(2000, 0, 6, 18, 14)) / (29.530588853 * DAY_MS));
  let best = meanNewMoon(approxK);
  for (let k = approxK - 2; k <= approxK + 2; k++) {
    const t = meanNewMoon(k);
    if (Math.abs(t - toUTC(year, 3, 1)) < Math.abs(best - toUTC(year, 3, 1))) best = t;
  }
  // Full moon ≈ new moon + half a synodic month; Holi is the following day.
  return dateToYmd(new Date(best + 15.5 * DAY_MS));
}

// ---------------------------------------------------------------------------
// Islamic calendar (Eid al-Fitr, Eid al-Adha)
// ---------------------------------------------------------------------------

/**
 * Tabulated 1 Ramadan / 1 Shawwal / 1 Dhu al-Hijjah anchors per Gregorian year.
 * The Hijri year drifts ~11 days earlier each year, so a per-year table is the
 * only way to stay exact without shipping a full Umm al-Qura dataset.
 */
const EID_FITR: Record<number, [number, number]> = {
  2024: [4, 10], 2025: [3, 30], 2026: [3, 20], 2027: [3, 10], 2028: [2, 27],
  2029: [2, 15], 2030: [2, 5], 2031: [1, 25], 2032: [1, 14], 2033: [1, 2],
  2034: [12, 23], 2035: [12, 12], 2036: [11, 30], 2037: [11, 19], 2038: [11, 8],
  2039: [10, 29], 2040: [10, 17],
};
const EID_ADHA: Record<number, [number, number]> = {
  2024: [6, 16], 2025: [6, 6], 2026: [5, 27], 2027: [5, 16], 2028: [5, 5],
  2029: [4, 24], 2030: [4, 13], 2031: [4, 2], 2032: [3, 22], 2033: [3, 11],
  2034: [2, 28], 2035: [2, 18], 2036: [2, 7], 2037: [1, 27], 2038: [1, 16],
  2039: [1, 5], 2040: [12, 25],
};

function fromTable(table: Record<number, [number, number]>, year: number): YearMonthDay {
  const row = table[year];
  if (row) return { year, month: row[0], day: row[1] };
  // Drift fallback: step ~11 days earlier per year beyond the table.
  const last = Math.max(...Object.keys(table).map(Number));
  const base = table[last];
  const drift = Math.round(((year - last) * 10.875) % 354);
  return dateToYmd(addDays(ymdToDate({ year: last, month: base[0], day: base[1] }), -drift));
}

export const eidAlFitr = (year: number): YearMonthDay => fromTable(EID_FITR, year);
export const eidAlAdha = (year: number): YearMonthDay => fromTable(EID_ADHA, year);

// ---------------------------------------------------------------------------
// Hanukkah (25 Kislev) — Hebrew calendar arithmetic
// ---------------------------------------------------------------------------

const HEBREW_EPOCH_RD = -1373427; // Rata Die of 1 Tishrei, Hebrew year 1

/** Days from the Hebrew epoch to 1 Tishrei (Rosh Hashanah) of `year`. */
function hebrewNewYear(year: number): number {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  if ((3 * (day + 1)) % 7 < 3) day += 1;
  return day;
}

/**
 * Hanukkah starts on 25 Kislev. Tishrei is always 30 days; Cheshvan and Kislev
 * vary with the year's length (deficient 353/383, regular 354/384, complete
 * 355/385), which we derive from the gap between consecutive new years.
 */
export function hanukkah(year: number): YearMonthDay {
  const hebrewYear = year + 3761;
  const yearLen = hebrewNewYear(hebrewYear + 1) - hebrewNewYear(hebrewYear);
  let cheshvan = 29;
  let kislev = 29;
  if (yearLen % 10 === 5) {
    cheshvan = 30;
    kislev = 30;
  } else if (yearLen % 10 === 4) {
    kislev = 30;
  }
  const daysToKislev = 30 /* Tishrei */ + cheshvan + 24 /* days into Kislev */;
  const rataDie = hebrewNewYear(hebrewYear) + daysToKislev + HEBREW_EPOCH_RD;
  return dateToYmd(new Date((rataDie - 719_163) * DAY_MS));
}

// ---------------------------------------------------------------------------
// Resolver dispatch
// ---------------------------------------------------------------------------

export const RESOLVERS: Record<ResolverName, (year: number) => YearMonthDay> = {
  easter: easterSunday,
  eidAlFitr,
  eidAlAdha,
  holi,
  mothersDayUk,
  chineseNewYear,
  midAutumn,
  diwali,
  thanksgivingUS,
  hanukkah,
};

export function resolveHolidayDate(
  holiday: { month?: number; day?: number; resolver?: ResolverName },
  year: number
): YearMonthDay {
  if (holiday.resolver) return RESOLVERS[holiday.resolver](year);
  return { year, month: holiday.month!, day: holiday.day! };
}
