import React, { useState } from 'react';
import { ArrowUpRight, Bike, CalendarClock, Check, Copy, Crown, Gift, MoveUpRight, Wrench } from 'lucide-react';
import { UserProfile } from '../types/bikeShop';

type MemberArea = 'garage' | 'wheel' | 'booking' | 'bookings' | 'stamps';

interface MemberOverviewProps {
  user: UserProfile;
  bikesCount: number;
  bookingsCount: number;
  onNavigate: (area: MemberArea) => void;
}

export const MemberOverview: React.FC<MemberOverviewProps> = ({
  user,
  bikesCount,
  bookingsCount,
  onNavigate,
}) => {
  const [copied, setCopied] = useState(false);
  const stamps = Math.max(0, Math.min(10, user.stamps || 0));
  const code = user.membershipNumber || 'Membership pending';

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The member number remains visible to read aloud or present at the desk.
    }
  };

  return (
    <section aria-label="Your membership dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
      <div className="lg:col-span-7 relative isolate overflow-hidden rounded-[28px] border border-emerald-400/25 bg-[#0d201a] p-6 sm:p-8 text-white shadow-[0_24px_65px_-35px_rgba(16,185,129,0.35)]">
        <div aria-hidden="true" className="absolute -top-32 -right-20 w-80 h-80 rounded-full bg-emerald-400/15 blur-3xl" />
        <div aria-hidden="true" className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative z-10 flex flex-col h-full justify-between gap-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-300 text-[10px] font-black tracking-[0.22em] uppercase">
                <Crown className="h-4 w-4" /> Stakey's Club
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-3">Your loyalty pass.</h2>
              <p className="text-sm text-emerald-50/60 mt-1">Every visit moves you forward.</p>
            </div>
            <div className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-200/10 px-3 py-1.5 text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Active Member</div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-emerald-100/55">Membership Number</p>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.09em] text-white break-all">{code}</span>
              <button type="button" onClick={copyCode} aria-label="Copy membership number"
                className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-emerald-200 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              {copied && <span role="status" className="text-xs text-emerald-200">Copied</span>}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-2 mb-3">
              <span className="text-xs font-medium text-emerald-100/75">Journey to your next reward</span>
              <span className="text-white font-mono font-bold text-lg">{stamps}<span className="text-emerald-100/45 font-normal">/10</span></span>
            </div>
            <div className="grid grid-cols-10 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={stamps} aria-label="Loyalty stamps">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`h-2.5 rounded-full transition-colors ${i < stamps ? 'bg-[#40e59b] shadow-[0_0_12px_rgba(64,229,155,.45)]' : 'bg-white/15'}`} />
              ))}
            </div>
            <button type="button" onClick={() => onNavigate('stamps')} className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-200 hover:text-white transition-colors">
              View your rewards <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 rounded-[28px] bg-[#10151b] border border-white/10 p-5 sm:p-6 text-white flex flex-col">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">Quick access</p>
            <h3 className="font-display font-bold text-xl mt-1">What shall we do today?</h3>
          </div>
          <div className="rounded-full bg-white/5 border border-white/10 p-2.5 text-emerald-400"><MoveUpRight className="w-5 h-5" /></div>
        </div>

        <div className="divide-y divide-white/10 flex-1">
          <button type="button" onClick={() => onNavigate('booking')} className="group w-full text-left flex items-center gap-4 py-4 rounded-xl hover:px-2 transition-all">
            <span className="h-11 w-11 flex items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 border border-emerald-500/20"><Wrench className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block text-sm font-bold">Book a service</span><span className="block mt-0.5 text-xs text-neutral-400">Get your ride workshop-ready</span></span>
            <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-emerald-300" />
          </button>
          <button type="button" onClick={() => onNavigate('garage')} className="group w-full text-left flex items-center gap-4 py-4 rounded-xl hover:px-2 transition-all">
            <span className="h-11 w-11 flex items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300 border border-sky-500/15"><Bike className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block text-sm font-bold">My garage</span><span className="block mt-0.5 text-xs text-neutral-400">{bikesCount} registered {bikesCount === 1 ? 'bike' : 'bikes'}</span></span>
            <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-sky-300" />
          </button>
          <button type="button" onClick={() => onNavigate('bookings')} className="group w-full text-left flex items-center gap-4 py-4 rounded-xl hover:px-2 transition-all">
            <span className="h-11 w-11 flex items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 border border-amber-500/15"><CalendarClock className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block text-sm font-bold">Track my repairs</span><span className="block mt-0.5 text-xs text-neutral-400">{bookingsCount} {bookingsCount === 1 ? 'booking' : 'bookings'} in your history</span></span>
            <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-amber-300" />
          </button>
          <button type="button" onClick={() => onNavigate('wheel')} className="group w-full text-left flex items-center gap-4 py-4 rounded-xl hover:px-2 transition-all">
            <span className="h-11 w-11 flex items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300 border border-violet-500/15"><Gift className="h-5 w-5" /></span>
            <span className="flex-1"><span className="block text-sm font-bold">Prize wheel</span><span className="block mt-0.5 text-xs text-neutral-400">Check your weekly spin</span></span>
            <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-violet-300" />
          </button>
        </div>
      </div>
    </section>
  );
};
