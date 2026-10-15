import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
  Copy,
  Check,
  Wrench,
  ExternalLink,
  Award,
  ShieldCheck,
  UserCog,
  Sparkles,
  KeyRound,
  Settings2,
  Layers3,
  LogIn,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { apiUrl } from '../utils/apiBase';
import { supabase } from '../lib/supabase';
import { dispatchTestEmail } from '../utils/notificationService';
import {
  initOneSignal,
  getPushPermission,
  requestPushPermission,
  getSubscriptionId,
  isPushSubscribed,
  optInPushSubscription,
  getConfiguredAppId,
  getPushRuntimeDiagnostic,
  getNativePushDeliveryDiagnostics,
  NativePushDeliveryDiagnostics,
  setConfiguredAppId,
  linkUser,
  registerEmailSubscription,
} from '../utils/pushNotifications';
import { runPushRepair, PushRepairStep, PushRepairStatus, PUSH_STEP_FIX_ACTION } from '../utils/pushRepair';
import { sendNativeAndroidTestPush, NativePushTestResult } from '../utils/nativePushTest';
import { fetchAuthHealth, provisionMemberLogin, AuthHealth } from '../utils/authHealth';
import { generateRepairSqlForTables, generateProfileBalanceProbeSql } from '../utils/schemaSync';
import { getStoredSupabaseUrl } from '../supabase';
import { GeminiDiagnosticReport, runGeminiDiagnostics } from '../api/geminiDiagnostics';
import { GEMINI_MODELS, resolveGeminiModel, GeminiTier } from '../api/geminiModel';
import { runShopGalleryStorageDiagnostics, SHOP_GALLERY_REPAIR_SQL, StorageDiagnosticReport } from '../api/storageDiagnostics';
import { RepairTarget, resolveRepairTarget, oneSignalDashboardUrl } from '../utils/repairTargets';
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

type Toast = { kind: 'ok' | 'err' | 'warn'; text: string } | null;
type BenchSection = 'overview' | 'ai' | 'notifications' | 'account' | 'features';

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
  const [nativePushTest, setNativePushTest] = useState<NativePushTestResult | null>(null);
  const [nativePushError, setNativePushError] = useState<string | null>(null);
  const [nativePushReceived, setNativePushReceived] = useState(false);
  const [phonePushDiagnostics, setPhonePushDiagnostics] = useState<NativePushDeliveryDiagnostics | null>(null);
  const [phonePushError, setPhonePushError] = useState<string | null>(null);
  const [appIdDraft, setAppIdDraft] = useState<string>(() => getConfiguredAppId());
  // Member sign-in repair (the "customers can't sign in" class of outage).
  const [authHealth, setAuthHealth] = useState<AuthHealth | null>(null);
  const [authBusy, setAuthBusy] = useState<string | null>(null);
  const [repairEmail, setRepairEmail] = useState('');
  const [repairPassword, setRepairPassword] = useState('');
  const [repairUserId, setRepairUserId] = useState('');
  const [geminiReport, setGeminiReport] = useState<GeminiDiagnosticReport | null>(null);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiCommandCopied, setGeminiCommandCopied] = useState(false);
  const [storageReport, setStorageReport] = useState<StorageDiagnosticReport | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<BenchSection>('overview');
  const [geminiModel, setGeminiModel] = useState(resolveGeminiModel());
  const [geminiTier, setGeminiTier] = useState<GeminiTier>('free');
  const [geminiSettingsLoaded, setGeminiSettingsLoaded] = useState(false);
  const [geminiSettingsSaving, setGeminiSettingsSaving] = useState(false);
  const [savedGeminiSettings, setSavedGeminiSettings] = useState({ model: resolveGeminiModel(), tier: 'free' as GeminiTier });

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error }: any = await supabase?.from('gemini_runtime_settings').select('model,tier').eq('id', true).maybeSingle();
        if (!alive) return;
        if (!error && data) {
          const model = GEMINI_MODELS.some(option => option.id === data.model) ? data.model : resolveGeminiModel();
          const tier: GeminiTier = data.tier === 'paid' ? 'paid' : 'free';
          setGeminiModel(model);
          setGeminiTier(tier);
          setSavedGeminiSettings({ model, tier });
        }
        setGeminiSettingsLoaded(true);
      } catch {
        if (alive) setGeminiSettingsLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleGeminiSettingsSave = async () => {
    if (!supabase) {
      flash({ kind: 'err', text: 'Supabase is not configured.' });
      return;
    }
    setGeminiSettingsSaving(true);
    try {
      const { data, error } = await supabase.from('gemini_runtime_settings')
        .update({ model: geminiModel, tier: geminiTier, updated_at: new Date().toISOString() })
        .eq('id', true).select('model,tier').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No shared Gemini setting row was updated. Apply the Gemini settings migration first.');
      const saved = { model: String(data.model), tier: data.tier === 'paid' ? 'paid' as const : 'free' as const };
      setSavedGeminiSettings(saved);
      setGeminiModel(saved.model);
      setGeminiTier(saved.tier);
      flash({ kind: 'ok', text: `Gemini settings saved for all AI features: ${saved.model} · ${saved.tier} tier preference.` });
    } catch (error: any) {
      flash({ kind: 'err', text: error?.message || 'Could not save Gemini settings. Check staff access and apply the migration.' });
    } finally {
      setGeminiSettingsSaving(false);
    }
  };

  const summary = useMemo(() => summarize(results), [results]);

  const handleGeminiCheck = async () => {
    setGeminiBusy(true);
    setGeminiReport(null);
    try {
      const report = await runGeminiDiagnostics();
      setGeminiReport(report);
      flash(report.passed
        ? { kind: 'ok', text: 'Gemini is working through the Supabase gateway.' }
        : { kind: 'err', text: 'Gemini check found the failing stage below.' });
    } catch (error: any) {
      flash({ kind: 'err', text: error?.message || 'Gemini diagnostics could not complete.' });
    } finally {
      setGeminiBusy(false);
    }
  };

  const copyGeminiDeployCommand = async () => {
    try {
      await navigator.clipboard.writeText('supabase functions deploy gemini-gateway');
      setGeminiCommandCopied(true);
      setTimeout(() => setGeminiCommandCopied(false), 2500);
    } catch {
      flash({ kind: 'err', text: 'Could not copy the deploy command.' });
    }
  };

  const geminiProjectRef = (() => {
    try { return new URL(getStoredSupabaseUrl()).hostname.split('.')[0]; }
    catch { return ''; }
  })();
  const geminiSecretsUrl = geminiProjectRef
    ? `https://supabase.com/dashboard/project/${geminiProjectRef}/functions/secrets`
    : 'https://supabase.com/dashboard';

  const handleStorageCheck = async () => {
    setStorageBusy(true);
    setStorageReport(null);
    try {
      const report = await runShopGalleryStorageDiagnostics(supabase?.storage as any);
      setStorageReport(report);
      flash(report.passed
        ? { kind: 'ok', text: 'Shop/gallery bucket, staff upload, public read, and cleanup all passed.' }
        : { kind: 'err', text: 'Storage check found a failing bucket step below.' });
    } catch (error: any) {
      flash({ kind: 'err', text: error?.message || 'Storage diagnostics could not complete.' });
    } finally {
      setStorageBusy(false);
    }
  };

  const openStorageRepair = () => setFixSql({
    title: 'Shop & Gallery Storage — setup / repair',
    sql: SHOP_GALLERY_REPAIR_SQL,
  });

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
      // Check the steps without sending a remote test notification, then open
      // the dashboard for settings the app cannot change.
      await handlePushCheck();
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
      const runtime = await getPushRuntimeDiagnostic();
      if (runtime.client === 'android-native') {
        const { data, error } = await supabase.functions.invoke('onesignal-gateway', { body: { action: 'config' }, signal: AbortSignal.timeout(15000) });
        if (error) throw new Error('Native push gateway configuration could not be checked.');
        return { appId: data?.androidAppId ?? null, serverPush: Boolean(data?.serverPush), restKeyEnv: data?.keySource ?? null, restKeyEnvNames: ['ONESIGNAL_APP_API_KEY', 'ONESIGNAL_REST_API_KEY'] };
      }
      const res = await fetch(apiUrl('/api/onesignal/config'));
      const data = await res.json();
      return {
        appId: data?.appId ?? null,
        serverPush: Boolean(data?.serverPush),
        restKeyEnv: data?.restKeyEnv ?? null,
        restKeyEnvNames: data?.restKeyEnvNames,
      };
    },
    initSdk: initOneSignal,
    getRuntimeDiagnostic: getPushRuntimeDiagnostic,
    getPermission: getPushPermission,
    requestPermission: requestPushPermission,
    getSubscriptionId,
    isSubscribed: isPushSubscribed,
    optInSubscription: optInPushSubscription,
    getConfiguredAppId,
    linkUser,
    registerEmail: registerEmailSubscription,
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

  const handleNativePushTest = async () => {
    setPushBusy('native-test');
    setNativePushTest(null);
    setNativePushError(null);
    setNativePushReceived(false);
    try {
      const result = await sendNativeAndroidTestPush();
      setNativePushTest(result);
      flash({ kind: 'ok', text: 'OneSignal accepted the test for Android devices linked to this staff account. Check the tray on each phone.' });
    } catch (error: any) {
      const message = error?.message || 'Native push test failed.';
      setNativePushError(message);
      flash({ kind: 'err', text: message });
    } finally {
      setPushBusy(null);
    }
  };

  const handlePhonePushCheck = async () => {
    setPushBusy('phone-receipt');
    setPhonePushError(null);
    setPhonePushDiagnostics(null);
    try { setPhonePushDiagnostics(await getNativePushDeliveryDiagnostics()); }
    catch (error: any) { setPhonePushError(error?.message || 'Phone receipt check failed.'); }
    finally { setPushBusy(null); }
  };

  /**
   * Repairs a single step of the chain in isolation. Every step's probe is still
   * evaluated (so the list stays complete) but only this step's repair
   * side-effect runs — a precise "fix just this" action.
   */
  const handleFixStep = async (stepId: string) => {
    if (['permission', 'subscription', 'identity', 'email'].includes(stepId)) {
      const runtime = await getPushRuntimeDiagnostic();
      if (runtime.client !== 'android-native') {
        flash({ kind: 'warn', text: 'Open this test bench inside the Stakeys Cycles Android APK to fix native push on a device.' });
        return;
      }
    }
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
   * Read the Supabase Auth backend health. This is the "is the account service
   * actually up?" probe that distinguishes a real outage (email confirmation on
   * with no mailer) from a customer typing the wrong password.
   */
  const handleAuthCheck = async () => {
    setAuthBusy('check');
    try {
      const health = await fetchAuthHealth();
      setAuthHealth(health);
      if (!health) {
        flash({ kind: 'err', text: 'Could not reach the auth health endpoint on this deployment.' });
      } else if (health.needsAttention) {
        flash({ kind: 'warn', text: 'Auth backend needs attention — see the flags below.' });
      } else {
        flash({ kind: 'ok', text: 'Auth backend looks healthy.' });
      }
    } finally {
      setAuthBusy(null);
    }
  };

  /** Admin-gated repair: create/confirm a member login via the server. */
  const handleProvisionMember = async () => {
    const email = repairEmail.trim();
    if (!email.includes('@')) {
      flash({ kind: 'err', text: 'Enter the member’s email address first.' });
      return;
    }
    if (repairPassword.length < 6) {
      flash({ kind: 'err', text: 'Set a password of at least 6 characters for the member.' });
      return;
    }
    setAuthBusy('provision');
    try {
      const res = await provisionMemberLogin(email, repairPassword, {
        userId: repairUserId.trim() || undefined,
        metadata: { full_name: currentUser?.displayName, repaired_via: 'staff-diagnostics' },
      });
      flash({ kind: res.success ? 'ok' : 'err', text: res.message || 'Repair finished.' });
      if (res.success) {
        setRepairPassword('');
        setRepairUserId('');
      }
    } finally {
      setAuthBusy(null);
    }
  };

  /**
   * The phone-side action: prompt for permission, force this device to opt in,
   * then immediately run the full check so the operator sees the subscription
   * appear in the step list.
   */
  const handleEnableDevice = async () => {
    const runtime = await getPushRuntimeDiagnostic();
    if (runtime.client !== 'android-native') {
      flash({ kind: 'warn', text: 'Open this test bench inside the Stakeys Cycles Android APK to enable native Android push.' });
      return;
    }
    setPushBusy('device');
    try {
      const perm = await requestPushPermission();
      if (perm !== 'granted') {
        flash({
          kind: 'err',
          text:
            perm === 'not_configured'
              ? 'Push App ID is missing. Android requires VITE_ONESIGNAL_ANDROID_APP_ID or the server Android App ID.'
              : perm === 'timeout' ? 'Push setup timed out. Check your connection, close any permission prompt, then retry.'
              : 'Notifications are blocked. Allow them in your browser/phone settings, then retry.',
        });
        return;
      }
      const subscriptionId = await optInPushSubscription();
      flash(subscriptionId
        ? { kind: 'ok', text: 'This device is registered. The step results below have been refreshed.' }
        : { kind: 'err', text: 'Permission allowed. Device registration is still pending — check your connection and try again.' });
      if (subscriptionId) {
        const steps = await runPushRepair(pushRepairDeps, pushRepairContext, { repair: false });
        setPushSteps(steps);
      }

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
      <div className="surface-panel !rounded-3xl p-6 shadow-xl">
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

      <nav aria-label="Test bench sections" className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2">
        {([
          ['overview', 'Overview', FlaskConical],
          ['ai', 'AI & Storage', Sparkles],
          ['notifications', 'Notifications', Bell],
          ['account', 'Sign-in', LogIn],
          ['features', 'App features', Layers3],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${activeSection === id ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {activeSection === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="test-bench-overview">
          {[
            ['AI & Storage', 'Choose a shared Gemini model and tier preference, test the gateway, and repair the shop image bucket.'],
            ['Notifications', 'Check OneSignal setup, native Android delivery, and notification channels.'],
            ['Sign-in & App features', 'Repair staff access and run focused checks for individual app areas.'],
          ].map(([title, detail]) => <div key={title} className="surface-panel !rounded-2xl p-4"><p className="text-sm font-black text-white">{title}</p><p className="mt-1 text-xs leading-relaxed text-neutral-400">{detail}</p></div>)}
        </div>
      )}

      {/* Gemini gateway test and repair */}
      <div hidden={activeSection !== 'ai'} className="surface-panel !rounded-3xl p-6 shadow-xl" data-testid="gemini-repair-panel">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-violet-500/30 bg-violet-500/10 p-2 text-violet-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-base font-black text-white">Gemini Test &amp; Repair</h3>
              <p className="mt-1 max-w-2xl text-xs text-neutral-400">
                Checks the app connection, deployed Supabase gateway, server-side key presence, then makes one tiny live request to the latest Flash model. It never displays or copies the key.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGeminiCheck}
              disabled={geminiBusy}
              data-testid="test-gemini-gateway"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500/15 px-4 py-2.5 text-sm font-bold text-violet-100 border border-violet-500/40 hover:bg-violet-500/25 disabled:opacity-60"
            >
              {geminiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {geminiBusy ? 'Checking Gemini…' : 'Run Gemini Check'}
            </button>
            <a
              href={geminiSecretsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-700"
            >
              <KeyRound className="h-4 w-4" /> Supabase Secrets <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-700"
            >
              Google AI Studio <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end" data-testid="gemini-model-settings">
          <label className="block text-xs font-bold text-neutral-300">Gemini model
            <select value={geminiModel} onChange={event => setGeminiModel(event.target.value)} disabled={!geminiSettingsLoaded || geminiSettingsSaving}
              className="mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white">
              {GEMINI_MODELS.filter(option => geminiTier === 'paid' || option.free).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-neutral-300">Intended API tier
            <select value={geminiTier} onChange={event => {
              const tier = event.target.value as GeminiTier;
              setGeminiTier(tier);
              if (tier === 'free' && !GEMINI_MODELS.find(option => option.id === geminiModel)?.free) setGeminiModel(resolveGeminiModel());
            }} disabled={!geminiSettingsLoaded || geminiSettingsSaving}
              className="mt-1.5 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white">
              <option value="free">Free tier · no paid-only models</option>
              <option value="paid">Paid tier · paid-only models allowed</option>
            </select>
          </label>
          <button type="button" onClick={() => void handleGeminiSettingsSave()} disabled={!geminiSettingsLoaded || geminiSettingsSaving || (savedGeminiSettings.model === geminiModel && savedGeminiSettings.tier === geminiTier)}
            data-testid="save-gemini-settings" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">
            {geminiSettingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}{geminiSettingsSaving ? 'Saving…' : 'Save shared setting'}
          </button>
          <p className="text-[11px] leading-relaxed text-neutral-400 md:col-span-3">This setting is shared by Gemini features. “Free” limits the app to models Google lists for free-tier access. The actual billing tier is controlled by the Google project attached to the server-side API key; choosing Paid here does not enable billing in Google Cloud. Check Google AI Studio before using paid-only models.</p>
        </div>

        {geminiReport && (
          <div className="mt-5 space-y-2.5" data-testid="gemini-diagnostic-results">
            <p className="text-xs font-bold text-neutral-300">Server selection: <span className="font-mono text-violet-200">{geminiReport.model}</span><span className="ml-2 rounded-full border border-violet-500/30 px-2 py-0.5 text-[10px] uppercase text-violet-200">{geminiReport.tier} tier preference</span></p>
            {geminiReport.steps.map((step, index) => {
              const good = step.status === 'pass';
              const skipped = step.status === 'skipped';
              return (
                <div key={step.id} data-testid={`gemini-step-${step.id}`} className={`rounded-xl border p-3 ${good ? 'border-emerald-500/30 bg-emerald-500/5' : skipped ? 'border-neutral-700 bg-neutral-800/30' : 'border-rose-500/35 bg-rose-500/5'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${good ? 'text-emerald-300' : skipped ? 'text-neutral-400' : 'text-rose-300'}`}>Step {index + 1}</span>
                    <span className="text-sm font-bold text-white">{step.label}</span>
                    <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${good ? 'border-emerald-500/30 text-emerald-200' : skipped ? 'border-neutral-600 text-neutral-300' : 'border-rose-500/30 text-rose-200'}`}>
                      {good ? 'Working' : skipped ? 'Skipped' : 'Needs repair'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-neutral-300">{step.detail}</p>
                  {step.repair && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-200"><Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />{step.repair}</p>}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={copyGeminiDeployCommand} className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-200 hover:bg-neutral-800">
                {geminiCommandCopied ? 'Deploy command copied' : 'Copy gateway deploy command'}
              </button>
              <code className="text-[11px] text-neutral-500">supabase functions deploy gemini-gateway</code>
            </div>
          </div>
        )}
      </div>

      {/* Supabase Storage bucket test and repair */}
      <div hidden={activeSection !== 'ai'} className="surface-panel !rounded-3xl p-6 shadow-xl" data-testid="storage-bucket-repair-panel">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-2 text-sky-300">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Supabase Bucket Test &amp; Repair</h3>
              <p className="mt-1 max-w-2xl text-xs text-neutral-400">
                Checks the shop-gallery bucket, staff upload permission, public image delivery, and removes its temporary test image. Repair SQL is safe to re-run and restores the bucket and its intended policies.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStorageCheck}
              disabled={storageBusy}
              data-testid="test-storage-bucket"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2.5 text-sm font-bold text-sky-100 border border-sky-500/40 hover:bg-sky-500/25 disabled:opacity-60"
            >
              {storageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {storageBusy ? 'Checking bucket…' : 'Test shop-gallery bucket'}
            </button>
            <button
              type="button"
              onClick={openStorageRepair}
              data-testid="repair-storage-bucket"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-700"
            >
              <Wrench className="h-4 w-4" /> Setup / repair SQL
            </button>
          </div>
        </div>
        {storageReport && (
          <div className="mt-5 space-y-2" data-testid="storage-bucket-results">
            {storageReport.steps.map((step, index) => (
              <div key={step.id} data-testid={`storage-step-${step.id}`} className={`rounded-xl border p-3 ${step.status === 'pass' ? 'border-emerald-500/30 bg-emerald-500/5' : step.status === 'skipped' ? 'border-neutral-700 bg-neutral-800/30' : 'border-rose-500/35 bg-rose-500/5'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Step {index + 1}</span>
                  <span className="text-sm font-bold text-white">{step.label}</span>
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${step.status === 'pass' ? 'border-emerald-500/30 text-emerald-200' : step.status === 'skipped' ? 'border-neutral-600 text-neutral-300' : 'border-rose-500/30 text-rose-200'}`}>
                    {step.status === 'pass' ? 'Working' : step.status === 'skipped' ? 'Skipped' : 'Needs repair'}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs text-neutral-300">{step.detail}</p>
              </div>
            ))}
            {!storageReport.passed && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <p className="mr-auto text-xs text-amber-100">Use the repair SQL, then rerun the bucket test.</p>
                <button type="button" onClick={openStorageRepair} className="rounded-lg border border-sky-500/40 px-3 py-2 text-xs font-bold text-sky-100 hover:bg-sky-500/10">Open repair SQL</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OneSignal push repair */}
      <div hidden={activeSection !== 'notifications'} className="surface-panel !rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                OneSignal Step-by-Step Test Bench
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                Check the setup in order, then fix one highlighted step at a time. Checks are read-only; device
                permission and subscription change only when you choose those actions. Enable notifications on each
                phone, then the test sends to Android devices signed in to this same staff account.
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
              onClick={handleNativePushTest}
              disabled={pushBusy !== null}
              data-testid="test-native-android-push"
              className="px-4 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-60 border border-sky-500/40 text-sky-200 text-sm font-bold flex items-center gap-2"
            >
              {pushBusy === 'native-test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
              <span>Test My Android Devices</span>
            </button>
            <button
              type="button"
              onClick={handlePushCheck}
              disabled={pushBusy !== null}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-200 text-sm font-bold flex items-center gap-2 border border-neutral-700 cursor-pointer"
            >
              {pushBusy === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Check each step</span>
            </button>
            <button
              type="button"
              onClick={() => window.open(oneSignalDashboardUrl(appIdDraft || getConfiguredAppId()), '_blank', 'noopener')}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-bold flex items-center gap-2 border border-neutral-700 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open OneSignal settings</span>
            </button>
          </div>
        </div>

        {/* App ID configuration */}
        {!Capacitor.isNativePlatform() && <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Web OneSignal App ID override
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
            This override applies to the browser SDK after reload. The Android APK uses its built-in App ID.
            Leave this blank to use the configured default. The REST key stays on the server.
          </p>
        </div>}

        {nativePushError && (
          <div role="alert" className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-2 text-sm text-red-100" data-testid="native-push-test-error">
            <p className="font-bold">Native push test failed — no successful send confirmed</p>
            <p className="break-words">{nativePushError}</p>
            <p className="text-xs text-red-200">This error stays here until you retry. Share it to diagnose the failure; a working server key or SDK startup alone does not confirm delivery.</p>
          </div>
        )}
        {nativePushTest && (
          <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2 text-sm text-sky-100" data-testid="native-push-test-result">
            <p>{nativePushReceived ? 'Receipt confirmed by you on an Android device.' : 'Accepted by OneSignal. Check the tray on your signed-in Android phones; receipt is still pending.'}</p>
            <p className="text-xs">Target: Android devices linked to this signed-in staff account{nativePushTest.recipients === null ? '' : ` · ${nativePushTest.recipients} accepted`}</p>
            <p className="text-xs break-all">OneSignal message: {nativePushTest.messageId}</p>
            {!nativePushReceived && <button type="button" onClick={() => setNativePushReceived(true)} className="pressable rounded-xl border border-emerald-500/40 px-3 py-2 text-emerald-200">I received it on an Android device</button>}
          </div>
        )}
        {Capacitor.isNativePlatform() && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 p-4 space-y-2 text-sm">
            <button type="button" onClick={handlePhonePushCheck} disabled={Boolean(pushBusy)} className="pressable rounded-xl border border-emerald-500/40 px-3 py-2 text-emerald-200">Check Android receipt and channels</button>
            <p className="text-xs text-slate-400">Reads this phone only. Does not send another notification.</p>
            {phonePushError && <p role="alert">{phonePushError}</p>}
            {phonePushDiagnostics && <div data-testid="phone-push-diagnostics" className="space-y-1 break-words">
              <p>Android notifications: {phonePushDiagnostics.notificationsEnabled ? 'Enabled' : 'BLOCKED'}</p>
              <p>FCM token: {phonePushDiagnostics.hasPushToken ? 'Registered' : 'MISSING'}</p>
              <p>Do Not Disturb: {phonePushDiagnostics.interruptionFilter === 1 ? 'Off' : phonePushDiagnostics.interruptionFilter === 0 ? 'Unknown' : 'On / filtered'}</p>
              <p>{!nativePushTest ? 'No current test to match. Receipt recording begins with this APK.' : phonePushDiagnostics.lastMessageId === nativePushTest.messageId ? 'This test reached the Android OneSignal receiver.' : 'This test has not been recorded by the Android receiver.'}</p>
              {phonePushDiagnostics.lastMessageId && <p className="text-xs">Last received message: {phonePushDiagnostics.lastMessageId} · {new Date(phonePushDiagnostics.receivedAt).toLocaleString()}</p>}
              <p>Last received notification in tray: {phonePushDiagnostics.lastMessageInTray ? 'Yes' : 'No'}</p>
              {phonePushDiagnostics.channels.map(channel => <p key={channel.id}>Channel {channel.name}: {channel.importance === 0 ? 'BLOCKED' : channel.importance < 3 ? 'Silent / low importance' : 'Alerts enabled'}</p>)}
              {!phonePushDiagnostics.channels.length && <p>No notification channels have been created yet.</p>}
            </div>}
          </div>
        )}
        {pushSteps.length > 0 && (
          <div className="mt-5 space-y-2.5" data-testid="push-steps">
            {pushSteps.map((rawStep, index) => {
              const step: PushRepairStep = rawStep.id === 'dispatch' && nativePushTest ? {
                ...rawStep,
                status: nativePushReceived ? 'pass' : 'warn',
                detail: nativePushReceived ? 'Native Android notification received (confirmed by you).' : 'Native test accepted; Android-device receipt is pending.',
                hint: nativePushReceived ? undefined : 'Check the notification tray on your Android phones signed in to this staff account, then confirm receipt.',
                facts: [
                  { label: 'Target', value: 'Signed-in staff Android devices', ok: true },
                  ...(nativePushTest.recipients === null ? [] : [{ label: 'Accepted recipients', value: String(nativePushTest.recipients), ok: true }]),
                  { label: 'OneSignal message ID', value: nativePushTest.messageId, ok: true },
                ],
              } : rawStep;
              const meta = PUSH_STEP_META[step.status];
              const canFix = step.status !== 'pass' && step.status !== 'fixed' && step.id !== 'dispatch';
              return (
                <div key={step.id} data-testid={`push-step-${step.id}`} className={`rounded-2xl border p-3.5 ${meta.ring}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 ${meta.text}`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Step {index + 1}</span>
                          <span className="text-sm font-bold text-white">{step.label}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </div>
                        {step.id === 'dispatch' ? (
                          <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-200">
                            {nativePushReceived ? 'Receipt confirmed' : nativePushTest ? 'Accepted · awaiting receipt' : 'No remote test sent'}
                          </span>
                        ) : step.status === 'pass' || step.status === 'fixed' ? (
                          <span className="shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200">
                            Step complete
                          </span>
                        ) : <button
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
                        </button>}
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

      {/* Member sign-in repair */}
      <div hidden={activeSection !== 'account'} className="surface-panel !rounded-3xl p-6 shadow-xl" data-testid="auth-repair-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">Member Sign-In Repair</div>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                Customers report &ldquo;I can&rsquo;t sign in to the app&rdquo;. This checks the Supabase Auth
                backend (is sign-up actually able to send confirmation emails?) and lets an administrator
                create or confirm a member login without touching the SQL Editor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAuthCheck}
            disabled={authBusy !== null}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-200 text-sm font-bold flex items-center gap-2 border border-neutral-700 cursor-pointer"
          >
            {authBusy === 'check' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Check Sign-In Service</span>
          </button>
        </div>

        {authHealth && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <AuthFlag label="Auth reachable" ok={authHealth.reachable} />
            <AuthFlag label="Sign-ups enabled" ok={authHealth.signupsEnabled} />
            <AuthFlag label="Email confirmation off" ok={authHealth.mailerAutoconfirm} />
            <AuthFlag label="Service role on server" ok={authHealth.hasServiceRole} />
            <AuthFlag label="Admin repair enabled" ok={authHealth.adminConfigured} />
            <AuthFlag label="Overall" ok={!authHealth.needsAttention} />
          </div>
        )}
        {authHealth?.needsAttention && (
          <p className="text-[11px] text-amber-300/90 mt-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              With email confirmation ON and no working mailer, every new sign-up fails and no member can
              confirm. Set <code className="font-mono">mailer_autoconfirm=true</code> (or configure SMTP) in
              Supabase Auth settings, then repair the affected logins below.
            </span>
          </p>
        )}

        <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex items-center gap-2 text-neutral-200 text-xs font-bold uppercase tracking-wider mb-3">
            <UserCog className="w-4 h-4 text-emerald-400" />
            Create / confirm a member login
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="email"
              value={repairEmail}
              onChange={(e) => setRepairEmail(e.target.value)}
              placeholder="member@email.com"
              spellCheck={false}
              className="px-3 py-2 rounded-xl bg-[#0b0e12] border border-neutral-700 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              value={repairPassword}
              onChange={(e) => setRepairPassword(e.target.value)}
              placeholder="New password (min 6)"
              className="px-3 py-2 rounded-xl bg-[#0b0e12] border border-neutral-700 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={repairUserId}
              onChange={(e) => setRepairUserId(e.target.value)}
              placeholder="Profile UUID (optional)"
              spellCheck={false}
              className="px-3 py-2 rounded-xl bg-[#0b0e12] border border-neutral-700 text-sm font-mono text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button
              type="button"
              onClick={handleProvisionMember}
              disabled={authBusy !== null}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 text-sm font-black flex items-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {authBusy === 'provision' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              <span>Repair Member Login</span>
            </button>
            <span className="text-[11px] text-neutral-500">
              Reuses the profile UUID when supplied so the login and loyalty card stay linked. Requires an
              administrator session; the server verifies it and holds the service-role key.
            </span>
          </div>
        </div>
      </div>

      {/* Notification channel quick tests */}
      <div hidden={activeSection !== 'notifications'} className="surface-panel !rounded-3xl p-6 shadow-xl">
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
      <div hidden={activeSection !== 'features'} className="space-y-4" data-testid="feature-test-section">
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
            className="surface-panel !rounded-3xl p-5 shadow-xl"
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
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm px-4 py-3 rounded-2xl border text-sm font-semibold shadow-2xl animate-fade-in ${
            toast.kind === 'ok'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : toast.kind === 'warn'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
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
      <div className="w-full max-w-2xl surface-panel !rounded-3xl p-6 text-white shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
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

const AuthFlag: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div
    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${
      ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    }`}
  >
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
    <span>{label}</span>
  </div>
);

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
