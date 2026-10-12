import React, { useState } from 'react';
import {
  Sparkles,
  Tag,
  Clock,
  RotateCw,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ShopPromotion } from '../types/bikeShop';

interface PromotionsCarouselProps {
  onSelectPromoCode?: (code: string) => void;
}

export const PromotionsCarousel: React.FC<PromotionsCarouselProps> = ({ onSelectPromoCode }) => {
  const { promotions, theme } = useShop();
  const isDark = theme === 'dark';

  // Flipped state tracker for 3D dual-state cards (id -> boolean)
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming'>('active');

  const handleToggleFlip = (promoId: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [promoId]: !prev[promoId],
    }));
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
    if (onSelectPromoCode) {
      onSelectPromoCode(code);
    }
  };

  const filteredPromos = promotions.filter((p) => {
    if (statusFilter === 'active') return p.status === 'active';
    if (statusFilter === 'upcoming') return p.status === 'upcoming';
    return p.status !== 'expired'; // 'all' displays both active and upcoming
  });

  return (
    <section className="space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header with Background Monitor indicator & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-neutral-800/60 dark:border-neutral-800/60 light:border-neutral-200">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="atelier-display text-[22px] sm:text-[27px] text-white tracking-tight">
                Exclusive Workshop Promotions
              </h2>
              {/* Background Expiration Monitor Pulse Indicator */}
              <span
                title="Automated background expiration monitor continuously verifies valid promotion dates"
                className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Date Sync
              </span>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-400 light:text-neutral-600">
              Curated offers for the Stakey’s Cycles community. Explore each offer to view its full terms.
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="atelier-segment self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
              aria-pressed={statusFilter === 'active'}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-500 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 dark:text-neutral-400 light:text-neutral-600 hover:text-white dark:hover:text-white light:hover:text-neutral-900'
            }`}
          >
            Active Now ({promotions.filter((p) => p.status === 'active').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
              aria-pressed={statusFilter === 'upcoming'}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'upcoming'
                ? 'bg-emerald-500 text-neutral-950 font-bold shadow-sm'
                : 'text-neutral-400 dark:text-neutral-400 light:text-neutral-600 hover:text-white dark:hover:text-white light:hover:text-neutral-900'
            }`}
          >
            Upcoming ({promotions.filter((p) => p.status === 'upcoming').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter === 'all'}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-neutral-800 dark:bg-neutral-800 light:bg-white text-white dark:text-white light:text-neutral-900 shadow-sm'
                : 'text-neutral-400 dark:text-neutral-400 light:text-neutral-600 hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Promotions 3D Cards Grid */}
      {filteredPromos.length === 0 ? (
        <div className="atelier-surface p-8 text-center text-neutral-400 text-xs">
          No promotions match the selected filter at this moment. Check back soon!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredPromos.map((promo) => {
            const isFlipped = !!flippedCards[promo.id];
            const isExpired = promo.status === 'expired';
            const isUpcoming = promo.status === 'upcoming';

            return (
              <div
                key={promo.id}
                className="perspective-1200 h-[310px] w-full cursor-pointer select-none group"
                onClick={() => handleToggleFlip(promo.id)}
              >
                {/* 3D Card Container that rotates on Y axis */}
                <div
                  className={`relative w-full h-full transform-style-3d transition-3d ${
                    isFlipped ? 'rotate-y-180' : 'rotate-y-0'
                  }`}
                >
                  {/* FRONT FACE OF 3D CARD */}
                  <div
                    className={`atelier-offer absolute inset-0 backface-hidden p-6 border flex flex-col justify-between overflow-hidden ${isDark ? 'text-white' : 'bg-white text-neutral-900'}`}
                  >
                    {/* Atmospheric glow backdrop */}
                    <div
                      className={`absolute -top-16 -right-16 w-36 h-36 rounded-full blur-2xl pointer-events-none opacity-30 ${
                        isUpcoming
                          ? 'bg-amber-500'
                          : promo.discountPercentage
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                    />

                    <div>
                      {/* Top Meta Strip: Status badge & 3D Flip trigger prompt */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            isExpired
                              ? 'bg-neutral-800 text-neutral-400'
                              : isUpcoming
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isExpired ? 'bg-neutral-500' : isUpcoming ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                          />
                          {promo.badgeText}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFlip(promo.id);
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-neutral-400 hover:text-white dark:hover:text-white light:hover:text-neutral-900 bg-neutral-800/80 dark:bg-neutral-800/80 light:bg-neutral-200 flex items-center gap-1 transition-colors"
                          title="Click to flip card and view Terms & Conditions"
                        >
                          <RotateCw className="w-3 h-3 text-emerald-400" />
                          <span>Terms ↻</span>
                        </button>
                      </div>

                      {/* Main Title & Subtitle */}
                      <h3 className="atelier-display text-xl sm:text-[22px] text-white leading-snug line-clamp-2">
                        {promo.title}
                      </h3>
                      <p className="text-xs text-neutral-400 dark:text-neutral-400 light:text-neutral-600 mt-1.5 line-clamp-2">
                        {promo.subtitle}
                      </p>
                    </div>

                    {/* Bottom Zone: Discount Tag, Coupon code with 1-click copy */}
                    <div className="pt-3 border-t border-neutral-800/80 dark:border-neutral-800/80 light:border-neutral-200 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Benefit</span>
                          <span className="atelier-display text-[22px] text-[#a4ffd3]">
                            {promo.discountPercentage
                              ? `${promo.discountPercentage}% OFF`
                              : promo.discountAmount
                              ? `£${promo.discountAmount} VOUCHER`
                              : 'SPECIAL BONUS'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Valid Dates</span>
                          <span className="text-[11px] font-mono text-neutral-300 dark:text-neutral-300 light:text-neutral-700">
                            {promo.startDate.slice(5)} to {promo.endDate.slice(5)}
                          </span>
                        </div>
                      </div>

                      {/* Coupon Code Pill */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2.5 rounded-2xl bg-black/30 border border-emerald-200/15 flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-white dark:text-white light:text-neutral-900 tracking-wider">
                            {promo.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(promo.code, e)}
                            className="p-1 rounded text-neutral-400 hover:text-emerald-400 transition-colors"
                            title="Copy voucher code"
                          >
                            {copiedCode === promo.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {copiedCode === promo.code ? 'Copied!' : 'Click to flip'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE OF 3D CARD (Terms & Conditions, Rules, Exclusions) */}
                  <div
                    className="atelier-offer absolute inset-0 backface-hidden rotate-y-180 p-6 border flex flex-col justify-between overflow-y-auto text-neutral-100"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Terms &amp; Workshop Rules</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFlip(promo.id);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                        >
                          Front ↺
                        </button>
                      </div>

                      <div className="text-[11px] font-mono text-neutral-400 mb-2">
                        Promo Ref: <strong>{promo.code}</strong>
                      </div>

                      {/* Terms Bullet Points */}
                      <ul className="space-y-1.5 text-[11px] text-neutral-300 leading-snug max-h-[140px] overflow-y-auto pr-1">
                        {promo.termsAndConditions.map((term, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{term}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span>Eligible: {promo.eligibleCategories.join(', ').toUpperCase()}</span>
                      <span className="text-emerald-400">Click anywhere to flip back</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
