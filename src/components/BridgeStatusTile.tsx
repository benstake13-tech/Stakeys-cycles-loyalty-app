import React, { useCallback, useEffect, useState } from 'react';
import { Cable, CheckCircle2, AlertTriangle, Loader2, Wand2, ArrowUpRight } from 'lucide-react';
import {
  fetchBridgeDiagnostics,
  bridgeRepairInstalled,
  BridgeDiagnostics,
} from '../utils/appBridge';
import { repairAppBridge } from '../utils/authHealth';

type Status = 'checking' | 'healthy' | 'broken' | 'unreachable';

/**
 * The prominent member sign-in bridge control at the very top of the staff
 * home screen. It reads the live state of the two linked stores (loyalty
 * profiles <-> Supabase Auth logins) and repairs them in one click, so
 * "customers can't sign in" is fixed from the workstation without opening the
 * SQL Editor.
 */
export const BridgeStatusTile: React.FC<{ onOpenDetails?: () => void }> = ({ onOpenDetails }) => {
  const [diag, setDiag] = useState<BridgeDiagnostics | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>('checking');
  const [repairing, setRepairing] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const probe = useCallback(async () => {
    setStatus('checking');
    try {
      const [d, ok] = await Promise.all([fetchBridgeDiagnostics(), bridgeRepairInstalled()]);
      setDiag(d);
      setInstalled(ok);
      if (!d.reachable) setStatus('unreachable');
      else if (d.profilesWithoutLogin === 0 && d.unconfirmedLogins === 0) setStatus('healthy');
      else setStatus('broken');
    } catch {
      setStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  const handleRepair = async () => {
    setRepairing(true);
    setNotice(null);
    try {
      const res = await repairAppBridge();
      setNotice({ kind: res.success ? 'ok' : 'err', text: res.message });
      if (res.success) await probe();
    } finally {
      setRepairing(false);
    }
  };

  const unlinked = diag?.profilesWithoutLogin ?? 0;
  const unconfirmed = diag?.unconfirmedLogins ?? 0;

  const tone = {
    checking: { ring: 'border-white/10', dot: 'bg-neutral-400', text: 'text-neutral-300' },
    healthy: { ring: 'border-[#00FF66]/50', dot: 'bg-[#00FF66]', text: 'text-[#00FF66]' },
    broken: { ring: 'border-white/20', dot: 'bg-neutral-300', text: 'text-white' },
    unreachable: { ring: 'border-white/20', dot: 'bg-neutral-300', text: 'text-white' },
  }[status];

  const headline =
    status === 'checking'
      ? 'Checking the member sign-in bridge…'
      : status === 'unreachable'
      ? 'Can’t reach the backend — check the connection'
      : status === 'healthy'
      ? 'Member sign-in bridge is healthy — every customer can log in'
      : `${unlinked} member${unlinked === 1 ? '' : 's'} without a login · ${unconfirmed} unconfirmed`;

  return (
    <section
      data-testid="staff-bridge-tile"
      className="staff-bridge-panel relative overflow-hidden rounded-[18px] p-4 sm:p-5"
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[#00FF66]"
          >
            <Cable className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold tracking-tight text-white">
                Member Sign-In Bridge
              </h2>
              <span className="chip">
                <span className={`live-dot ${tone.text}`} />
                <span className="uppercase tracking-wider">
                  {status === 'checking' ? 'Checking' : status === 'healthy' ? 'Healthy' : status === 'broken' ? 'Needs repair' : 'Offline'}
                </span>
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
              {status === 'healthy' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00FF66]" />
              ) : status === 'broken' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-white" />
              ) : null}
              <span className="truncate">{headline}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="staff-bridge-repair"
            onClick={handleRepair}
            disabled={repairing}
            className="pressable inline-flex items-center gap-2 rounded-xl border border-[#00FF66] bg-[#00FF66] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#07100b] disabled:opacity-60"
            title="Confirm every stuck login and create a login for every member that has none — in one click."
          >
            {repairing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            <span>{repairing ? 'Repairing…' : 'Repair Bridge'}</span>
          </button>
          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="pressable inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-white hover:border-emerald-500/40 hover:bg-emerald-500/10"
            >
              <span>Details</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          data-testid="staff-bridge-notice"
          className={`relative z-10 mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
            notice.kind === 'ok'
              ? 'border-emerald-600/40 bg-emerald-950/40 text-emerald-200'
              : 'border-red-600/40 bg-red-950/40 text-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {installed === false && !notice && (
        <p className="relative z-10 mt-3 text-[11px] text-neutral-500">
          Tip: run the one-time <span className="font-mono text-neutral-300">Repair App Bridge</span> SQL once to
          unlock the full bridge report — the one-click repair above works either way.
        </p>
      )}
    </section>
  );
};

export default BridgeStatusTile;
