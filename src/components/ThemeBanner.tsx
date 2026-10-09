import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useShop } from '../context/ShopContext';
import { themeBannerFor } from '../utils/themeBanners';

const DISMISS_PREFIX = 'stakeys_theme_banner_dismissed:';

/**
 * Site-wide celebration banner. When a seasonal theme is active (Halloween,
 * Christmas, Diwali, …) it shows that holiday's greeting across every screen on
 * all three surfaces. Renders nothing for the default 'none' theme.
 *
 * Dismissal is remembered per theme in localStorage, so closing the Halloween
 * banner doesn't suppress the Christmas one later.
 */
export const ThemeBanner: React.FC = () => {
  const { seasonalTheme } = useShop();
  const banner = themeBannerFor(seasonalTheme);
  const [dismissed, setDismissed] = useState(false);

  // Re-check the stored dismissal whenever the active theme changes.
  useEffect(() => {
    if (!banner) {
      setDismissed(false);
      return;
    }
    let stored = false;
    try {
      stored = localStorage.getItem(`${DISMISS_PREFIX}${seasonalTheme}`) === '1';
    } catch {
      /* no storage (SSR/tests) */
    }
    setDismissed(stored);
  }, [seasonalTheme, banner]);

  if (!banner || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${DISMISS_PREFIX}${seasonalTheme}`, '1');
    } catch {
      /* ignore */
    }
  };

  const celebrate = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.1 },
        colors: banner.confetti,
      });
    } catch {
      /* confetti unavailable */
    }
  };

  return (
    <div
      data-testid="theme-banner"
      role="region"
      aria-label={`${banner.short} announcement`}
      className={`relative overflow-hidden border-b ${banner.border} ${banner.text} font-['Plus_Jakarta_Sans',sans-serif] shrink-0`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-95`} />
      {/* Soft moving sheen so the banner feels alive without stealing focus. */}
      <div className="absolute inset-0 theme-banner-sheen opacity-25" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={celebrate}
          className="flex items-center gap-3 text-left group cursor-pointer min-w-0"
          title="Celebrate!"
        >
          <span className="text-2xl sm:text-[28px] leading-none shrink-0 drop-shadow group-hover:scale-110 transition-transform">
            {banner.emoji}
          </span>
          <span className="min-w-0">
            <span className="block font-black tracking-tight text-sm sm:text-base truncate">
              {banner.greeting}
            </span>
            <span className="block text-[11px] sm:text-xs text-white/85 truncate">
              {banner.subtitle}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={celebrate}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Celebrate</span>
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss banner"
            title="Dismiss banner"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
