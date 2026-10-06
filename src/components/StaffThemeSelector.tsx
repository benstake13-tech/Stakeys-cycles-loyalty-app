import React, { useMemo, useState } from 'react';
import { Palette, Check, Loader2, Sparkles, CalendarClock } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  HOLIDAY_THEME_IDS,
  SeasonalThemeId,
  ThemeOverride,
  SEASONAL_THEME_LABELS,
  activeHoliday,
  upcomingHolidays,
  windowLabel,
} from '../utils/holidayCalendar';

const SWATCHES: Record<SeasonalThemeId, string> = {
  none: 'from-neutral-700 to-neutral-900',
  halloween: 'from-orange-500 to-purple-800',
  christmas: 'from-red-500 to-emerald-600',
  stpatricks: 'from-emerald-400 to-green-700',
  newyear: 'from-amber-300 to-indigo-700',
  valentines: 'from-pink-500 to-rose-600',
  easter: 'from-pink-400 to-sky-400',
  thanksgiving: 'from-amber-500 to-orange-800',
  cny: 'from-red-600 to-amber-400',
  midautumn: 'from-amber-300 to-rose-600',
  diwali: 'from-fuchsia-500 to-amber-400',
  holi: 'from-pink-400 to-lime-400',
  eidfitr: 'from-emerald-400 to-teal-700',
  eidadha: 'from-teal-500 to-emerald-800',
  hanukkah: 'from-blue-400 to-slate-100',
  cincodemayo: 'from-red-500 to-green-600',
};

/**
 * Seasonal theme control. "Auto" follows the 9-day holiday calendar; picking a
 * specific theme forces it everywhere. The choice is stored in one shared
 * Supabase row so every staff and customer device switches together.
 */
export const StaffThemeSelector = () => {
  const { seasonalTheme, seasonalOverride, setSeasonalTheme } = useShop();
  const [selected, setSelected] = useState<ThemeOverride>(seasonalOverride);
  const [isApplying, setIsApplying] = useState(false);

  const now = useMemo(() => new Date(), []);
  const active = useMemo(() => activeHoliday(now), [now]);
  const upcoming = useMemo(() => upcomingHolidays(now, 3), [now]);

  const themes: SeasonalThemeId[] = ['none', ...HOLIDAY_THEME_IDS];
  const dirty = selected !== seasonalOverride;

  const apply = async () => {
    setIsApplying(true);
    try {
      await setSeasonalTheme(selected);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-emerald-400" />
        <div>
          <div className="text-xs font-bold text-white">Seasonal theme</div>
          <div className="text-[10px] text-neutral-500">
            Applied to all accounts instantly · currently{' '}
            <span className="text-emerald-400">{SEASONAL_THEME_LABELS[seasonalTheme]}</span>
          </div>
        </div>
      </div>

      {/* Auto schedule status */}
      <div className="rounded-xl border border-neutral-800 bg-black p-2.5">
        <button
          type="button"
          onClick={() => setSelected('AUTO')}
          className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
            selected === 'AUTO'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
          }`}
        >
          <CalendarClock className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-neutral-200">
              Auto (holiday calendar)
            </span>
            <span className="block text-[10px] text-neutral-500">
              {active ? `${active.name} · ${windowLabel(active)}` : 'No holiday window active right now'}
            </span>
          </span>
          {selected === 'AUTO' && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
        </button>
        {upcoming.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {upcoming.map((o) => (
              <div
                key={`${o.theme}-${o.celebration.toISOString()}`}
                className="flex justify-between text-[10px] text-neutral-500"
              >
                <span>{o.name}</span>
                <span className="font-mono">{windowLabel(o)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelected(t)}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
              selected === t
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-neutral-800 bg-black hover:border-neutral-600'
            }`}
          >
            <span className={`h-5 w-5 shrink-0 rounded-md bg-gradient-to-br ${SWATCHES[t]}`} />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-neutral-200">
              {SEASONAL_THEME_LABELS[t]}
            </span>
            {selected === t && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
            {t === seasonalOverride && selected !== t && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Live" />
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={apply}
        disabled={isApplying || !dirty}
        className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {isApplying ? 'Applying to all accounts…' : dirty ? 'Apply theme to all accounts' : 'Theme applied'}
      </button>
    </div>
  );
};
