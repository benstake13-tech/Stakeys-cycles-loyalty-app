import React, { useState } from 'react';
import {
  Bike,
  Star,
  ExternalLink,
  Shield,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wrench,
  Sparkles,
  Filter,
} from 'lucide-react';
import { TRUSTED_BIKES_RECOMMENDATIONS } from '../data/trustedBikesData';
import { TrustedBikeRecommendation } from '../types/bikeShop';
import { useShop } from '../context/ShopContext';

export const BikesWeTrustSection: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRetailer, setSelectedRetailer] = useState<string>('All');
  const [flippedBikes, setFlippedBikes] = useState<Record<string, boolean>>({});

  const handleToggleFlip = (bikeId: string) => {
    setFlippedBikes((prev) => ({
      ...prev,
      [bikeId]: !prev[bikeId],
    }));
  };

  const categories = ['All', 'Gravel', 'Commuter', 'Mountain', 'Hybrid'];
  const retailers = ['All', 'Halfords', 'Evans Cycles', 'Leisure Lakes Bikes'];

  const filteredBikes = TRUSTED_BIKES_RECOMMENDATIONS.filter((b) => {
    if (selectedCategory !== 'All' && b.category !== selectedCategory) return false;
    if (selectedRetailer !== 'All' && b.retailer !== selectedRetailer) return false;
    return true;
  });

  return (
    <section className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1.5 uppercase tracking-wider">
            <Wrench className="w-3.5 h-3.5" />
            <span>Independent Workshop Tested &amp; Approved</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white dark:text-white light:text-neutral-900 tracking-tight">
            Bikes We Trust (£500 – £1,200)
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-400 light:text-neutral-600 mt-1 max-w-2xl leading-relaxed">
            Unbiased, mechanic-verified picks from major British retailers (Halfords, Evans Cycles, Leisure Lakes). High-durability frames, service-friendly component standards, and immense value for British weather.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-neutral-900/90 dark:bg-neutral-900/90 light:bg-neutral-100 border border-neutral-800 dark:border-neutral-800 light:border-neutral-200 text-neutral-300 dark:text-neutral-300 light:text-neutral-700 font-mono">
            <strong>{filteredBikes.length}</strong> Recommended Models
          </span>
        </div>
      </div>

      {/* Mandatory Independent Mechanic Disclaimer Box */}
      <div className="p-4 rounded-2xl bg-amber-950/30 dark:bg-amber-950/30 light:bg-amber-50 border border-amber-500/40 text-amber-200 dark:text-amber-200 light:text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div className="flex-1 text-[11px] sm:text-xs leading-relaxed">
          <strong className="block font-bold mb-0.5 text-amber-300 dark:text-amber-300 light:text-amber-950">
            Independent Mechanic Review Disclaimer:
          </strong>
          Stakey's Cycles &amp; Scooter is an independent maintenance atelier. We <strong>do not sell these complete bikes</strong> or receive sales commissions from Halfords, Evans Cycles, or Leisure Lakes. These models are chosen solely because their bearings, derailleur hangers, bottom brackets, and brake calipers hold up exceptionally well on our repair benches.
        </div>
      </div>

      {/* Filters: Category & Retailer */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-neutral-900/80 dark:bg-neutral-900/80 light:bg-neutral-100 border border-neutral-800 dark:border-neutral-800 light:border-neutral-200 text-xs">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-neutral-400 dark:text-neutral-400 light:text-neutral-600 font-semibold px-2">Type:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-neutral-950 shadow-sm font-bold'
                  : 'text-neutral-400 dark:text-neutral-400 light:text-neutral-600 hover:text-white dark:hover:text-white light:hover:text-neutral-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Retailer Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400 dark:text-neutral-400 light:text-neutral-600 font-semibold text-[11px]">Retailer:</span>
          <select
            value={selectedRetailer}
            onChange={(e) => setSelectedRetailer(e.target.value)}
            className="bg-neutral-950 dark:bg-neutral-950 light:bg-white border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 text-white dark:text-white light:text-neutral-900 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {retailers.map((r) => (
              <option key={r} value={r}>
                {r === 'All' ? 'All Retailers' : r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3D Depth Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBikes.map((bike) => {
          const isFlipped = !!flippedBikes[bike.id];

          return (
            <div
              key={bike.id}
              className="perspective-1200 h-[480px] w-full cursor-pointer select-none group"
              onClick={() => handleToggleFlip(bike.id)}
            >
              {/* 3D Rotating Card Container */}
              <div
                className={`relative w-full h-full transform-style-3d transition-3d ${
                  isFlipped ? 'rotate-y-180' : 'rotate-y-0'
                }`}
              >
                {/* CARD FRONT FACE */}
                <div
                  className={`absolute inset-0 backface-hidden rounded-2xl border flex flex-col justify-between overflow-hidden shadow-3d-depth hover:shadow-3d-depth-hover transition-all ${
                    isDark
                      ? 'bg-[#0d1015] border-neutral-800 text-white'
                      : 'bg-white border-neutral-300 text-neutral-900 shadow-3d-light hover:shadow-3d-light-hover'
                  }`}
                >
                  <div>
                    {/* Bike Image Banner with Retailer & Category badges */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-950">
                      <img
                        src={bike.imageUrl}
                        alt={bike.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-900/90 text-white backdrop-blur-md border border-neutral-700/80 font-mono">
                          {bike.category}
                        </span>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500 text-neutral-950">
                          {bike.retailer}
                        </span>
                      </div>

                      {/* Price Tag in Bottom Corner */}
                      <div className="absolute bottom-3 right-3 text-right">
                        <span className="text-[10px] text-neutral-300 uppercase font-mono block">Typical RRP</span>
                        <span className="text-xl font-black text-white font-mono drop-shadow-md">
                          £{bike.price}
                        </span>
                      </div>

                      {/* Mechanic Score */}
                      <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-neutral-700/60">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold text-white">{bike.mechanicRating.toFixed(1)}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">/ 5.0</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div>
                        <div className="text-[11px] font-mono text-emerald-400 font-semibold">{bike.brand}</div>
                        <h3 className="font-display text-base font-bold text-white dark:text-white light:text-neutral-900 mt-0.5 leading-snug">
                          {bike.name}
                        </h3>
                      </div>

                      <div className="p-2.5 rounded-xl bg-neutral-950/70 dark:bg-neutral-950/70 light:bg-neutral-100 border border-neutral-800 dark:border-neutral-800 light:border-neutral-200 text-xs">
                        <span className="text-[10px] text-neutral-400 uppercase font-mono block mb-1">Best Application</span>
                        <p className="text-neutral-200 dark:text-neutral-200 light:text-neutral-800 text-[11px] leading-snug">
                          {bike.bestFor}
                        </p>
                      </div>

                      {/* Quick Spec Pills */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="bg-neutral-900/60 dark:bg-neutral-900/60 light:bg-neutral-50 p-2 rounded-lg border border-neutral-800/80 dark:border-neutral-800/80 light:border-neutral-200">
                          <span className="text-[10px] text-neutral-400 block font-mono">Drivetrain</span>
                          <span className="font-medium text-white dark:text-white light:text-neutral-900 line-clamp-1">{bike.groupset}</span>
                        </div>
                        <div className="bg-neutral-900/60 dark:bg-neutral-900/60 light:bg-neutral-50 p-2 rounded-lg border border-neutral-800/80 dark:border-neutral-800/80 light:border-neutral-200">
                          <span className="text-[10px] text-neutral-400 block font-mono">Brakes</span>
                          <span className="font-medium text-white dark:text-white light:text-neutral-900 line-clamp-1">{bike.brakes}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="p-4 pt-0">
                    <div className="w-full py-2 px-3 rounded-xl bg-neutral-900 dark:bg-neutral-900 light:bg-neutral-100 hover:bg-emerald-500/20 border border-neutral-800 dark:border-neutral-800 light:border-neutral-300 text-emerald-400 text-xs font-bold flex items-center justify-between transition-colors">
                      <span className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Flip for Mechanic Inspection Notes</span>
                      </span>
                      <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                    </div>
                  </div>
                </div>

                {/* CARD BACK FACE (Mechanic Deep-Dive, Strengths, Watch-Outs, External retailer link) */}
                <div
                  className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl p-5 border flex flex-col justify-between overflow-hidden shadow-3d-depth ${
                    isDark
                      ? 'bg-neutral-950 border-emerald-500/50 text-neutral-200'
                      : 'bg-neutral-900 border-emerald-600 text-neutral-100'
                  }`}
                >
                  <div className="space-y-3 overflow-y-auto pr-1">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <div>
                        <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold">Mechanic Inspection</span>
                        <h4 className="text-sm font-bold text-white line-clamp-1">{bike.name}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFlip(bike.id);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-white bg-neutral-800"
                        title="Flip back to front"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Frame & Component Spec */}
                    <div className="text-[11px] space-y-1 bg-neutral-900/90 p-2.5 rounded-xl border border-neutral-800">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Frame:</span>
                        <span className="text-white font-medium">{bike.frameMaterial}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Groupset:</span>
                        <span className="text-white font-medium line-clamp-1">{bike.groupset}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Braking:</span>
                        <span className="text-white font-medium line-clamp-1">{bike.brakes}</span>
                      </div>
                    </div>

                    {/* Why We Trust It (Key Strengths) */}
                    <div>
                      <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold block mb-1">
                        ✓ Workshop Strengths
                      </span>
                      <ul className="space-y-1 text-[11px] text-neutral-300 leading-snug">
                        {bike.keyStrengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* What to Watch Out For */}
                    <div>
                      <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block mb-1">
                        ⚠ Mechanic Watch-Outs
                      </span>
                      <ul className="space-y-1 text-[11px] text-neutral-300 leading-snug">
                        {bike.watchOuts.map((w, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Workshop Verdict */}
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 leading-relaxed italic">
                      "{bike.mechanicVerdict}"
                    </div>
                  </div>

                  {/* External Retailer Reference Link */}
                  <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Sold at {bike.retailer} (~£{bike.price})
                    </span>
                    <a
                      href={bike.retailerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                    >
                      <span>Check at {bike.retailer}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
