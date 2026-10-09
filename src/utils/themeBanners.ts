/**
 * Celebration banner copy + palette for each seasonal theme.
 *
 * Data only (no React) so the mapping is trivially testable and every theme is
 * covered by construction: the type keys onto `SeasonalThemeId`, and
 * `THEME_BANNERS` is a `Record<HolidayThemeId, ...>` so a new holiday without a
 * banner is a compile error.
 *
 * `short` is the compact label reused by the banner and by anything that needs a
 * one-word celebration name; `subtitle` is the friendly second line.
 */
import type { SeasonalThemeId } from './holidayCalendar';

/** Every concrete theme (everything except 'none'). */
export type HolidayThemeId = Exclude<SeasonalThemeId, 'none'>;

export interface ThemeBanner {
  /** Short celebration label, e.g. "Christmas". */
  short: string;
  /** Headline greeting, e.g. "Merry Christmas!". */
  greeting: string;
  /** Friendly supporting line shown under the greeting. */
  subtitle: string;
  /** Emoji used as the banner glyph. */
  emoji: string;
  /** Tailwind gradient + border + text classes for the banner shell. */
  gradient: string;
  border: string;
  text: string;
  /** Accent colour for the small "goes live" pill and progress fill. */
  accent: string;
  /** Confetti colours used when the banner is tapped. */
  confetti: string[];
}

/** One banner per concrete theme — exhaustive by type. */
export const THEME_BANNERS: Record<HolidayThemeId, ThemeBanner> = {
  halloween: {
    short: 'Halloween',
    greeting: 'Happy Halloween!',
    subtitle: 'Spooky season savings and treats all week long.',
    emoji: '🎃',
    gradient: 'from-orange-600 via-amber-500 to-purple-700',
    border: 'border-orange-400/50',
    text: 'text-white',
    accent: '#fb923c',
    confetti: ['#f97316', '#a855f7', '#22c55e', '#eab308'],
  },
  christmas: {
    short: 'Christmas',
    greeting: 'Merry Christmas!',
    subtitle: 'Ho, ho, ho — festive offers and a merry ride for all.',
    emoji: '🎄',
    gradient: 'from-red-700 via-red-500 to-emerald-600',
    border: 'border-red-400/50',
    text: 'text-white',
    accent: '#dc2626',
    confetti: ['#dc2626', '#16a34a', '#ffffff', '#facc15'],
  },
  stpatricks: {
    short: "St. Patrick's Day",
    greeting: "Happy St. Patrick's Day!",
    subtitle: 'Top of the morning — a bit of luck on every mile.',
    emoji: '🍀',
    gradient: 'from-emerald-700 via-green-500 to-emerald-400',
    border: 'border-emerald-300/50',
    text: 'text-white',
    accent: '#22c55e',
    confetti: ['#22c55e', '#15803d', '#ffffff', '#facc15'],
  },
  newyear: {
    short: "New Year's Eve",
    greeting: 'Happy New Year!',
    subtitle: "Here's to a bright new year of great rides.",
    emoji: '🎆',
    gradient: 'from-indigo-700 via-violet-600 to-fuchsia-600',
    border: 'border-violet-300/50',
    text: 'text-white',
    accent: '#8b5cf6',
    confetti: ['#8b5cf6', '#f59e0b', '#22d3ee', '#ffffff'],
  },
  valentines: {
    short: "Valentine's Day",
    greeting: "Happy Valentine's Day!",
    subtitle: 'Share the love — the perfect gift for the one who rides.',
    emoji: '❤️',
    gradient: 'from-rose-700 via-pink-500 to-rose-400',
    border: 'border-rose-300/50',
    text: 'text-white',
    accent: '#f43f5e',
    confetti: ['#f43f5e', '#ec4899', '#ffffff', '#fda4af'],
  },
  easter: {
    short: 'Easter',
    greeting: 'Happy Easter!',
    subtitle: 'Hop into spring with eggs-tra special deals.',
    emoji: '🐣',
    gradient: 'from-pink-400 via-sky-300 to-yellow-300',
    border: 'border-pink-300/50',
    text: 'text-white',
    accent: '#38bdf8',
    confetti: ['#f472b6', '#38bdf8', '#facc15', '#a7f3d0'],
  },
  thanksgiving: {
    short: 'Thanksgiving',
    greeting: 'Happy Thanksgiving!',
    subtitle: 'Grateful for every customer — feast on these deals.',
    emoji: '🦃',
    gradient: 'from-amber-700 via-orange-500 to-amber-400',
    border: 'border-amber-300/50',
    text: 'text-white',
    accent: '#f59e0b',
    confetti: ['#f59e0b', '#b45309', '#dc2626', '#fde68a'],
  },
  cny: {
    short: 'Chinese New Year',
    greeting: 'Happy Chinese New Year!',
    subtitle: 'Wishing you prosperity and joy for the year ahead.',
    emoji: '🏮',
    gradient: 'from-red-700 via-red-500 to-amber-400',
    border: 'border-red-300/50',
    text: 'text-white',
    accent: '#ef4444',
    confetti: ['#ef4444', '#f59e0b', '#facc15', '#ffffff'],
  },
  midautumn: {
    short: 'Mid-Autumn Festival',
    greeting: 'Happy Mid-Autumn Festival!',
    subtitle: 'Mooncakes, lanterns and a brilliant ride under the full moon.',
    emoji: '🥮',
    gradient: 'from-amber-600 via-yellow-500 to-indigo-500',
    border: 'border-amber-300/50',
    text: 'text-white',
    accent: '#eab308',
    confetti: ['#eab308', '#f59e0b', '#a855f7', '#ffffff'],
  },
  diwali: {
    short: 'Diwali',
    greeting: 'Happy Diwali!',
    subtitle: 'Wishing you a festival of lights full of joy and safety.',
    emoji: '🪔',
    gradient: 'from-fuchsia-700 via-orange-500 to-amber-400',
    border: 'border-fuchsia-300/50',
    text: 'text-white',
    accent: '#d946ef',
    confetti: ['#d946ef', '#f97316', '#facc15', '#ffffff'],
  },
  holi: {
    short: 'Holi',
    greeting: 'Happy Holi!',
    subtitle: 'May your days be as colourful as the festival of spring.',
    emoji: '🎨',
    gradient: 'from-fuchsia-500 via-yellow-400 to-cyan-400',
    border: 'border-yellow-300/50',
    text: 'text-white',
    accent: '#ec4899',
    confetti: ['#ec4899', '#facc15', '#22d3ee', '#a3e635'],
  },
  eidfitr: {
    short: 'Eid al-Fitr',
    greeting: 'Eid Mubarak!',
    subtitle: 'Wishing you and your family a joyful Eid al-Fitr.',
    emoji: '🌙',
    gradient: 'from-teal-700 via-emerald-500 to-amber-300',
    border: 'border-teal-300/50',
    text: 'text-white',
    accent: '#14b8a6',
    confetti: ['#14b8a6', '#10b981', '#facc15', '#ffffff'],
  },
  eidadha: {
    short: 'Eid al-Adha',
    greeting: 'Eid Mubarak!',
    subtitle: 'Warm wishes for a blessed Eid al-Adha.',
    emoji: '🌙',
    gradient: 'from-green-700 via-teal-500 to-emerald-300',
    border: 'border-green-300/50',
    text: 'text-white',
    accent: '#059669',
    confetti: ['#059669', '#14b8a6', '#facc15', '#ffffff'],
  },
  hanukkah: {
    short: 'Hanukkah',
    greeting: 'Happy Hanukkah!',
    subtitle: 'Eight nights of light — and a little extra cheer.',
    emoji: '🕎',
    gradient: 'from-blue-800 via-blue-600 to-sky-400',
    border: 'border-blue-300/50',
    text: 'text-white',
    accent: '#2563eb',
    confetti: ['#2563eb', '#0ea5e9', '#facc15', '#ffffff'],
  },
  cincodemayo: {
    short: 'Cinco de Mayo',
    greeting: 'Happy Cinco de Mayo!',
    subtitle: 'Fiesta time — celebrate with these seasonal deals.',
    emoji: '🎉',
    gradient: 'from-green-600 via-lime-500 to-red-500',
    border: 'border-lime-300/50',
    text: 'text-white',
    accent: '#84cc16',
    confetti: ['#84cc16', '#dc2626', '#facc15', '#ffffff'],
  },
};

/** The banner for a theme, or `null` for `'none'` / unknown inputs. */
export function themeBannerFor(theme: SeasonalThemeId | string | undefined | null): ThemeBanner | null {
  if (!theme || theme === 'none') return null;
  return THEME_BANNERS[theme as HolidayThemeId] ?? null;
}
