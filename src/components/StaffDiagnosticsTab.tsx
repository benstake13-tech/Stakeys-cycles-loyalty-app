import React, { useMemo, useState } from 'react';
import {
  FlaskConical,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  Mail,
  Bell,
  Volume2,
  Smartphone,
  Copy,
  Check,
  Wrench,
  ExternalLink,
  Award,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { dispatchTestEmail } from '../utils/notificationService';
import {
  sendPushToUser,
  initOneSignal,
  getPushPermission,
  requestPushPermission,
  getSubscriptionId,
  linkUser,
  registerEmailSubscription,
} from '../utils/pushNotifications';
import { runPushRepair, PushRepairStep, PushRepairStatus } from '../utils/pushRepair';
import { generateRepairSqlForTables, generateProfileBalanceProbeSql } from '../utils/schemaSync';
import { getStoredSupabaseUrl } from '../supabase';
import {
  AREA_LABELS,
  FEATURE_TESTS,
  FeatureArea,
  FeatureTestResult,
  runFeatureTests,
  summarize,
} from '../utils/featureDiagnostics';

const AREA_ORDER: FeatureArea[] = [
  'connectivity',
  'loyalty',
  'bookings',
  'till',
  'members',
  'prizes',
  'content',
  'settings',
  'reach',
  'email',
  'logic',
];

const STATUS_META: Record<
  FeatureTestResult['status'],
  { icon: React.ReactNode; ring: string; text: string; chip: string; label: string }
> = {
  pass: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    ring: 'border-emerald-500/40 bg-emerald-500/5',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    label: 'Working',
  },
  fail: {
    icon: <XCircle className="w-4 h-4" />,
    ring: 'border-red-500/40 bg-red-500/5',
    text: 'text-red-400',
    chip: 'bg-red-500/15 text-red-300 border-red-500/30',
    label: 'Broken',
  },
  warn: {
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: 'border-amber-500/40 bg-amber-500/5',
    text: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    label: 'Check',
  },
  skipped: {
    icon: <MinusCircle className="w-4 h-4" />,
    ring: 'border-neutral-700 bg-neutral-800/30',
    text: 'text-neutral-400',
    chip: 'bg-neutral-700/40 text-neutral-300 border-neutral-600/40',
    label: 'Skipped',
  },
};

type Toast = { kind: 'ok' | 'err'; text: string } | null;

const PUSH_STEP_META: Record<
  PushRepairStatus,
  { icon: React.ReactNode; ring: string; text: string; chip: string; label: string }
> = {
  pass: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    ring: 'border-emerald-500/40 bg-emerald-500/5',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    label: 'Working',
  },
  fixed: {
    icon: <Wrench className="w-4 h-4" />,
    ring: 'border-sky-500/40 bg-sky-500/5',
    text: 'text-sky-400',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    label: 'Repaired',
  },
  warn: {
    icon: <AlertTriangle className="w-4 h-4" />,
    ring: 'border-amber-500/40 bg-amber-500/5',
    text: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    label: 'Check',
  },
  fail: {
    icon: <XCircle className="w-4 h-4" />,
    ring: 'border-red-500/40 bg-red-500/5',
    text: 'text-red-400',
    chip: 'bg-red-500/15 text-red-300 border-red-500/30',
    label: 'Needs fix',
  },
};

export const StaffDiagnosticsTab: React.FC = () => {
  const {
    ownerConfig,
    currentUser,
    checkServiceHealth,
    isStaffBookingSoundEnabled,
    playStaffBookingAlertPing,
    requestPushNotificationPermission,
    refreshDatabaseState,
  } = useShop();

  const [results, setResults] = useState<FeatureTestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fixSql, setFixSql] = useState<{ title: string; sql: string } | null>(null);
  const [pushSteps, setPushSteps] = useState<PushRepairStep[]>([]);
  const [pushBusy, setPushBusy] = useState<'check' | 'repair' | null>(null);

  const summary = useMemo(() => summarize(results), [results]);

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4500);
  };

  const handleRunAll = async () => {
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    try {
      await runFeatureTests((result, index, total) => {
        setProgress({ done: index + 1, total });
        setResults((prev) => [...prev, result]);
      });
    } finally {
      setRunning(false);
    }
  };

  const handleRunArea = async (area: FeatureArea) => {
    const ids = FEATURE_TESTS.filter((t) => t.area === area).map((t) => t.id);
    setRunning(true);
    setResults((prev) => prev.filter((r) => !ids.includes(r.id)));
    try {
      await runFeatureTests((result) => setResults((prev) => [...prev, result]), ids);
    } finally {
      setRunning(false);
    }
  };

  const handleTestEmail = async () => {
    setBusy('email');
    try {
      const res = await dispatchTestEmail(ownerConfig);
      flash(
        res.success
          ? { kind: 'ok', text: `Test email dispatched to ${ownerConfig.ownerEmail}.` }
          : { kind: 'err', text: res.message || 'Test email failed.' }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleTestPush = async () => {
    setBusy('push');
    try {
      const res = await sendPushToUser(
        undefined,
        "Stakey's Cycles — Test Push",
        'Push notifications are working on this device.'
      );
      if (res.ok) {
        flash({ kind: 'ok', text: `Test push sent (via ${res.via}).` });
      } else {
        const err = res.envelope?.errors?.join('; ');
        flash({
          kind: 'err',
          text: err
            ? `Push not delivered — ${err}.`
            : 'Push not delivered — OneSignal may not be configured.',
        });
      }
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Push test failed.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRequestPush = async () => {
    setBusy('perm');
    try {
      const perm = await requestPushNotificationPermission();
      flash(
        perm === 'granted'
          ? { kind: 'ok', text: 'Desktop push permission granted.' }
          : { kind: 'err', text: `Push permission: ${perm}.` }
      );
    } finally {
      setBusy(null);
    }
  };

  /** Shared dependency bundle for the push repair runner. */
  const pushRepairDeps = {
    getServerConfig: async () => {
      const res = await fetch('/api/onesignal/config');
      const data = await res.json();
      return {
        appId: data?.appId ?? null,
        serverPush: Boolean(data?.serverPush),
        restKeyEnv: data?.restKeyEnv ?? null,
        restKeyEnvNames: data?.restKeyEnvNames,
      };
    },
    initSdk: initOneSignal,
    getPermission: getPushPermission,
    requestPermission: requestPushPermission,
    getSubscriptionId,
    linkUser,
    registerEmail: registerEmailSubscription,
    sendTestPush: () =>
      sendPushToUser(undefined, "Stakey's Cycles — Push Repair", 'Push notifications are working on this device.'),
  };

  const pushRepairContext = {
    userId: currentUser?.uid,
    displayName: currentUser?.displayName,
    membershipNumber: currentUser?.membershipNumber,
    ownerEmail: ownerConfig.ownerEmail,
  };

  const handlePushCheck = async () => {
    setPushBusy('check');
    try {
      const steps = await runPushRepair(pushRepairDeps, pushRepairContext, { repair: false });
      setPushSteps(steps);
      const bad = steps.filter((s) => s.status === 'fail').length;
      flash(
        bad === 0
          ? { kind: 'ok', text: 'Push check complete — no blocking problems found.' }
          : { kind: 'err', text: `Push check found ${bad} problem${bad === 1 ? '' : 's'} to repair.` }
      );
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Push check failed.' });
    } finally {
      setPushBusy(null);
    }
  };

  const handlePushRepair = async () => {
    setPushBusy('repair');
    try {
      const steps = await runPushRepair(pushRepairDeps, pushRepairContext, { repair: true });
      setPushSteps(steps);
      const failed = steps.filter((s) => s.status === 'fail');
      const fixed = steps.filter((s) => s.status === 'fixed').length;
      if (failed.length) {
        flash({
          kind: 'err',
          text: `Repaired ${fixed} step${fixed === 1 ? '' : 's'}; ${failed.length} still need attention (see below).`,
        });
      } else {
        flash({ kind: 'ok', text: `Push repaired — ${fixed} step${fixed === 1 ? '' : 's'} applied.` });
      }
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Push repair failed.' });
    } finally {
      setPushBusy(null);
    }
  };

  const handleHealth = async () => {
    setBusy('health');
    try {
      const res = await checkServiceHealth();
      flash(
        res?.isOnline
          ? { kind: 'ok', text: `Supabase online${res.latencyMs ? ` (${res.latencyMs}ms)` : ''}.` }
          : { kind: 'err', text: res?.error || 'Supabase unreachable.' }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleLiveRefresh = async () => {
    setBusy('live');
    try {
      await refreshDatabaseState();
      flash({ kind: 'ok', text: 'Live data refreshed from Supabase.' });
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Refresh failed.' });
    } finally {
      setBusy(null);
    }
  };

  /** Runs the stamp/ticket/point balance diagnostic on its own and, when it
   *  hits the synthetic-id limitation, opens the UUID-safe probe SQL. */
  const handleTestBalanceWrite = async () => {
    setBusy('balance');
    try {
      let last: FeatureTestResult | undefined;
      await runFeatureTests(
        (result) => {
          last = result;
          setResults((prev) => [...prev.filter((r) => r.id !== result.id), result]);
        },
        ['profile-balance-write']
      );
      if (last?.status === 'pass') {
        flash({ kind: 'ok', text: 'Balance write persisted — stamp/ticket/point upsert works.' });
      } else {
        setFixSql({
          title: `${last?.label ?? 'Balance write'} — UUID-safe balance probe`,
          sql: generateProfileBalanceProbeSql(),
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleCopyReport = async () => {
    const lines = [
      `Stakey's Cycles — feature diagnostics (${new Date().toLocaleString()})`,
      `Passed ${summary.pass}/${summary.total} · Broken ${summary.fail} · Check ${summary.warn}`,
      '',
      ...AREA_ORDER.flatMap((area) => {
        const rows = results.filter((r) => r.area === area);
        if (!rows.length) return [];
        return [
          `[${AREA_LABELS[area]}]`,
          ...rows.map(
            (r) => `  ${r.status.toUpperCase().padEnd(5)} ${r.label} — ${r.detail}${r.hint ? ` (hint: ${r.hint})` : ''}`
          ),
          '',
        ];
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Could not copy to clipboard.' });
    }
  };

  const openFixSql = (result: FeatureTestResult) => {
    const tables = result.tables?.length ? result.tables : [];
    setFixSql({
      title: result.label,
      sql: generateRepairSqlForTables(tables),
    });
  };

  /** The balance diagnostic cannot create a synthetic profile (uuid + FK), so
   *  offer the UUID-safe probe instead of a generic schema repair. */
  const openBalanceProbeSql = (result: FeatureTestResult) => {
    setFixSql({
      title: `${result.label} — UUID-safe balance probe`,
      sql: generateProfileBalanceProbeSql(),
    });
  };

  const renderRow = (result: FeatureTestResult) => {
    const meta = STATUS_META[result.status];
    return (
      <div key={result.id} className={`rounded-2xl border p-3.5 ${meta.ring}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 shrink-0 ${meta.text}`}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">{result.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.chip}`}>
                {meta.label}
              </span>
              {result.writes && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  write test · self-cleaning
                </span>
              )}
              {result.id === 'profile-balance-write' && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  title="profiles.id is uuid with a foreign key to auth.users, so this test writes sentinel values to a real profile and restores them afterwards."
                >
                  real profile — restored
                </span>
              )}
              <span className="text-[10px] font-mono text-neutral-500">{result.ms}ms</span>
            </div>
            <p className="text-xs text-neutral-300 mt-1 break-words">{result.detail}</p>
            {result.hint && (
              <p className="text-[11px] text-amber-300/90 mt-1.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{result.hint}</span>
              </p>
            )}
            {(result.status === 'fail' || result.status === 'warn') && result.tables?.length ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openFixSql(result)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Create fix SQL</span>
                </button>
                {result.id === 'profile-balance-write' && (
                  <button
                    type="button"
                    onClick={() => openBalanceProbeSql(result)}
                    className="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-neutral-950 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm shadow-violet-500/20"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Create balance probe SQL</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + master controls */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <FlaskConical className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Feature Test Bench
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                Run a live self-test of every backend feature. Write tests use temporary rows that are
                deleted again, so nothing is left behind. Use this to see exactly what is working and
                what has broken.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRunAll}
              disabled={running}
              className="px-5 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-wait text-neutral-950 text-sm font-black flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{running ? `Running… ${progress.done}/${progress.total}` : 'Run All Tests'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyReport}
              disabled={!results.length}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border border-neutral-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Working" value={summary.pass} tone="emerald" />
            <StatCard label="Broken" value={summary.fail} tone="red" />
            <StatCard label="Needs check" value={summary.warn} tone="amber" />
            <StatCard label="Total tests" value={summary.total} tone="neutral" />
          </div>
        )}
      </div>

      {/* OneSignal push repair */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Repair Push Notifications
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                Runs one ordered pass over the whole push chain — server config, the OneSignal SDK, this
                device's permission and subscription, your sign-in identity, and a live test dispatch — and
                fixes what the browser can (permission, sign-in, email). Anything it can't fix is flagged
                with the exact setting to change.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePushCheck}
              disabled={pushBusy !== null}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-200 text-sm font-bold flex items-center gap-2 border border-neutral-700 cursor-pointer"
            >
              {pushBusy === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Check Push</span>
            </button>
            <button
              type="button"
              onClick={handlePushRepair}
              disabled={pushBusy !== null}
              className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-wait text-neutral-950 text-sm font-black flex items-center gap-2 shadow-md shadow-sky-500/20 cursor-pointer"
            >
              {pushBusy === 'repair' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              <span>{pushBusy === 'repair' ? 'Repairing…' : 'Repair Push'}</span>
            </button>
          </div>
        </div>

        {pushSteps.length > 0 && (
          <div className="mt-5 space-y-2.5">
            {pushSteps.map((step) => {
              const meta = PUSH_STEP_META[step.status];
              return (
                <div key={step.id} className={`rounded-2xl border p-3.5 ${meta.ring}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 ${meta.text}`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{step.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.chip}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 mt-1 break-words">{step.detail}</p>
                      {step.hint && (
                        <p className="text-[11px] text-amber-300/90 mt-1.5 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{step.hint}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notification channel quick tests */}
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-2 text-white font-bold text-sm mb-4">
          <Bell className="w-4 h-4 text-emerald-400" />
          Notification & Alert Tests
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TestButton
            icon={<Mail className="w-4 h-4" />}
            title="Send Test Email"
            subtitle={ownerConfig.ownerEmail ? `to ${ownerConfig.ownerEmail}` : 'no recipient set'}
            onClick={handleTestEmail}
            busy={busy === 'email'}
            disabled={!ownerConfig.ownerEmail}
          />
          <TestButton
            icon={<Smartphone className="w-4 h-4" />}
            title="Send Test Push"
            subtitle="OneSignal device push"
            onClick={handleTestPush}
            busy={busy === 'push'}
          />
          <TestButton
            icon={<Bell className="w-4 h-4" />}
            title="Enable Desktop Push"
            subtitle="request browser permission"
            onClick={handleRequestPush}
            busy={busy === 'perm'}
          />
          <TestButton
            icon={<Volume2 className="w-4 h-4" />}
            title="Test Loud Ping"
            subtitle={isStaffBookingSoundEnabled ? 'booking alert sound armed' : 'sound is muted'}
            onClick={() => {
              playStaffBookingAlertPing();
              flash({ kind: 'ok', text: 'Played the workshop booking ping.' });
            }}
          />
          <TestButton
            icon={<Database className="w-4 h-4" />}
            title="Test Supabase Connection"
            subtitle="ping auth gateway + tables"
            onClick={handleHealth}
            busy={busy === 'health'}
          />
          <TestButton
            icon={<Award className="w-4 h-4" />}
            title="Test Stamp / Ticket / Point Write"
            subtitle="loyalty balance upsert (UUID-safe probe)"
            onClick={handleTestBalanceWrite}
            busy={busy === 'balance'}
          />
          <TestButton
            icon={<RefreshCw className="w-4 h-4" />}
            title="Test Live Data Refresh"
            subtitle="re-pull all tables via realtime"
            onClick={handleLiveRefresh}
            busy={busy === 'live'}
          />
        </div>
      </div>

      {/* Results grouped by area */}
      {AREA_ORDER.map((area) => {
        const rows = results.filter((r) => r.area === area);
        const isCollapsed = collapsed[area];
        const areaSummary = summarize(rows);
        return (
          <div key={area} className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [area]: !c[area] }))}
                className="flex items-center gap-2 text-white font-bold text-sm cursor-pointer"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {AREA_LABELS[area]}
                {rows.length > 0 && (
                  <span className="text-[11px] font-mono text-neutral-400">
                    {areaSummary.pass}/{rows.length} ok
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleRunArea(area)}
                disabled={running}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-700"
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Test this area
              </button>
            </div>

            {!isCollapsed && (
              <div className="mt-4 space-y-2.5">
                {rows.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">
                    Not run yet — press “Test this area” or “Run All Tests”.
                  </p>
                ) : (
                  rows.map(renderRow)
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-2xl border text-sm font-semibold shadow-2xl animate-fade-in ${
            toast.kind === 'ok'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/90 border-red-500/50 text-red-200'
          }`}
        >
          {toast.text}
        </div>
      )}

      {fixSql && <FixSqlModal fix={fixSql} onClose={() => setFixSql(null)} />}
    </div>
  );
};

const FixSqlModal: React.FC<{
  fix: { title: string; sql: string };
  onClose: () => void;
}> = ({ fix, onClose }) => {
  const [copied, setCopied] = useState(false);

  const sqlEditorUrl = (() => {
    const host = getStoredSupabaseUrl().replace(/^https?:\/\//, '').split('.')[0];
    return `https://supabase.com/dashboard/project/${host || 'your-project'}/sql`;
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fix.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — the SQL is on screen to copy manually */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 text-white shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Fix SQL</h3>
              <p className="text-xs text-neutral-400">{fix.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>Copy the SQL below.</li>
          <li>Open the Supabase SQL Editor for this project.</li>
          <li>Paste it into a new query and click <strong>Run</strong> (safe to re-run).</li>
          <li>Come back and press <strong>Run All Tests</strong> again to confirm it is fixed.</li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Fix SQL'}</span>
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
        </div>

        <pre className="max-h-72 overflow-auto text-[10px] leading-relaxed font-mono bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-300">
          {fix.sql}
        </pre>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; tone: 'emerald' | 'red' | 'amber' | 'neutral' }> = ({
  label,
  value,
  tone,
}) => {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-400 border-emerald-500/30',
    red: 'text-red-400 border-red-500/30',
    amber: 'text-amber-400 border-amber-500/30',
    neutral: 'text-neutral-200 border-neutral-700',
  };
  return (
    <div className={`rounded-2xl border bg-neutral-900/60 p-4 ${tones[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`text-2xl font-black ${tones[tone].split(' ')[0]}`}>{value}</p>
    </div>
  );
};

const TestButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}> = ({ icon, title, subtitle, onClick, busy, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || busy}
    className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
  >
    <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-bold text-white truncate">{title}</span>
      <span className="block text-[11px] text-neutral-400 truncate">{subtitle}</span>
    </span>
  </button>
);

export default StaffDiagnosticsTab;
