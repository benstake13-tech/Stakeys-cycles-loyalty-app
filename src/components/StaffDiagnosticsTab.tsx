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
  Database,
  Mail,
  Bell,
  BellRing,
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
  isPushSubscribed,
  optInPushSubscription,
  getConfiguredAppId,
  setConfiguredAppId,
  linkUser,
  registerEmailSubscription,
  adminPushTarget,
} from '../utils/pushNotifications';
import { runPushRepair, PushRepairStep, PushRepairStatus, PUSH_STEP_FIX_ACTION } from '../utils/pushRepair';
import { generateRepairSqlForTables, generateProfileBalanceProbeSql } from '../utils/schemaSync';
import { getStoredSupabaseUrl } from '../supabase';
import { RepairTarget, resolveRepairTarget } from '../utils/repairTargets';
import {
  AREA_LABELS,
  FEATURE_TESTS,
  FeatureArea,
  FeatureTest,
  FeatureTestResult,
  getVerifiedAreas,
  runFeatureTests,
  summarize,
} from '../utils/featureDiagnostics';

const AREA_ORDER: FeatureArea[] = [
  'connectivity',
  'loyalty',
  'bookings',
  'till',
  'members',
  'garage',
  'prizes',
  'content',
  'settings',
  'reach',
  'email',
  'scanner',
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
  // The id of the single test currently being run (per-test button spinner).
  const [runningId, setRunningId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Areas whose checks have actually been exercised on this device, so a feature
  // that has never been run shows a "not run yet" flag rather than a blank box.
  const [verifiedAreas, setVerifiedAreas] = useState<FeatureArea[]>(() => getVerifiedAreas());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Area currently being exercised by its single "Test & Repair" action.
  const [areaRunning, setAreaRunning] = useState<FeatureArea | null>(null);
  // When on, only areas with a failing/warning test are shown (easier triage).
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fixSql, setFixSql] = useState<{ title: string; sql: string } | null>(null);
  const [pushSteps, setPushSteps] = useState<PushRepairStep[]>([]);
  const [pushBusy, setPushBusy] = useState<'check' | 'repair' | 'device' | string | null>(null);
  const [appIdDraft, setAppIdDraft] = useState<string>(() => getConfiguredAppId());

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
      setVerifiedAreas(getVerifiedAreas());
    }
  };

  /** Runs every test in an area and returns the fresh results (so the caller can
   *  decide whether a repair is needed without waiting for a re-render). */
  const runAreaTests = async (area: FeatureArea): Promise<FeatureTestResult[]> => {
    const ids = FEATURE_TESTS.filter((t) => t.area === area).map((t) => t.id);
    const collected: FeatureTestResult[] = [];
    setResults((prev) => prev.filter((r) => !ids.includes(r.id)));
    await runFeatureTests((result) => {
      collected.push(result);
      setResults((prev) => [...prev.filter((r) => r.id !== result.id), result]);
    }, ids);
    setVerifiedAreas(getVerifiedAreas());
    return collected;
  };

  /**
   * The single per-area action: run that area's tests, then — if anything failed
   * or warned — surface the resolved repair target for the service that fixes it.
   */
  const handleTestAndRepairArea = async (area: FeatureArea) => {
    setAreaRunning(area);
    try {
      const collected = await runAreaTests(area);
      const bad = collected.filter((r) => r.status === 'fail' || r.status === 'warn');
      if (!bad.length) {
        flash({ kind: 'ok', text: `${AREA_LABELS[area]} — all checks passed.` });
        return;
      }
      const failing = bad.find((r) => r.status === 'fail') ?? bad[0];
      const target = resolveRepairTarget({
        area,
        tables: Array.from(new Set(bad.flatMap((r) => r.tables ?? []))),
        id: failing.id,
      });
      await applyRepairTarget(target, failing);
    } finally {
      setAreaRunning(null);
    }
  };

  /** Runs the resolved repair side-effect for a target (open dashboard / push
   *  repair) and, for Supabase, opens the copy-ready SQL modal. */
  const applyRepairTarget = async (target: RepairTarget, failing: FeatureTestResult) => {
    if (target.service === 'supabase' && target.copySql) {
      setFixSql({ title: `${AREA_LABELS[failing.area]} — repair SQL`, sql: target.copySql() });
      return;
    }
    if (target.service === 'onesignal') {
      // Run the in-app push repair, then let the operator open the dashboard for
      // the server-side settings the browser cannot change.
      await handlePushRepair();
      if (target.openUrl) window.open(target.openUrl, '_blank', 'noopener');
      return;
    }
    if (target.service === 'email') {
      flash({ kind: 'err', text: `Email checks failed: ${failing.detail}${failing.hint ? ` — ${failing.hint}` : ''}` });
      return;
    }
    flash({ kind: 'err', text: `${failing.label}: ${failing.detail}` });
  };

  /** Runs a single test on its own, replacing only its previous result. */
  const handleRunTest = async (id: string) => {
    setRunningId(id);
    try {
      await runFeatureTests((result) => {
        setResults((prev) => [...prev.filter((r) => r.id !== result.id), result]);
      }, [id]);
      setVerifiedAreas(getVerifiedAreas());
    } finally {
      setRunningId(null);
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
        'Push notifications are working on this device.',
        undefined,
        adminPushTarget()
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
    isSubscribed: isPushSubscribed,
    optInSubscription: optInPushSubscription,
    getConfiguredAppId,
    linkUser,
    registerEmail: registerEmailSubscription,
    sendTestPush: () =>
      sendPushToUser(
        undefined,
        "Stakey's Cycles — Push Repair",
        'Push notifications are working on this device.',
        undefined,
        adminPushTarget()
      ),
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

  /**
   * Repairs a single step of the chain in isolation. Every step's probe is still
   * evaluated (so the list stays complete) but only this step's repair
   * side-effect runs — a precise "fix just this" action.
   */
  const handleFixStep = async (stepId: string) => {
    setPushBusy(stepId);
    try {
      const steps = await runPushRepair(pushRepairDeps, pushRepairContext, { repair: true, only: stepId });
      setPushSteps(steps);
      const step = steps.find((s) => s.id === stepId);
      if (step && (step.status === 'fail' || step.status === 'warn')) {
        flash({ kind: 'err', text: `${step.label}: ${step.detail}` });
      } else {
        flash({ kind: 'ok', text: `${step?.label ?? 'Step'} repaired.` });
      }
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Step repair failed.' });
    } finally {
      setPushBusy(null);
    }
  };

  const handleSaveAppId = () => {
    const changed = setConfiguredAppId(appIdDraft);
    if (!changed) {
      flash({ kind: 'ok', text: 'App ID unchanged.' });
      return;
    }
    flash({ kind: 'ok', text: 'App ID saved. Reload the page to re-initialise OneSignal with it.' });
  };

  /**
   * The phone-side action: prompt for permission, force this device to opt in,
   * then immediately run the full check so the operator sees the subscription
   * appear in the step list.
   */
  const handleEnableDevice = async () => {
    setPushBusy('device');
    try {
      const perm = await requestPushPermission();
      if (perm !== 'granted') {
        flash({
          kind: 'err',
          text:
            perm === 'not_configured'
              ? 'OneSignal App ID is missing — set it below and reload.'
              : 'Notifications are blocked. Allow them in your browser/phone settings, then retry.',
        });
        return;
      }
      await optInPushSubscription();
      const steps = await runPushRepair(pushRepairDeps, pushRepairContext, { repair: true });
      setPushSteps(steps);
      const sub = steps.find((s) => s.id === 'subscription');
      flash(
        sub && sub.status !== 'warn'
          ? { kind: 'ok', text: 'This device is now subscribed — run the test dispatch to confirm.' }
          : { kind: 'err', text: 'Permission granted, but the device has not registered yet. Re-run in a few seconds.' }
      );
    } catch (e: any) {
      flash({ kind: 'err', text: e?.message || 'Could not enable push on this device.' });
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

  /**
   * One row per catalogue test. It is always rendered so every feature has its own
   * "Run" control; the result (when present) adds the status, detail and fix SQL.
   */
  const renderTestRow = (test: FeatureTest, result?: FeatureTestResult) => {
    const meta = result ? STATUS_META[result.status] : null;
    const isRowRunning = runningId === test.id;
    return (
      <div
        key={test.id}
        data-testid={`test-row-${test.id}`}
        className={`rounded-2xl border p-3.5 ${meta ? meta.ring : 'border-neutral-800 bg-neutral-900/40'}`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 shrink-0 ${meta ? meta.text : 'text-neutral-600'}`}>
            {isRowRunning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : meta ? meta.icon : <MinusCircle className="w-4 h-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">{test.label}</span>
              {meta ? (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.chip}`}>
                  {meta.label}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-neutral-700 bg-neutral-800/40 text-neutral-400">
                  Not run
                </span>
              )}
              {test.writes && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  write test · self-cleaning
                </span>
              )}
              {test.id === 'profile-balance-write' && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30"
                  title="profiles.id is uuid with a foreign key to auth.users, so this test writes sentinel values to a real profile and restores them afterwards."
                >
                  real profile — restored
                </span>
              )}
              {result && <span className="text-[10px] font-mono text-neutral-500">{result.ms}ms</span>}
              <button
                type="button"
                onClick={() => handleRunTest(test.id)}
                disabled={running || isRowRunning}
                title="Run just this test"
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isRowRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>{isRowRunning ? 'Running…' : 'Run'}</span>
              </button>
            </div>
            {result ? (
              <p className="text-xs text-neutral-300 mt-1 break-words">{result.detail}</p>
            ) : (
              <p className="text-[11px] text-neutral-500 mt-1 break-words">{test.description}</p>
            )}
            {result?.hint && (
              <p className="text-[11px] text-amber-300/90 mt-1.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{result.hint}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
            <button
              type="button"
              onClick={() => setFailuresOnly((v) => !v)}
              data-testid="failures-only-toggle"
              aria-pressed={failuresOnly}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer border ${
                failuresOnly
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Failures only</span>
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
                Repair &amp; Configure Push Notifications
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                Runs one ordered pass over the whole push chain — server config, the OneSignal SDK, this
                device's permission, subscription and opt-in, your sign-in identity, and a live test dispatch.
                It fixes what the browser can (permission, device opt-in, sign-in, email) and flags the exact
                setting to change for the rest. Use the App ID box to correct or rotate the app without a code change.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleEnableDevice}
              disabled={pushBusy !== null}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-60 border border-emerald-500/40 text-emerald-200 text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <BellRing className="w-4 h-4" />
              <span>Enable on This Device</span>
            </button>
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
              <span>{pushBusy === 'repair' ? 'Repairing…' : 'Repair & Configure Push'}</span>
            </button>
          </div>
        </div>

        {/* App ID configuration */}
        <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                OneSignal App ID
              </span>
              <input
                type="text"
                value={appIdDraft}
                onChange={(e) => setAppIdDraft(e.target.value)}
                spellCheck={false}
                placeholder="7f67ab94-3c85-4702-9cd8-d158cf294593"
                className="w-full px-3 py-2 rounded-xl bg-[#0b0e12] border border-neutral-700 text-sm font-mono text-neutral-100 focus:outline-none focus:border-sky-500"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveAppId}
              className="shrink-0 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-sm font-bold cursor-pointer"
            >
              Save App ID
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Saved to this browser and applied on the next reload. Leave it blank to fall back to the
            built-in default. The server-to-server REST key stays on the deployment only.
          </p>
        </div>

        {pushSteps.length > 0 && (
          <div className="mt-5 space-y-2.5" data-testid="push-steps">
            {pushSteps.map((step) => {
              const meta = PUSH_STEP_META[step.status];
              const canFix = step.status !== 'pass' && step.status !== 'fixed';
              return (
                <div key={step.id} data-testid={`push-step-${step.id}`} className={`rounded-2xl border p-3.5 ${meta.ring}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 ${meta.text}`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{step.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFixStep(step.id)}
                          disabled={pushBusy !== null}
                          data-testid={`push-fix-${step.id}`}
                          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                            canFix
                              ? 'border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                              : 'border-neutral-700 bg-neutral-800/40 text-neutral-400 hover:bg-neutral-800'
                          }`}
                        >
                          {pushBusy === step.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Wrench className="w-3 h-3" />
                          )}
                          <span>{PUSH_STEP_FIX_ACTION[step.id] ?? 'Fix this step'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-neutral-300 mt-1 break-words">{step.detail}</p>
                      {step.facts && step.facts.length > 0 && (
                        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                          {step.facts.map((f) => (
                            <div key={f.label} className="flex items-baseline justify-between gap-2 border-b border-neutral-800/60 pb-0.5">
                              <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{f.label}</dt>
                              <dd
                                className={`text-[11px] font-mono truncate ${
                                  f.ok === false ? 'text-rose-300' : f.ok === true ? 'text-emerald-300' : 'text-neutral-300'
                                }`}
                                title={f.value}
                              >
                                {f.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
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

      {/* Every catalogue test, grouped by area, each with one Test & Repair action */}
      {AREA_ORDER.filter((area) => {
        if (!failuresOnly) return true;
        const areaResults = results.filter((r) => r.area === area);
        return areaResults.some((r) => r.status === 'fail' || r.status === 'warn');
      }).map((area) => {
        const areaTests = FEATURE_TESTS.filter((t) => t.area === area);
        const areaResults = results.filter((r) => r.area === area);
        const resultById = new Map(areaResults.map((r) => [r.id, r]));
        const isCollapsed = collapsed[area];
        const areaSummary = summarize(areaResults);
        const isVerified = verifiedAreas.includes(area);
        const isAreaRunning = areaRunning === area;
        const bad = areaResults.filter((r) => r.status === 'fail' || r.status === 'warn');
        const target = bad.length
          ? resolveRepairTarget({
              area,
              tables: Array.from(new Set(bad.flatMap((r) => r.tables ?? []))),
              id: (bad.find((r) => r.status === 'fail') ?? bad[0]).id,
            })
          : null;
        return (
          <div
            key={area}
            data-testid={`area-${area}`}
            className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [area]: !c[area] }))}
                className="flex items-center gap-2 text-white font-bold text-sm cursor-pointer"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {AREA_LABELS[area]}
                <span className="text-[11px] font-mono text-neutral-400">
                  {areaSummary.pass}/{areaTests.length} ok
                </span>
                {!isVerified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-500/40 bg-amber-500/10 text-amber-300">
                    not run yet
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleTestAndRepairArea(area)}
                disabled={areaRunning !== null}
                data-testid={`test-repair-${area}`}
                className="px-3.5 py-1.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-wait text-neutral-950 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-500/20"
              >
                {isAreaRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                <span>{isAreaRunning ? 'Testing…' : 'Test & Repair'}</span>
              </button>
            </div>

            {/* Per-area repair banner: only after a run finds problems, and only
                when the resolver points at a service that can actually fix them. */}
            {target && target.service !== 'none' && (
              <div
                data-testid={`repair-banner-${area}`}
                className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <p className="text-[11px] text-amber-200/90 flex items-start gap-1.5 max-w-xl">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{target.hint}</span>
                </p>
                <button
                  type="button"
                  onClick={() => void applyRepairTarget(target, (bad.find((r) => r.status === 'fail') ?? bad[0]))}
                  data-testid={`repair-action-${area}`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{target.label}</span>
                </button>
              </div>
            )}

            {!isCollapsed && (
              <div className="mt-4 space-y-2.5">
                {areaTests.map((test) => renderTestRow(test, resultById.get(test.id)))}
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
