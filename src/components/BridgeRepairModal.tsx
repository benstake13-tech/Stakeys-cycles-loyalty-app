import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Cable,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Database,
  Link2,
  Unlink,
} from 'lucide-react';
import {
  fetchBridgeDiagnostics,
  bridgeRepairInstalled,
  BridgeDiagnostics,
} from '../utils/appBridge';
import { getStoredSupabaseUrl } from '../supabase';
// Bundled at build time so staff always copy the exact script this build ships.
import bridgeSql from '../../supabase/migrations/20261006_repair_app_bridge.sql?raw';

type Toast = { kind: 'ok' | 'err'; text: string } | null;

/**
 * Staff-facing control that hands over the app-bridge repair SQL. The website
 * and customer app write loyalty `profiles`; the staff terminal and Supabase
 * Auth own the logins. When the confirmation email is broken the two stores
 * drift apart and customers get "invalid credentials" — this modal shows the
 * gap and hands over the script that re-links them.
 */
export const BridgeRepairModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [diag, setDiag] = useState<BridgeDiagnostics | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const projectRef = useMemo(() => {
    const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
    return host || 'your-project';
  }, []);
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;
  const lineCount = bridgeSql.split('\n').length;

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4500);
  };

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const [d, ok] = await Promise.all([fetchBridgeDiagnostics(), bridgeRepairInstalled()]);
      setDiag(d);
      setInstalled(ok);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bridgeSql);
      setCopied(true);
      flash({ kind: 'ok', text: 'Bridge repair SQL copied — paste it into the Supabase SQL Editor and Run.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — open the SQL preview and copy manually.' });
      setShowSql(true);
    }
  };

  const unlinked = diag?.profilesWithoutLogin ?? 0;
  const unconfirmed = diag?.unconfirmedLogins ?? 0;
  const bridgeHealthy = diag?.reachable === true && installed === true && unlinked === 0 && unconfirmed === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Cable className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Repair App Bridge</h3>
              <p className="text-xs text-neutral-400">
                Re-link website &amp; customer loyalty profiles to staff-side Supabase logins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Bridge status */}
        <div
          className={`p-4 rounded-2xl border ${
            bridgeHealthy
              ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
              : 'bg-[#141820] border-neutral-800 text-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {bridgeHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <span className="font-bold text-sm truncate">
                {!diag?.reachable
                  ? 'Supabase unreachable — check the connection first'
                  : bridgeHealthy
                  ? 'Bridge healthy — every member can sign in'
                  : `${unlinked} member${unlinked === 1 ? '' : 's'} without a login · ${unconfirmed} unconfirmed login${unconfirmed === 1 ? '' : 's'}`}
              </span>
            </div>
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Re-check the bridge"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>

          {diag?.error && (
            <p className="text-[11px] text-amber-300 mt-2 font-mono truncate">{diag.error}</p>
          )}
        </div>

        {/* Diagnostics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Stat label="Loyalty profiles" value={diag?.loyaltyProfiles} tone="neutral" />
          <Stat label="Auth logins" value={diag?.authLogins} tone="neutral" />
          <Stat label="Unconfirmed logins" value={unconfirmed} tone={unconfirmed > 0 ? 'warn' : 'ok'} />
          <Stat label="Members w/o login" value={unlinked} tone={unlinked > 0 ? 'bad' : 'ok'} />
          <Stat label="Logins w/o profile" value={diag?.loginsWithoutProfile} tone={(diag?.loginsWithoutProfile ?? 0) > 0 ? 'warn' : 'ok'} />
          <Stat
            label="Repair functions"
            value={installed === null ? undefined : installed ? 'Installed' : 'Missing'}
            tone={installed ? 'ok' : 'bad'}
            text
          />
        </div>

        {/* What the script does */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-2.5">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              What the fresh SQL does
            </h4>
          </div>
          <ul className="text-[11px] text-neutral-400 space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-neutral-200">Confirms every unconfirmed login</strong> — the exact reason
              customers get “invalid credentials” when the confirmation email never arrives.
            </li>
            <li>
              <strong className="text-neutral-200">Backfills a confirmed login</strong> for every member profile that
              has none, reusing the profile’s uuid so the two stores line up.
            </li>
            <li>
              <strong className="text-neutral-200">Installs link_member_login()</strong> to repair one member at a time,
              plus bridge_diagnostics() for this report.
            </li>
            <li>
              <strong className="text-neutral-200">Re-asserts</strong> the profile↔auth trigger, grants and RLS, so new
              signups stay linked.
            </li>
            <li className="text-amber-300/90">
              Backfilled logins share the default password <strong>Stakeys123!</strong> — tell customers to reset it
              after their first sign-in.
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-md shadow-sky-500/20 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : installed ? 'Re-copy Repair SQL' : 'Copy Repair SQL'}</span>
          </button>
          <a
            href={sqlEditorUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-bold cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-sky-400" />
            <span>Open Supabase SQL Editor</span>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setShowSql((s) => !s)}
          className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
          <span>{showSql ? 'Hide' : 'Preview'} SQL ({lineCount} lines)</span>
        </button>

        {showSql && (
          <pre className="max-h-72 overflow-auto rounded-2xl bg-neutral-950 border border-neutral-800 p-4 text-[10px] leading-relaxed font-mono text-neutral-300 whitespace-pre">
            {bridgeSql}
          </pre>
        )}

        {installed === false && (
          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
            <Unlink className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              The repair functions are not on this project yet, so the report can only show profile counts. Run the
              script once to unlock the full bridge diagnostics and the one-time repair.
            </div>
          </div>
        )}

        {toast && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              toast.kind === 'ok'
                ? 'bg-emerald-950/40 border border-emerald-600/40 text-emerald-200'
                : 'bg-red-950/40 border border-red-600/40 text-red-200'
            }`}
          >
            {toast.text}
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <Database className="w-3 h-3" />
          <span className="font-mono truncate">Project: {projectRef}</span>
          {checking && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{
  label: string;
  value?: number | string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  text?: boolean;
}> = ({ label, value, tone, text }) => {
  const toneClass = {
    ok: 'text-emerald-300 border-emerald-600/30 bg-emerald-950/20',
    warn: 'text-amber-300 border-amber-600/30 bg-amber-950/20',
    bad: 'text-red-300 border-red-600/30 bg-red-950/20',
    neutral: 'text-neutral-200 border-neutral-800 bg-[#0a0d11]',
  }[tone];

  return (
    <div className={`p-3 rounded-xl border ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
      <div className={`mt-0.5 font-black ${text ? 'text-sm' : 'text-xl'} font-mono`}>
        {value === undefined ? '—' : value}
      </div>
    </div>
  );
};
