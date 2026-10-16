import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Command, Scan, Search, ShieldCheck, Wifi } from 'lucide-react';

export interface CommandBarProps {
  operatorName: string;
  membershipNumber?: string;
  /** Fresh, unreviewed bookings awaiting bench intake. */
  freshCount: number;
  activeJobs: number;
  /** Whether push notifications are enabled on this device. */
  pushEnabled: boolean;
  pushState: 'idle' | 'working' | 'granted' | 'blocked';
  onEnablePush: () => void;
  onScan: () => void;
  /** Open the shared searchable app drawer. */
  onOpenApps: () => void;
}

const fmtClock = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDay = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * The staff command bar: brand identity, a live clock, the operator badge,
 * station status chips and access to the searchable app drawer.
 */
export const CommandBar: React.FC<CommandBarProps> = ({
  operatorName,
  membershipNumber,
  freshCount,
  activeJobs,
  pushEnabled,
  pushState,
  onEnablePush,
  onScan,
  onOpenApps,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000 * 20);
    return () => window.clearInterval(id);
  }, []);

  const pushLabel =
    pushState === 'working' ? 'Enabling…' : pushEnabled ? 'Push On' : 'Enable Push';

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, [now]);

  return (
    <section
      data-testid="staff-command-bar"
      className="staff-command-bar relative overflow-hidden rounded-[18px] p-4 sm:p-5"
    >
      <div className="relative z-10 flex flex-col gap-4">
        {/* Row 1 — identity + live readouts */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center text-[#00FF66]">
              <Command className="h-7 w-7" strokeWidth={1.55} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-white leading-none">
                STAKEY&apos;S <span className="text-[#00FF66]">CYCLES</span>
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                <Command className="h-3 w-3 text-[#00FF66]" />
                Command Station
                <span aria-hidden="true" className="text-neutral-700">·</span>
                Workshop Terminal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip text-emerald-300">
              <span className="live-dot" />
              STATION
            </span>
            <span className="chip font-mono tabular-nums" title={fmtDay(now)}>
              {fmtClock(now)}
            </span>
            <span className="chip hidden sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-white">{operatorName}</span>
              {membershipNumber && (
                <span className="font-mono text-[10px] text-neutral-500">#{membershipNumber}</span>
              )}
            </span>
          </div>
        </div>

        <div className="hairline" />

        {/* Row 2 — search + quick actions */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <button type="button" onClick={onOpenApps} aria-label="Open staff apps" aria-haspopup="dialog"
            className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#0d1310]/70 px-4 py-3 text-left text-sm text-neutral-300 hover:border-emerald-400/50">
            <Search size={18} aria-hidden="true" /><span>Find an app…</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onScan}
              className="pressable inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <Scan className="h-4 w-4 text-emerald-400" />
              <span>Scan Member</span>
            </button>
            <button
              type="button"
              disabled={pushState === 'working' || pushEnabled}
              onClick={onEnablePush}
              className={`pressable inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-colors ${
                pushEnabled
                  ? 'cursor-default border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-white hover:border-emerald-500/40 hover:bg-emerald-500/10'
              }`}
            >
              {pushEnabled ? <Wifi className="h-4 w-4" /> : <Bell className="h-4 w-4 text-emerald-400" />}
              <span>{pushLabel}</span>
            </button>
          </div>
        </div>

        {/* Row 3 — status strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${activeJobs > 0 ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
            {activeJobs} active job{activeJobs === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${freshCount > 0 ? 'bg-[#00FF66]' : 'bg-neutral-600'}`} />
            {freshCount} fresh request{freshCount === 1 ? '' : 's'}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-neutral-500">
            {greeting}, {operatorName.split(' ')[0]}
          </span>
        </div>
      </div>
    </section>
  );
};

export default CommandBar;
