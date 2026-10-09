/**
 * Seasonal hero/footer decor registry.
 *
 * Data only (no React) so the mapping is trivially testable and exhaustive: the
 * key type is `HolidayThemeId` and `THEME_DECOR` is a `Record<HolidayThemeId, …>`,
 * so adding a holiday without its decor is a compile error.
 *
 * Every theme carries the same *structure* — a swinging hero sign (two chains,
 * headline, subtext, corner webs, floating flyers, close button) and a footer
 * border (corner props, a repeated trail, floating spooks, dangling crawlers) —
 * and differs only by colour + emoji. To add a theme you:
 *   1. add an entry here (colours + copy + emoji), and
 *   2. add one `.<theme-id>` CSS block in `src/index.css` exposing the same
 *      `--theme-*` custom properties.
 * The shared CSS (.seasonal-hero-sign, .pendulum-swing, .seasonal-footer-trail,
 * …) then styles it with no component changes at all.
 */
import type { HolidayThemeId } from './themeBanners';

/** Palette + copy for one theme's decor. All colours are plain CSS values. */
export interface ThemeDecor {
  /** Headline on the swinging sign, e.g. "🎃 HAPPY HALLOWEEN! 🎃". */
  heading: string;
  /** Supporting line under the headline. */
  subtext: string;
  /** Accessible name for the hero region. */
  label: string;
  /** Corner-web / cobweb glyphs (one per corner). */
  web: string;
  /** Creatures that flutter around the sign (cycled, 4 slots). */
  flyers: string[];
  /** Spooky accents floating above the footer. */
  spooks: string[];
  /** Crawlers dangling near the footer corners. */
  crawlers: string[];
  /** Repeated candy/sweet trail glyphs. */
  trail: string[];
  /** Carved pumpkin / corner prop glyph. */
  cornerProp: string;
  /** Glow colour behind the sign (rgba). */
  glow: string;
}

export const THEME_DECOR: Record<HolidayThemeId, ThemeDecor> = {
  halloween: {
    heading: '🎃 HAPPY HALLOWEEN! 🎃',
    subtext: 'Spooky savings & eerie repairs await!',
    label: 'Halloween celebration',
    web: '🕸️',
    flyers: ['🦇', '🦇', '🦇', '🦇'],
    spooks: ['👻', '👻'],
    crawlers: ['🕷️', '🕸️'],
    trail: ['🍬', '🍭', '🍬', '🕸️', '🍬', '🍭'],
    cornerProp: '🎃',
    glow: 'rgba(57, 255, 20, 0.4)',
  },
  christmas: {
    heading: '🎄 MERRY CHRISTMAS! 🎄',
    subtext: 'Festive offers & a merry ride for all!',
    label: 'Christmas celebration',
    web: '❄️',
    flyers: ['❄️', '🎁', '❄️', '🔔'],
    spooks: ['⛄', '🦌'],
    crawlers: ['🔔', '🎀'],
    trail: ['🍬', '🎁', '🍬', '🔔', '🍬', '⭐'],
    cornerProp: '🎄',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  stpatricks: {
    heading: '🍀 HAPPY ST. PATRICK’S DAY! 🍀',
    subtext: 'A bit of luck on every mile!',
    label: "St. Patrick's Day celebration",
    web: '🍀',
    flyers: ['🍀', '🍀', '🍀', '🌈'],
    spooks: ['🍀', '🌈'],
    crawlers: ['🍀', '🎩'],
    trail: ['🍬', '🍀', '🍬', '🌈', '🍬', '🍭'],
    cornerProp: '🍀',
    glow: 'rgba(34, 197, 94, 0.4)',
  },
  newyear: {
    heading: '🎆 HAPPY NEW YEAR! 🎆',
    subtext: 'Here’s to a bright new year of great rides!',
    label: 'New Year celebration',
    web: '✨',
    flyers: ['🎆', '✨', '🎉', '🎆'],
    spooks: ['🥂', '🎊'],
    crawlers: ['✨', '🎊'],
    trail: ['🍬', '🎉', '🍬', '✨', '🍬', '🎊'],
    cornerProp: '🎆',
    glow: 'rgba(139, 92, 246, 0.4)',
  },
  valentines: {
    heading: '❤️ HAPPY VALENTINE’S DAY! ❤️',
    subtext: 'Share the love — the perfect gift for the one who rides!',
    label: "Valentine's Day celebration",
    web: '💕',
    flyers: ['❤️', '💘', '💕', '🌹'],
    spooks: ['💕', '🌹'],
    crawlers: ['💞', '🎀'],
    trail: ['🍬', '🍫', '🍬', '💝', '🍬', '🍭'],
    cornerProp: '❤️',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
  easter: {
    heading: '🐣 HAPPY EASTER! 🐣',
    subtext: 'Hop into spring with eggs-tra special deals!',
    label: 'Easter celebration',
    web: '🌷',
    flyers: ['🐣', '🐰', '🦋', '🌷'],
    spooks: ['🐰', '🐤'],
    crawlers: ['🐣', '🎀'],
    trail: ['🍬', '🥚', '🍬', '🐰', '🍬', '🍭'],
    cornerProp: '🐰',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
  thanksgiving: {
    heading: '🦃 HAPPY THANKSGIVING! 🦃',
    subtext: 'Grateful for every customer — feast on these deals!',
    label: 'Thanksgiving celebration',
    web: '🍂',
    flyers: ['🦃', '🍂', '🌾', '🦃'],
    spooks: ['🍁', '🌰'],
    crawlers: ['🍂', '🌾'],
    trail: ['🍬', '🥧', '🍬', '🌽', '🍬', '🍭'],
    cornerProp: '🦃',
    glow: 'rgba(245, 158, 11, 0.4)',
  },
  cny: {
    heading: '🏮 HAPPY CHINESE NEW YEAR! 🏮',
    subtext: 'Wishing you prosperity and joy for the year ahead!',
    label: 'Chinese New Year celebration',
    web: '🧧',
    flyers: ['🏮', '🧧', '🐉', '✨'],
    spooks: ['🧧', '🐲'],
    crawlers: ['🏮', '🧨'],
    trail: ['🍬', '🍊', '🍬', '🧧', '🍬', '🍭'],
    cornerProp: '🏮',
    glow: 'rgba(239, 68, 68, 0.4)',
  },
  midautumn: {
    heading: '🥮 HAPPY MID-AUTUMN FESTIVAL! 🥮',
    subtext: 'Mooncakes, lanterns and a brilliant ride under the full moon!',
    label: 'Mid-Autumn Festival celebration',
    web: '🌕',
    flyers: ['🥮', '🏮', '🌕', '✨'],
    spooks: ['🏮', '🌙'],
    crawlers: ['🏮', '🐇'],
    trail: ['🍬', '🥮', '🍬', '🏮', '🍬', '🍭'],
    cornerProp: '🥮',
    glow: 'rgba(234, 179, 8, 0.4)',
  },
  diwali: {
    heading: '🪔 HAPPY DIWALI! 🪔',
    subtext: 'A festival of lights full of joy and safety!',
    label: 'Diwali celebration',
    web: '✨',
    flyers: ['🪔', '✨', '🎆', '🪔'],
    spooks: ['🪔', '✨'],
    crawlers: ['✨', '🎆'],
    trail: ['🍬', '🍬', '🪔', '🍬', '✨', '🍭'],
    cornerProp: '🪔',
    glow: 'rgba(217, 70, 239, 0.4)',
  },
  holi: {
    heading: '🎨 HAPPY HOLI! 🎨',
    subtext: 'May your days be as colourful as the festival of spring!',
    label: 'Holi celebration',
    web: '🌈',
    flyers: ['🎨', '🌈', '💐', '🎨'],
    spooks: ['🌈', '💐'],
    crawlers: ['🎨', '💧'],
    trail: ['🍬', '🎨', '🍬', '🌈', '🍬', '🍭'],
    cornerProp: '🎨',
    glow: 'rgba(236, 72, 153, 0.4)',
  },
  eidfitr: {
    heading: '🌙 EID MUBARAK! 🌙',
    subtext: 'Wishing you and your family a joyful Eid al-Fitr!',
    label: 'Eid al-Fitr celebration',
    web: '✨',
    flyers: ['🌙', '⭐', '🏮', '✨'],
    spooks: ['🌙', '⭐'],
    crawlers: ['🌙', '🏮'],
    trail: ['🍬', '🍬', '🌙', '🍬', '⭐', '🍭'],
    cornerProp: '🌙',
    glow: 'rgba(20, 184, 166, 0.4)',
  },
  eidadha: {
    heading: '🌙 EID MUBARAK! 🌙',
    subtext: 'Warm wishes for a blessed Eid al-Adha!',
    label: 'Eid al-Adha celebration',
    web: '✨',
    flyers: ['🌙', '⭐', '🐑', '✨'],
    spooks: ['🌙', '⭐'],
    crawlers: ['🌙', '🏮'],
    trail: ['🍬', '🍬', '🌙', '🍬', '⭐', '🍭'],
    cornerProp: '🌙',
    glow: 'rgba(5, 150, 105, 0.4)',
  },
  hanukkah: {
    heading: '🕎 HAPPY HANUKKAH! 🕎',
    subtext: 'Eight nights of light — and a little extra cheer!',
    label: 'Hanukkah celebration',
    web: '✨',
    flyers: ['🕎', '✨', '🕯️', '⭐'],
    spooks: ['🕯️', '✨'],
    crawlers: ['🕎', '🕯️'],
    trail: ['🍬', '🍩', '🍬', '🕯️', '🍬', '🍭'],
    cornerProp: '🕎',
    glow: 'rgba(37, 99, 235, 0.4)',
  },
  cincodemayo: {
    heading: '🎉 HAPPY CINCO DE MAYO! 🎉',
    subtext: 'Fiesta time — celebrate with these seasonal deals!',
    label: 'Cinco de Mayo celebration',
    web: '🎊',
    flyers: ['🎉', '🌵', '🎊', '💃'],
    spooks: ['🎉', '🌮'],
    crawlers: ['🎊', '🌵'],
    trail: ['🍬', '🌮', '🍬', '🎉', '🍬', '🍭'],
    cornerProp: '🎉',
    glow: 'rgba(132, 204, 22, 0.4)',
  },
};

/** Decor for a theme, or `null` for `'none'` / unknown inputs. */
export function themeDecorFor(theme: string | undefined | null): ThemeDecor | null {
  if (!theme || theme === 'none') return null;
  return THEME_DECOR[theme as HolidayThemeId] ?? null;
}

/** localStorage key for a theme's hero-banner dismissal (per theme). */
export const decorDismissKey = (theme: string): string => `stakeys_seasonal_hero_dismissed:${theme}`;
