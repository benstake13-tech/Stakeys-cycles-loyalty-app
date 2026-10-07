import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DatabaseZap,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Wrench,
  ChevronDown,
  ShieldCheck,
  Cable,
  Activity,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  auditLiveSchema,
  generateSchemaSyncSql,
  SchemaAuditReport,
} from '../utils/schemaSync';
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
 * One control to sync the live schema, re-link the app bridge and reconnect.
 *
 * Replaces the separate "Fix Database Schema" and "Repair App Bridge" buttons:
 * it audits the Supabase project against the schema the app expects, reports the
 * profile↔login bridge gaps, and hands over a single idempotent SQL script
 * (schema sync + bridge repair) to paste into the Supabase SQL Editor, then
 * reloads app data. The anon key cannot run DDL, so the script is copy-only.
 */
export const BackendRepairModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { refreshDatabaseState, checkServiceHealth } = useShop();

  const [report, setReport] = useState<SchemaAuditReport | null>(null);
  const [diag, setDiag] = useState<BridgeDiagnostics | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const schemaSql = useMemo(() => generateSchemaSyncSql(), []);
  const combinedSql = useMemo(
    () =>
      `-- ============================================================================\n` +
      `-- Stakey's Cycles — one-shot backend sync & repair\n` +
      `-- Part 1: match the live schema to what this app writes.\n` +
      `-- Part 2: re-link loyalty profiles to Supabase Auth logins (app bridge).\n` +
      `-- Safe to re-run. It only adds missing structures and backfills logins.\n` +
      `-- ============================================================================\n\n` +
      `-- ---------- PART 1: SCHEMA SYNC ----------\n` +
      schemaSql +
      `\n\n-- ---------- PART 2: APP BRIDGE REPAIR ----------\n` +
      bridgeSql,
    [schemaSql]
  );
  const lineCount = useMemo(() => combinedSql.split('\n').length, [combinedSql]);

  const projectRef = useMemo(() => {
    const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
    return host || 'your-project';
  }, []);
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4500);
  };

  const runChecks = useCallback(async () => {
    setBusy(true);
    try {
      const audit = await auditLiveSchema();
      setReport(audit);
      const [d, ok] = await Promise.all([fetchBridgeDiagnostics(), bridgeRepairInstalled()]);
      setDiag(d);
      setInstalled(ok);
    } catch (e) {
      flash({ kind: 'err', text: e instanceof Error ? e.message : 'Audit failed.' });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(combinedSql);
      setCopied(true);
      flash({ kind: 'ok', text: 'Sync + repair SQL copied — paste it into the Supabase SQL Editor and Run.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — open the SQL preview and copy manually.' });
      setShowSql(true);
    }
  };

  const handleReconnect = async () => {
    setRefreshing(true);
    try {
      await checkServiceHealth();
      await refreshDatabaseState();
      await runChecks();
      flash({ kind: 'ok', text: 'Reconnected to Supabase and reloaded app data.' });
    } catch {
      flash({ kind: 'err', text: 'Could not reconnect. Check your connection and Anon key.' });
    } finally {
      setRefreshing(false);
    }
  };

  const schemaIssues = report ? report.missingTables.length + report.missingColumns.length : 0;
  const schemaHealthy = report?.reachable && report.healthy;
  const unlinked = diag?.profilesWithoutLogin ?? 0;
  const unconfirmed = diag?.unconfirmedLogins ?? 0;
  const bridgeHealthy = diag?.reachable === true && installed === true && unlinked === 0 && unconfirmed === 0;
  const allHealthy = schemaHealthy && bridgeHealthy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-sky-500 to-fuchsia-500 text-neutral-950 border border-sky-500/40 shadow-lg shadow-sky-500/20">
              <DatabaseZap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Sync &amp; Repair Backend</h3>
              <p className="text-xs text-neutral-400">
                Sync the live schema, re-link the app bridge and reconnect — in one place.
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

        {/* Overall status */}
        <div
          className={`p-4 rounded-2xl border ${
            allHealthy
              ? 'bg-emerald-950/30 border-emerald-600/40'
              : report?.reachable
              ? 'bg-amber-950/25 border-amber-600/40'
              : 'bg-[#141820] border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {busy ? (
                <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
              ) : allHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : report?.reachable ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-sm">
                  {busy
                    ? 'Checking the backend…'
                    : allHealthy
                    ? 'Backend healthy — schema and bridge match'
                    : report?.reachable
                    ? 'Issues found — run the sync & repair script'
                    : 'Could not reach Supabase'}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {report?.reachable
                    ? `Checked ${report.totalColumns} columns at ${report.checkedAt} · ${unlinked} member${unlinked === 1 ? '' : 's'} without a login`
                    : report?.error || 'Check your connection and Anon API key.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={runChecks}
              disabled={busy}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin text-sky-400' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>
        </div>

        {/* Two panes: schema + bridge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`p-4 rounded-2xl border ${schemaHealthy ? 'bg-emerald-950/20 border-emerald-600/30' : 'bg-[#0a0d11] border-neutral-800'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <DatabaseZap className={`w-4 h-4 ${schemaHealthy ? 'text-emerald-400' : 'text-amber-400'}`} />
              <h4 className="text-xs font-bold uppercase tracking-wider">Schema sync</h4>
            </div>
            <div className="text-sm font-bold">
              {schemaHealthy ? 'In sync' : `${schemaIssues} issue${schemaIssues === 1 ? '' : 's'}`}
            </div>
            {report?.reachable && !schemaHealthy && (
              <div className="mt-2 space-y-1 text-[11px] max-h-24 overflow-y-auto">
                {report.missingTables.length > 0 && (
                  <div className="text-rose-300">
                    <strong>Missing tables:</strong> <span className="font-mono">{report.missingTables.join(', ')}</span>
                  </div>
                )}
                {report.missingColumns.length > 0 && (
                  <div className="text-amber-300 font-mono">
                    {report.missingColumns.map((c) => (
                      <div key={`${c.table}.${c.column}`}>{c.table}.{c.column}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!report?.reachable && <p className="mt-1 text-[11px] text-neutral-500">Run after reconnecting.</p>}
          </div>

          <div className={`p-4 rounded-2xl border ${bridgeHealthy ? 'bg-emerald-950/20 border-emerald-600/30' : 'bg-[#0a0d11] border-neutral-800'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Cable className={`w-4 h-4 ${bridgeHealthy ? 'text-emerald-400' : 'text-fuchsia-400'}`} />
              <h4 className="text-xs font-bold uppercase tracking-wider">App bridge</h4>
            </div>
            <div className="text-sm font-bold">
              {installed === false
                ? 'Not instrumented yet'
                : bridgeHealthy
                ? 'Linked — every member can sign in'
                : `${unlinked} without login · ${unconfirmed} unconfirmed`}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
              <Stat label="Profiles" value={diag?.loyaltyProfiles} />
              <Stat label="Auth logins" value={diag?.authLogins} />
            </div>
          </div>
        </div>

        {/* How to fix */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">How to fix</h4>
          </div>
          <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Copy the combined sync + repair SQL below.</li>
            <li>Open the Supabase SQL Editor for this project.</li>
            <li>Paste it into a new query and click <strong>Run</strong> (safe to re-run).</li>
            <li>Come back and press <strong>Reconnect &amp; Reload</strong>.</li>
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-fuchsia-500 hover:from-sky-400 hover:to-fuchsia-400 text-neutral-950 font-black text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shadow-md shadow-sky-500/20"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Sync + Repair SQL'}</span>
            </button>
            <a
              href={sqlEditorUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Open SQL Editor</span>
            </a>
            <button
              type="button"
              onClick={handleReconnect}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              <span>{refreshing ? 'Reconnecting…' : 'Reconnect & Reload'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSql((v) => !v)}
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
            <span>{showSql ? 'Hide' : 'Preview'} combined SQL ({lineCount} lines)</span>
          </button>
          {showSql && (
            <pre className="max-h-64 overflow-auto text-[10px] leading-relaxed font-mono bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-300 whitespace-pre">
              {combinedSql}
            </pre>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
          <span>
            Both checks are read-only. The script only adds missing tables/columns, relaxes legacy
            constraints and backfills logins — it never drops tables or deletes rows. Backfilled
            logins share the default password <strong>Stakeys123!</strong>; ask members to reset it.
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

        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <DatabaseZap className="w-3 h-3" />
          <span className="font-mono truncate">Project: {projectRef}</span>
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value?: number | string }> = ({ label, value }) => (
  <div className="p-2 rounded-lg border border-neutral-800 bg-[#0a0d11]">
    <div className="uppercase tracking-wider text-neutral-500 font-bold">{label}</div>
    <div className="font-black font-mono text-neutral-200">{value === undefined ? '—' : value}</div>
  </div>
);
