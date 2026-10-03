import React, { useState } from 'react';
import { Palette, Check, Loader2, Sparkles } from 'lucide-react';
import {
  useShop,
  SeasonalThemeId,
  SEASONAL_THEME_LABELS,
} from '../context/ShopContext';

const SWATCHES: Record<SeasonalThemeId, string> = {
  none: 'from-neutral-700 to-neutral-900',
  halloween: 'from-orange-500 to-purple-700',
  christmas: 'from-red-500 to-emerald-600',
  easter: 'from-pink-400 to-sky-400',
  cny: 'from-red-600 to-amber-400',
  valentines: 'from-pink-500 to-rose-600',
};

/**
 * Seasonal theme control. Selecting a theme and pressing "Apply theme" writes a
 * single shared row to Supabase, so every account (this one, other staff and
 * every customer device) switches over seamlessly — no per-device setting.
 */
export const StaffThemeSelector = () => {
  const { seasonalTheme, setSeasonalTheme } = useShop();
  const [selected, setSelected] = useState<SeasonalThemeId>(seasonalTheme);
  const [isApplying, setIsApplying] = useState(false);

  const themes = Object.keys(SEASONAL_THEME_LABELS) as SeasonalThemeId[];
  const dirty = selected !== seasonalTheme;

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
            {t === seasonalTheme && selected !== t && (
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
