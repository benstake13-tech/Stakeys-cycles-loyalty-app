import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Database,
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
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import {
  auditLiveSchema,
  generateSchemaSyncSql,
  SchemaAuditReport,
} from '../shared/utils/schemaSync';
import { getStoredSupabaseUrl } from '../shared/supabase';

type Toast = { kind: 'ok' | 'err'; text: string } | null;

/**
 * Staff-facing "fix the database" control: audits the live Supabase project
 * against the schema the app expects and hands over an idempotent sync SQL
 * script (the anon key cannot run DDL, so the staff member pastes it into the
 * Supabase SQL Editor).
 */
export const SchemaSyncModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { refreshDatabaseState } = useShop();

  const [report, setReport] = useState<SchemaAuditReport | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const sql = useMemo(() => generateSchemaSyncSql(), []);
  const projectRef = useMemo(() => {
    const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
    return host || 'your-project';
  }, []);
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql`;

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };

  const runAudit = useCallback(async () => {
    setAuditing(true);
    try {
      const res = await auditLiveSchema();
      setReport(res);
      if (!res.reachable) flash({ kind: 'err', text: res.error || 'Could not reach Supabase.' });
    } catch (e) {
      flash({ kind: 'err', text: e instanceof Error ? e.message : 'Audit failed.' });
    } finally {
      setAuditing(false);
    }
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      flash({ kind: 'ok', text: 'Sync SQL copied — paste it into the Supabase SQL Editor and Run.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — open the SQL preview and copy manually.' });
      setShowSql(true);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDatabaseState();
      await runAudit();
      flash({ kind: 'ok', text: 'App data reloaded from Supabase.' });
    } catch {
      flash({ kind: 'err', text: 'Could not reload app data.' });
    } finally {
      setRefreshing(false);
    }
  };

  const issueCount = report ? report.missingTables.length + report.missingColumns.length : 0;
  const healthy = report?.reachable && report.healthy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Database Schema Sync</h3>
              <p className="text-xs text-neutral-400">
                Match the live Supabase project to the schema this app expects.
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

        {/* Audit result */}
        <div
          className={`p-4 rounded-2xl border ${
            healthy
              ? 'bg-emerald-950/30 border-emerald-600/40'
              : report?.reachable
              ? 'bg-amber-950/25 border-amber-600/40'
              : 'bg-[#141820] border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {auditing ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
              ) : healthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : report?.reachable ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-bold text-sm">
                  {auditing
                    ? 'Auditing live schema…'
                    : healthy
                    ? 'Schema matches the app — everything should work'
                    : report?.reachable
                    ? `${issueCount} schema issue${issueCount === 1 ? '' : 's'} found`
                    : 'Could not reach Supabase'}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {report?.reachable
                    ? `Checked ${report.totalColumns} app columns at ${report.checkedAt}`
                    : report?.error || 'Check your connection and Anon API key.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={runAudit}
              disabled={auditing}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Re-audit</span>
            </button>
          </div>

          {report?.reachable && !healthy && (
            <div className="mt-3 space-y-1.5 text-xs">
              {report.missingTables.length > 0 && (
                <div className="text-rose-300">
                  <strong>Missing tables:</strong>{' '}
                  <span className="font-mono">{report.missingTables.join(', ')}</span>
                </div>
              )}
              {report.missingColumns.length > 0 && (
                <div className="text-amber-300">
                  <strong>Missing columns:</strong>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] max-h-32 overflow-y-auto">
                    {report.missingColumns.map((c) => (
                      <li key={`${c.table}.${c.column}`}>
                        {c.table}.{c.column} <span className="text-neutral-500">({c.type})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {report && report.warnings.length > 0 && (
            <div className="mt-3 text-[11px] text-neutral-400">
              <strong className="text-neutral-300">Warnings:</strong>{' '}
              {report.warnings.join(' · ')}
            </div>
          )}
        </div>

        {/* How to fix */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">How to fix</h4>
          </div>
          <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Copy the sync SQL below.</li>
            <li>Open the Supabase SQL Editor for this project.</li>
            <li>Paste it into a new query and click <strong>Run</strong> (it is safe to re-run).</li>
            <li>Come back here and press <strong>Reload App Data</strong>.</li>
          </ol>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Sync SQL'}</span>
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{refreshing ? 'Reloading…' : 'Reload App Data'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSql((v) => !v)}
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
            <span>{showSql ? 'Hide' : 'Preview'} sync SQL ({sql.split('\n').length} lines)</span>
          </button>
          {showSql && (
            <pre className="max-h-64 overflow-auto text-[10px] leading-relaxed font-mono bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-300">
              {sql}
            </pre>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
          <span>
            The audit is read-only. The sync script only adds missing tables/columns, relaxes legacy
            constraints and re-applies grants — it never drops tables or deletes rows.
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
