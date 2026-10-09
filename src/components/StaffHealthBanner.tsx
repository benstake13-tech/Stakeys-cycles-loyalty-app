import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Stethoscope, Wrench } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { AREA_LABELS, BootScanSummary, runBootScan } from '../utils/featureDiagnostics';
import { resolveRepairTarget } from '../utils/repairTargets';
import { executeRepairTarget } from '../utils/repairRunner';

/**
 * Boot-time health banner.
 *
 * On every entry to the staff app it quietly runs the Test Bench scan once and
 * reports the result: a green "all healthy" line, or an amber/red banner whose
 * single Fix button is rebuilt each boot from the resolved repair target (open
 * the Supabase SQL Editor with copy-ready SQL, repair push + open OneSignal, or
 * jump to notification settings). The scan never blocks first paint.
 */
export const StaffHealthBanner: React.FC<{ onOpenTestBench: () => void }> = ({ onOpenTestBench }) => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const [summary, setSummary] = useState<BootScanSummary | null>(null);
  const [scanning, setScanning] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Fire exactly once per staff-app entry, not on every re-render.
  const scanned = useRef(false);

  useEffect(() => {
    if (scanned.current) return;
    scanned.current = true;
    let cancelled = false;
    (async () => {
      try {
        const result = await runBootScan();
        if (!cancelled) setSummary(result);
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const target = summary?.failingArea
    ? resolveRepairTarget({
        area: summary.failingArea,
        tables: Array.from(new Set(summary.problems.flatMap((p) => p.tables ?? []))),
        id: summary.problems[0]?.id,
      })
    : null;

  const handleFix = async () => {
    if (!target) return;
    setFixing(true);
    try {
      await executeRepairTarget(target, {
        copySql: (sql) => {
          void navigator.clipboard?.writeText?.(sql);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        },
        onEmail: onOpenTestBench,
      });
    } finally {
      setFixing(false);
    }
  };

  const shell = isDark ? 'bg-[#0b0e13] border-neutral-800' : 'bg-white border-neutral-200';
  const strong = isDark ? 'text-white' : 'text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-600';

  if (scanning) {
    return (
      <div
        data-testid="staff-health-banner"
        data-state="scanning"
        className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold ${shell} ${muted}`}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Scanning the station for issues…</span>
      </div>
    );
  }

  if (!summary) return null;

  if (summary.healthy) {
    return (
      <button
        type="button"
        onClick={onOpenTestBench}
        data-testid="staff-health-banner"
        data-state="healthy"
        className={`flex w-full items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-xs font-semibold ${shell} ${muted} cursor-pointer hover:border-emerald-500/40`}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        <span className={strong}>All systems healthy</span>
        <span>· {summary.counts.pass} checks passed</span>
        <Activity className="ml-auto h-3.5 w-3.5" />
      </button>
    );
  }

  const { fail, warn } = summary.counts;
  const tone = fail > 0 ? 'rose' : 'amber';
  const border = tone === 'rose' ? 'border-rose-500/50' : 'border-amber-500/50';
  const bg = tone === 'rose' ? 'bg-rose-500/10' : 'bg-amber-500/10';
  const iconColor = tone === 'rose' ? 'text-rose-400' : 'text-amber-400';

  return (
    <div
      data-testid="staff-health-banner"
      data-state={tone}
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${bg} ${border}`}
    >
      <AlertTriangle className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${strong}`}>
          {fail} issue{fail === 1 ? '' : 's'}
          {warn > 0 ? ` (+${warn} warning${warn === 1 ? '' : 's'})` : ''} found
          {summary.failingArea ? ` · ${AREA_LABELS[summary.failingArea]}` : ''}
        </p>
        {summary.problems[0] && (
          <p className={`mt-0.5 truncate text-xs ${muted}`}>{summary.problems[0].label}: {summary.problems[0].detail}</p>
        )}
      </div>
      {target && (
        <button
          type="button"
          onClick={handleFix}
          disabled={fixing}
          data-testid="staff-health-fix"
          className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-40"
        >
          {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          {fixing ? 'Fixing…' : target.label}
        </button>
      )}
      <button
        type="button"
        onClick={onOpenTestBench}
        className={`pressable inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${isDark ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800/60' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}
      >
        <Stethoscope className="h-3.5 w-3.5" /> Test Bench
      </button>
      {copied && <span className="text-[10px] font-bold text-emerald-400">Repair SQL copied</span>}
    </div>
  );
};

export default StaffHealthBanner;
