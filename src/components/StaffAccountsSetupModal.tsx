import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Database,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { staffAccountsInstalled } from '../api/backendDataService';
import { getStoredSupabaseUrl } from '../supabase';
// Bundled at build time so staff always copy the exact script this build expects.
import staffAccountsSql from '../../supabase/migrations/20261004_staff_accounts.sql?raw';

type Toast = { kind: 'ok' | 'err'; text: string } | null;

/**
 * Staff-facing control that hands over the staff-accounts migration SQL. The
 * anon key cannot run DDL, so staff paste the script into the Supabase SQL
 * Editor — the same hand-off used by SchemaSyncModal.
 */
export const StaffAccountsSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { refreshStaffAccounts } = useShop();

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const projectRef = useMemo(() => {
    const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
    return host || 'your-project';
  }, []);
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;
  const lineCount = staffAccountsSql.split('\n').length;

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setInstalled(await staffAccountsInstalled());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(staffAccountsSql);
      setCopied(true);
      flash({ kind: 'ok', text: 'Staff-accounts SQL copied — paste it into the Supabase SQL Editor and Run.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — open the SQL preview and copy manually.' });
      setShowSql(true);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await refreshStaffAccounts();
      await check();
      flash({ kind: 'ok', text: 'Staff accounts reloaded.' });
    } catch {
      flash({ kind: 'err', text: 'Could not reload staff accounts.' });
    } finally {
      setReloading(false);
    }
  };

  const healthy = installed === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Staff Account Setup</h3>
              <p className="text-xs text-neutral-400">
                Install the database functions the Staff Logins page needs.
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

        {/* Status */}
        <div
          className={`p-4 rounded-2xl border ${
            healthy
              ? 'bg-emerald-950/30 border-emerald-600/40'
              : installed === false
              ? 'bg-amber-950/25 border-amber-600/40'
              : 'bg-[#141820] border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {checking ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
              ) : healthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-sm">
                  {checking
                    ? 'Checking live project…'
                    : healthy
                    ? 'Staff accounts are installed — you can create logins'
                    : 'Staff account functions are not installed yet'}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {healthy
                    ? 'The Staff Logins tab is fully working.'
                    : 'Run the SQL below once, then reload.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>
        </div>

        {/* How to fix */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">How to fix</h4>
          </div>
          <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Copy the migration SQL below.</li>
            <li>Open the Supabase SQL Editor for this project.</li>
            <li>Paste it into a new query and click <strong>Run</strong> (it is safe to re-run).</li>
            <li>Come back here and press <strong>Reload Staff Accounts</strong>.</li>
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Migration SQL'}</span>
            </button>
            <a
              href={sqlEditorUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open Supabase SQL Editor</span>
            </a>
            <button
              type="button"
              onClick={handleReload}
              disabled={reloading}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {reloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{reloading ? 'Reloading…' : 'Reload Staff Accounts'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSql((v) => !v)}
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
            <span>{showSql ? 'Hide' : 'Preview'} migration SQL ({lineCount} lines)</span>
          </button>
          {showSql && (
            <pre className="max-h-64 overflow-auto text-[10px] leading-relaxed font-mono bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-300">
              {staffAccountsSql}
            </pre>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
          <span>
            The script only creates or replaces admin-gated functions and their grants — it never
            drops tables or deletes rows.
          </span>
        </div>

        {toast && (
          <div
            className={`text-xs px-3 py-2 rounded-xl border ${
              toast.kind === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
};
