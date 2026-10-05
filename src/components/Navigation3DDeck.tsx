import React, { useState } from 'react';
import {
  Bike,
  User,
  Wrench,
  Tag,
  ShieldCheck,
  Search,
  RotateCw,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileText,
  Shield,
  Layers,
  CheckCircle2,
  Clock,
  Flame,
  Activity,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';

export type NavTabId =
  | 'customer'
  | 'booking'
  | 'tracker'
  | 'promotions'
  | 'bikes_we_trust'
  | 'hangers'
  | 'staff'
  | 'deliverables';

interface Navigation3DDeckProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  isStaff: boolean;
  onUnlockStaffPin: () => void;
}

interface NavCardConfig {
  id: NavTabId;
  title: string;
  badge: string;
  badgeColor: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  bgGlow: string;
  actionLabel: string;
  microTitle: string;
  microPoints: string[];
  microFootnote: string;
}

export const Navigation3DDeck: React.FC<Navigation3DDeckProps> = ({
  activeTab,
  onSelectTab,
  isStaff,
  onUnlockStaffPin,
}) => {
  const { currentUser, promotions, bookings, theme } = useShop();
  const isDark = theme === 'dark';
  const freshBookingsCount = isStaff
    ? bookings.filter((b) => b.status === 'pending' || b.approvalStatus === 'pending_approval').length
    : 0;

  // Flipped state per card: id -> boolean (flip 180° to reveal micro-content)
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleFlip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const activePromosCount = promotions.filter((p) => p.status === 'active').length;
  const pendingBookingsCount = bookings.filter((b) => b.status === 'pending').length;

  const CARDS: NavCardConfig[] = [
    {
      id: 'customer',
      title: isStaff ? 'Customer Garage & Pass' : 'My Garage & Loyalty Pass',
      badge: `${currentUser?.stamps || 0}/10 Stamps`,
      badgeColor: (currentUser?.stamps || 0) >= 10 ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      subtitle: 'Digital stamp rewards card, saved bikes, diagnostic records & weekly prize wheel.',
      icon: <User className="w-5 h-5 text-emerald-400" />,
      accentColor: '#05C147',
      bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
      actionLabel: 'Enter Garage',
      microTitle: 'Loyalty Pass & Rules',
      microPoints: [
        'Earn 1 visit stamp on every qualifying service or workshop intake.',
        '10 stamps unlocks a £40 Workshop Service Credit (labour only).',
        'Receive 1 free spin on the Weekly Prize Wheel every 7 days.',
      ],
      microFootnote: 'Barcode accepted at till scanner & front desk.',
    },
    {
      id: 'booking',
      title: 'Workshop Repair Booking',
      badge: pendingBookingsCount > 0 ? `${pendingBookingsCount} In Review` : 'Workshop Certified',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      subtitle: 'Schedule repairs, services & safety tune-ups with optional guest booking flow.',
      icon: <Wrench className="w-5 h-5 text-emerald-400" />,
      accentColor: '#10b981',
      bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
      actionLabel: 'Book Service',
      microTitle: 'Intake & Approval Policy',
      microPoints: [
        'Guests can book with just name & phone (no login needed).',
        'All repair bookings undergo workshop mechanic review.',
        'Seasonal tune-up packages: Winterization Check, Pre-Summer Safety Tune & e-scooter battery/brake audit.',
        'Automated email notification sent immediately when approved or declined.',
      ],
      microFootnote: 'Drop-off slots 09:00 - 17:30 Monday to Saturday.',
    },
    {
      id: 'tracker',
      title: 'Customer Repair Tracker',
      badge: 'Live Workshop Bench',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      subtitle: 'Real-time 5-stage workshop lifecycle, parts fitted, quality sign-off & invoice.',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      accentColor: '#05C147',
      bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
      actionLabel: 'Track Repair',
      microTitle: 'Live Telemetry Features',
      microPoints: [
        '5-Stage bench tracking: Booked, Diagnostics, Bench, Quality Control, Ready.',
        'View real-time itemized parts fitted, labour hours & auto-calculated invoice.',
        'Look up by Booking ID (#bk-...), customer phone number, or email address.',
      ],
      microFootnote: 'Updated live by workshop mechanics as work progresses.',
    },
    {
      id: 'promotions',
      title: 'Active Promotions',
      badge: `${activePromosCount} Active Now`,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      subtitle: 'Seasonal workshop discounts with live background date expiration monitor.',
      icon: <Tag className="w-5 h-5 text-amber-400" />,
      accentColor: '#f59e0b',
      bgGlow: 'from-amber-500/10 via-transparent to-transparent',
      actionLabel: 'View Offers',
      microTitle: 'Promotions Terms & Rules',
      microPoints: [
        'Valid for in-store bookings and online service intake.',
        'Discounts apply to labour charges; parts billed separately.',
        'Background expiration monitor swaps in upcoming promotions automatically.',
      ],
      microFootnote: 'One voucher or promotional code per booking.',
    },
    {
      id: 'bikes_we_trust',
      title: 'Bikes We Trust (£500–£1,200)',
      badge: 'Mechanic Picks',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      subtitle: 'High-value bikes from Halfords, Evans & Leisure Lakes tested by mechanics.',
      icon: <Bike className="w-5 h-5 text-sky-400" />,
      accentColor: '#0ea5e9',
      bgGlow: 'from-sky-500/10 via-transparent to-transparent',
      actionLabel: 'Inspect Bikes',
      microTitle: 'Independent Disclaimer',
      microPoints: [
        "Stakey's does NOT sell complete bikes or earn retail commissions.",
        'Recommendations are based solely on component durability and British weather.',
        'Features verified parts standards with replaceable derailleur hangers.',
      ],
      microFootnote: 'Independent maintenance & repair workshop.',
    },
    {
      id: 'hangers',
      title: 'Derailleur Hanger Identifier',
      badge: 'OEM & SRAM UDH',
      badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
      subtitle: 'High-accuracy lookup matching Brand, Model & Year against Wheels Mfg, Pilo & UDH.',
      icon: <Search className="w-5 h-5 text-violet-400" />,
      accentColor: '#8b5cf6',
      bgGlow: 'from-violet-500/10 via-transparent to-transparent',
      actionLabel: 'Identify Hanger',
      microTitle: 'Disambiguation Rules',
      microPoints: [
        'Validates mid-year revisions and frame material (Carbon vs. Alloy).',
        'Matches Thru-Axle standards (12x142, 12x148 Boost, QR 135mm).',
        'Includes OEM part numbers, torque specs, and diagram shapes.',
      ],
      microFootnote: 'Prevents frame damage from improper hanger pitch.',
    },
    {
      id: 'staff',
      title: isStaff ? 'Staff Command Terminal' : 'Staff Terminal (Locked)',
      badge: isStaff ? (freshBookingsCount > 0 ? `⚡ ${freshBookingsCount} FRESH JOBS` : 'Workshop Admin') : 'PIN Required',
      badgeColor: isStaff && freshBookingsCount > 0
        ? 'bg-amber-400 text-neutral-950 font-black border-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.85)]'
        : isStaff
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        : 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      subtitle: isStaff ? 'Roster CRUD, Promotions CRUD, Wheel Slices CRUD, Member Manager & Intake.' : 'Master workshop terminal with full workshop CRUD tools. Requires security PIN.',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      accentColor: '#05C147',
      bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
      actionLabel: isStaff ? 'Open Terminal' : 'Unlock PIN',
      microTitle: 'Staff Terminal Security',
      microPoints: [
        'Staff Roster: Add, edit, delete staff & assign roles & statuses.',
        'Promotions & Draws: Full CRUD for promotions, wheels & prize draws.',
        'Loyalty Member Manager: Manual search, +1 stamp, -1 stamp & account deletion.',
      ],
      microFootnote: 'workshop operations and till audit logging.',
    },
  ];

  return (
    <div className="w-full mb-8">
      {/* Deck Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#05C147] animate-pulse" />
            <h2 className={`font-display text-xs font-bold uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Interactive 3D Navigation Deck
            </h2>
          </div>
          <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-500'} mt-0.5`}>
            Click a card to navigate. Click <span className="font-semibold text-emerald-500">“Flip Info”</span> to view 3D micro-content &amp; rules without leaving.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className={`px-2.5 py-1 rounded-xl border ${isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-white border-neutral-200 text-neutral-600'} shadow-sm`}>
            Perspective: 1200px 3D
          </span>
        </div>
      </div>

      {/* 3D Cards Grid (3 columns on desktop, 2 on tablet, 1 on mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
        {CARDS.map((card) => {
          const isActive = activeTab === card.id;
          const isFlipped = !!flippedCards[card.id];

          const handleCardClick = () => {
            if (card.id === 'staff' && !isStaff) {
              onUnlockStaffPin();
            } else {
              onSelectTab(card.id);
            }
          };

          return (
            <div
              key={card.id}
              className="perspective-1200 h-[210px] w-full select-none"
            >
              <div
                className={`relative w-full h-full transform-style-3d transition-3d rounded-2xl cursor-pointer ${
                  isFlipped ? 'rotate-y-180' : 'rotate-y-0'
                } ${
                  isActive
                    ? isDark
                      ? 'shadow-3d-depth-hover ring-2 ring-[#05C147]'
                      : 'shadow-3d-light-hover ring-2 ring-[#05C147]'
                    : isDark
                    ? 'shadow-3d-depth hover:shadow-3d-depth-hover'
                    : 'shadow-3d-light hover:shadow-3d-light-hover'
                }`}
                onClick={handleCardClick}
              >
                {/* FRONT FACE OF 3D CARD */}
                <div
                  className={`absolute inset-0 backface-hidden rounded-2xl p-5 flex flex-col justify-between border transition-colors overflow-hidden ${
                    isActive
                      ? isDark
                        ? 'bg-neutral-900/95 border-emerald-500/70'
                        : 'bg-white border-emerald-500/70'
                      : isDark
                      ? 'bg-[#0e1217]/95 hover:bg-neutral-900/90 border-neutral-800/90 hover:border-neutral-700'
                      : 'bg-white/95 hover:bg-neutral-50/90 border-neutral-200/90 hover:border-neutral-300'
                  }`}
                >
                  {/* Subtle top background glow */}
                  <div
                    className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-40 bg-gradient-to-br ${card.bgGlow}`}
                  />

                  {/* Card Top Row: Icon + Badge + 3D Flip Trigger */}
                  <div className="relative z-10 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isDark
                            ? 'bg-neutral-950 border-neutral-800'
                            : 'bg-neutral-100 border-neutral-200'
                        } shadow-sm`}
                      >
                        {card.icon}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${card.badgeColor}`}
                      >
                        {card.badge}
                      </span>
                    </div>

                    {/* 3D Flip Trigger Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleFlip(card.id, e)}
                      title="Flip card 180° to read micro-content & rules"
                      className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-neutral-950/80 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-white'
                          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <RotateCw className="w-3 h-3 text-emerald-400" />
                      <span>Flip Info</span>
                    </button>
                  </div>

                  {/* Card Center: Title & Subtitle */}
                  <div className="relative z-10 my-1">
                    <h3
                      className={`font-display text-base font-extrabold tracking-tight line-clamp-1 ${
                        isActive
                          ? 'text-emerald-400'
                          : isDark
                          ? 'text-white'
                          : 'text-neutral-900'
                      }`}
                    >
                      {card.title}
                    </h3>
                    <p
                      className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                        isDark ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    >
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Card Bottom: Active Indicator & Action CTA */}
                  <div className="relative z-10 flex items-center justify-between pt-2 border-t border-neutral-800/50 dark:border-neutral-800/50 light:border-neutral-200 text-xs">
                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active View</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[11px] font-mono ${
                            isDark ? 'text-neutral-500' : 'text-neutral-400'
                          }`}
                        >
                          Select View
                        </span>
                      )}
                    </div>

                    <div
                      className={`flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider transition-transform group-hover:translate-x-1 ${
                        isActive
                          ? 'text-emerald-400'
                          : isDark
                          ? 'text-neutral-300'
                          : 'text-neutral-700'
                      }`}
                    >
                      <span>{card.actionLabel}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* BACK FACE OF 3D CARD (Revealed on 180° Flip) */}
                <div
                  className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl p-5 flex flex-col justify-between border transition-colors overflow-hidden ${
                    isDark
                      ? 'bg-[#0d1117] border-emerald-500/50 text-white'
                      : 'bg-neutral-50 border-emerald-500/50 text-neutral-900'
                  }`}
                >
                  {/* Top Bar with Micro Title & Flip Back */}
                  <div className="flex items-center justify-between border-b border-neutral-800 dark:border-neutral-800 light:border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {card.microTitle}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => toggleFlip(card.id, e)}
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                        isDark
                          ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                          : 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700 hover:text-neutral-900'
                      }`}
                    >
                      <RotateCw className="w-3 h-3 text-emerald-400" />
                      <span>Back</span>
                    </button>
                  </div>

                  {/* Micro Points List */}
                  <div className="space-y-1.5 my-auto text-[11px] leading-relaxed">
                    {card.microPoints.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
                        <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                          {point}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footnote and Launch View Button */}
                  <div className="pt-2 border-t border-neutral-800 dark:border-neutral-800 light:border-neutral-200 flex items-center justify-between text-[10px]">
                    <span className={`italic font-mono ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                      {card.microFootnote}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (card.id === 'staff' && !isStaff) {
                          onUnlockStaffPin();
                        } else {
                          onSelectTab(card.id);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold uppercase text-[10px] tracking-wider cursor-pointer shadow-sm"
                    >
                      Navigate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
