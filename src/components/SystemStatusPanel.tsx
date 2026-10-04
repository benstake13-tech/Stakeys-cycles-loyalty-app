import React, { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Wrench,
  Mail,
  Smartphone,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { getStoredSupabaseUrl, getStoredSupabaseAnonKey, getSupabaseClient } from '../supabase';
import { deriveProjectRef } from '../utils/emailSetup';
import { getPushPermission } from '../utils/pushNotifications';
import { fetchPushConfig } from '../utils/pushSetup';
import { deployAllFunctionsCommand, envTemplate, webhookTriggerSql } from '../utils/bookingAlertsSetup';
import {
  runNotificationSystemTests,
  summarizeSystem,
  SYSTEM_GROUP_LABELS,
  type SystemCheck,
  type SystemGroup,
  type SystemStatus,
} from '../utils/notificationDiagnostics';

const GROUP_ORDER: SystemGroup[] = ['pipeline', 'email', 'push'];

const GROUP_ICON: Record<SystemGroup, React.ReactNode> = {
  pipeline: <Server className="w-4 h-4" />,
  email: <Mail className="w-4 h-4" />,
  push: <Smartphone className="w-4 h-4" />,
};

const STATUS_META: Record<SystemStatus, { icon: React.ReactNode; ring: string; text: string; label: string }> = {
  pass: { icon: <CheckCircle2 className="w-4 h-4" />, ring: 'border-emerald-500/40 bg-emerald-500/5', text: 'text-emerald-400', label: 'Working' },
  fail: { icon: <XCircle className="w-4 h-4" />, ring: 'border-red-500/40 bg-red-500/5', text: 'text-red-400', label: 'Missing' },
  warn: { icon: <AlertTriangle className="w-4 h-4" />, ring: 'border-amber-500/40 bg-amber-500/5', text: 'text-amber-400', label: 'Check' },
  skipped: { icon: <MinusCircle className="w-4 h-4" />, ring: 'border-neutral-700 bg-neutral-800/30', text: 'text-neutral-400', label: 'Skipped' },
};

/**
 * "Test this system" panel for the Feature Test Bench. Runs the whole booking
 * notification pipeline and reports, per step, what works and what is missing —
 * with a button next to each failure that either opens the page to fix it or
 * copies the exact command/SQL to paste there.
 */
export const SystemStatusPanel: React.FC<{ onFlash?: (text: string, ok: boolean) => void }> = ({
  onFlash,
}) => {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const projectRef = deriveProjectRef(getStoredSupabaseUrl());
  const summary = summarizeSystem(checks);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const results = await runNotificationSystemTests({
        supabaseUrl: getStoredSupabaseUrl(),
        anonKey: getStoredSupabaseAnonKey(),
        readAppSettings: async () => {
          const client = getSupabaseClient();
          if (!client) return null;
          const { data } = await client
            .from('app_settings')
            .select('owner_email,email_alerts_enabled')
            .eq('id', 1)
            .maybeSingle();
          if (!data) return null;
          return {
            ownerEmail: (data as any).owner_email || '',
            emailAlertsEnabled: (data as any).email_alerts_enabled === true,
          };
        },
        getPushPermission: async () => getPushPermission(),
        getServiceWorkerScopes: async () => {
          const regs = await navigator.serviceWorker?.getRegistrations().catch(() => []);
          return (regs ?? []).map((r) => ({ scope: r.scope }));
        },
        getPushConfig: async () => fetchPushConfig(),
      });
      setChecks(results);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyFix = async (checkId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(checkId);
      setTimeout(() => setCopiedId((c) => (c === checkId ? null : c)), 2500);
      onFlash?.('Copied — paste it where the button says, then press Re-run.', true);
    } catch {
      onFlash?.('Clipboard blocked — copy the text manually.', false);
    }
  };

  const fixTextFor = (copy: string) => {
    if (copy === 'deploy') return deployAllFunctionsCommand(projectRef);
    if (copy === 'env') return envTemplate();
    if (copy === 'sql') return webhookTriggerSql(getStoredSupabaseUrl());
    return copy;
  };

  const renderFix = (check: SystemCheck) => {
    const fix = check.fix;
    if (!fix) return null;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {fix.copy ? (
          <button
            type="button"
            onClick={() => copyFix(check.id, fixTextFor(fix.copy!))}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            {copiedId === check.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === check.id ? 'Copied!' : fix.label}</span>
          </button>
        ) : null}
        {fix.href ? (
          <a
            href={fix.href}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>{fix.label}</span>
          </a>
        ) : null}
        {!fix.href && !fix.copy && fix.label ? (
          <span className="px-3 py-1.5 rounded-xl bg-neutral-800/70 border border-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>{fix.label}</span>
          </span>
        ) : null}
        {fix.hint ? <span className="text-[11px] text-neutral-400">{fix.hint}</span> : null}
      </div>
    );
  };

  return (
    <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Test the Booking Alert System</h3>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
              Walks the whole notification pipeline and tells you, step by step, what is working and
              what still needs doing — before you change anything.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="px-4 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-wait text-neutral-950 text-sm font-black flex items-center gap-2 cursor-pointer shrink-0"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{running ? 'Testing…' : 'Re-run system test'}</span>
        </button>
      </div>

      {checks.length > 0 && (
        <div
          className={`mt-4 rounded-2xl border p-4 flex items-center gap-3 ${
            summary.ready ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'
          }`}
        >
          {summary.ready ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <p className="text-sm text-neutral-200">
            {summary.ready ? (
              <span>
                System ready — <strong>{summary.pass}</strong> checks pass
                {summary.warn ? `, ${summary.warn} to keep an eye on` : ''}.
              </span>
            ) : (
              <span>
                <strong>{summary.fail}</strong> step{summary.fail === 1 ? '' : 's'} still need
                {summary.fail === 1 ? 's' : ''} doing
                {summary.warn ? ` · ${summary.warn} to check` : ''} · {summary.pass}/{summary.total} working.
              </span>
            )}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {GROUP_ORDER.map((group) => {
          const rows = checks.filter((c) => c.group === group);
          if (!rows.length) return null;
          return (
            <div key={group}>
              <div className="flex items-center gap-2 text-neutral-300 text-[11px] font-black uppercase tracking-wider mb-2">
                {GROUP_ICON[group]}
                <span>{SYSTEM_GROUP_LABELS[group]}</span>
              </div>
              <div className="space-y-2">
                {rows.map((check) => {
                  const meta = STATUS_META[check.status];
                  return (
                    <div key={check.id} className={`rounded-2xl border p-3.5 ${meta.ring}`}>
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 shrink-0 ${meta.text}`}>{meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">{check.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${meta.text}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300 mt-1 break-words">{check.detail}</p>
                          {renderFix(check)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!checks.length && !running && (
        <p className="text-xs text-neutral-500 italic mt-4">No results — press “Re-run system test”.</p>
      )}
    </div>
  );
};

export default SystemStatusPanel;
