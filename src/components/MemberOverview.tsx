import React, { useState } from 'react';
import { ArrowUpRight, Bike, CalendarDays, Check, ChevronRight, Copy, Crown, Gift, ScanLine, ShieldCheck, Wrench } from 'lucide-react';
import type { UserProfile } from '../types/bikeShop';

type MemberArea = 'garage' | 'wheel' | 'booking' | 'bookings' | 'stamps';

interface MemberOverviewProps {
  user: UserProfile;
  bikesCount: number;
  bookingsCount: number;
  onNavigate: (area: MemberArea) => void;
}

/** Shared editorial dashboard — identical component in web and Android editions. */
export const MemberOverview: React.FC<MemberOverviewProps> = ({ user, bikesCount, bookingsCount, onNavigate }) => {
  const [copied, setCopied] = useState(false);
  const stamps = Math.max(0, Math.min(10, user.stamps || 0));
  const membershipNumber = user.membershipNumber || 'Pending';
  const isComplete = stamps === 10;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(membershipNumber);
      setCopied(true);
    } catch {
      // Membership number remains visible when clipboard access is unavailable.
    }
  };

  const actions = [
    { id: 'booking' as const, label: 'Book a workshop visit', subtitle: 'Service, maintenance and repairs', icon: Wrench, number: '01' },
    { id: 'garage' as const, label: 'Your bike collection', subtitle: `${bikesCount} registered ${bikesCount === 1 ? 'ride' : 'rides'} in your garage`, icon: Bike, number: '02' },
    { id: 'bookings' as const, label: 'Track your repairs', subtitle: `${bookingsCount} ${bookingsCount === 1 ? 'booking' : 'bookings'} on your account`, icon: CalendarDays, number: '03' },
    { id: 'wheel' as const, label: 'Rewards & prize wheel', subtitle: 'Check your weekly spin', icon: Gift, number: '04' },
  ];

  return (
    <section aria-label="Membership and quick actions" className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      <div className="atelier-hero lg:col-span-7 p-6 sm:p-8 lg:p-9 text-white flex flex-col min-h-[410px]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 w-[370px] h-[370px] rounded-full border-[1px] border-white/10 shadow-[0_0_0_42px_rgba(179,255,214,.025),0_0_0_94px_rgba(179,255,214,.02)]" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="atelier-eyebrow flex items-center gap-2 text-[#aff5cd]"><Crown className="w-4 h-4" /> STAKEY'S CLUB <span className="text-white/35">/</span> MEMBER ACCESS</div>
            <h2 className="atelier-display text-3xl sm:text-4xl mt-4 max-w-sm">Every ride has its rewards.</h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50/65 max-w-sm">Your digital pass, built for every visit to the workshop.</p>
          </div>
          <div className="shrink-0 hidden sm:flex w-12 h-12 items-center justify-center border border-emerald-200/20 rounded-2xl bg-white/5 backdrop-blur"><ShieldCheck className="h-6 w-6 text-emerald-200" /></div>
        </div>

        <div className="mt-auto pt-9">
          <p className="atelier-eyebrow text-emerald-100/60">YOUR MEMBER NUMBER</p>
          <div className="flex items-center flex-wrap gap-3 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-[.055em] text-white break-all">{membershipNumber}</span>
            <button type="button" onClick={handleCopy} aria-label="Copy membership number" title="Copy membership number"
              className="p-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            {copied && <span className="text-xs text-emerald-200" role="status">Copied</span>}
          </div>

          <div className="mt-7 bg-black/15 border border-white/10 rounded-[22px] p-4 sm:p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="atelier-eyebrow text-emerald-100/65">{isComplete ? 'REWARD AVAILABLE' : 'YOUR NEXT MILESTONE'}</div>
                <div className="text-sm font-bold mt-1 text-white">{isComplete ? 'You have completed a stamp card.' : `${10 - stamps} more ${10 - stamps === 1 ? 'stamp' : 'stamps'} until your next reward`}</div>
              </div>
              <div className="text-right font-mono text-3xl font-bold text-[#a4ffd1]">{stamps}<span className="text-base text-white/40">/10</span></div>
            </div>
            <div className="grid grid-cols-10 gap-1.5" role="progressbar" aria-label="Visit stamp progress" aria-valuemin={0} aria-valuemax={10} aria-valuenow={stamps}>
              {Array.from({ length: 10 }, (_, index) => (
                <div key={index} className={`h-3 rounded-[5px] transition-colors ${index < stamps ? 'bg-gradient-to-r from-[#73ffc1] to-[#39d78a] shadow-[0_0_13px_rgba(69,238,150,.27)]' : 'bg-white/15'}`} />
              ))}
            </div>
            <button type="button" onClick={() => onNavigate('stamps')}
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-emerald-100 hover:text-white transition-colors">
              View your loyalty pass <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="atelier-surface lg:col-span-5 p-4 sm:p-6 text-white flex flex-col">
        <header className="px-2 pt-2 pb-4 flex items-start justify-between gap-3">
          <div>
            <p className="atelier-eyebrow">YOUR PERSONAL CONCIERGE</p>
            <h3 className="atelier-display text-2xl sm:text-[27px] mt-2">Where to next?</h3>
            <p className="text-xs text-neutral-400 mt-2">Everything you need in one place.</p>
          </div>
          <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200"><ScanLine className="w-5 h-5" /></div>
        </header>
        <div className="flex-1 grid content-center gap-1.5">
          {actions.map(({ id, label, subtitle, icon: Icon, number }) => (
            <button key={id} type="button" className="atelier-command group" onClick={() => onNavigate(id)}>
              <div className="atelier-command-icon"><Icon className="w-5 h-5" aria-hidden="true" /></div>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-extrabold tracking-tight text-white">{label}</span>
                <span className="block mt-1 text-[11px] sm:text-xs text-[#9cafa8] leading-snug">{subtitle}</span>
              </span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] font-mono text-neutral-600">{number}</span>
                <ChevronRight className="w-4 h-4 text-emerald-300/65 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 mx-2 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-500">
          <span>STAKEY'S CYCLES & SCOOTER</span>
          <span className="text-emerald-300/65 font-semibold">SALFORD, UK</span>
        </div>
      </div>
    </section>
  );
};
