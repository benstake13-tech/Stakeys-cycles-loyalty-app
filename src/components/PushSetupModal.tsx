import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Wrench,
  FlaskConical,
  KeyRound,
  Smartphone,
  Server,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { getStoredSupabaseUrl } from '../supabase';
import { deriveProjectRef } from '../utils/emailSetup';
import { secretsPrompt } from '../utils/bookingAlertsSetup';
import {
  getPushPermission,
  requestPushPermission,
  getSubscriptionId,
  sendPushToUser,
  PushPermission,
} from '../utils/pushNotifications';
import {
  fetchPushConfig,
  hasRootScopeServiceWorker,
  ensureRootServiceWorker,
  permissionLabel,
} from '../utils/pushSetup';

type Toast = { kind: 'ok' | 'err'; text: string } | null;
type StepState = 'checking' | 'ok' | 'warn' | 'fail';
type CheckResult = { state: StepState; detail: string };

interface StepDef {
  key: string;
  title: string;
  why: string;
  howto: string;
  action?: { label: string; href: string };
}

/**
 * Staff-facing "Push Setup" control. Each part of the web-push pipeline —
 * device permission, the root-scope service worker, and the server-side App API
 * key — is a step with its own live check, its own Fix action and its own Test,
 * so staff can finish and verify the feature one step at a time.
 */
export const PushSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { ownerConfig } = useShop();

  const projectRef = useMemo(() => deriveProjectRef(getStoredSupabaseUrl()), []);
  const dash = `https://supabase.com/dashboard/project/${projectRef}`;

  const stepDefs: StepDef[] = useMemo(
    () => [
      {
        key: 'permission',
        title: 'Allow notifications on this device',
        why: 'Your phone must grant notification permission before any push can arrive.',
        howto: 'Press Fix — your browser asks to allow notifications. Choose Allow.',
      },
      {
        key: 'worker',
        title: 'Root service worker is registered',
        why: 'OneSignal needs a service worker at scope "/" to receive background pushes.',
        howto: 'Press Fix once notifications are allowed — it installs the worker automatically.',
      },
      {
        key: 'serverkey',
        title: 'Server push key is configured',
        why: 'Background pushes need the OneSignal App API key on the server, so alerts arrive with the app closed.',
        howto:
          'Press Fix to copy a prompt that sets ONESIGNAL_API_KEY (paste it to an AI agent, or add the line in the Secrets page), replacing the value with the App API key from your OneSignal dashboard.',
        action: { label: 'Open Secrets page', href: `${dash}/settings/functions` },
      },
    ],
    [dash]
  );

  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [busy, setBusy] = useState<Record<string, 'check' | 'fix' | 'test' | undefined>>({});
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  const mark = (key: string, result: CheckResult) => setChecks((prev) => ({ ...prev, [key]: result }));
  const setStepBusy = (key: string, v: 'check' | 'fix' | 'test' | undefined) =>
    setBusy((prev) => ({ ...prev, [key]: v }));

  const checkPermission = useCallback(async (): Promise<CheckResult> => {
    const perm = await getPushPermission();
    setPermission(perm);
    const state: StepState = perm === 'granted' ? 'ok' : perm === 'denied' ? 'fail' : 'warn';
    return { state, detail: permissionLabel(perm) };
  }, []);

  const checkWorker = useCallback(async (): Promise<CheckResult> => {
    const regs =
      typeof navigator !== 'undefined' && navigator.serviceWorker
        ? await navigator.serviceWorker.getRegistrations().catch(() => [])
        : [];
    const ok = hasRootScopeServiceWorker(regs as unknown as Array<{ scope?: string }>);
    return {
      state: ok ? 'ok' : 'warn',
      detail: ok
        ? 'Registered at scope "/".'
        : 'Not registered yet — press Fix (it installs once notifications are allowed).',
    };
  }, []);

  const checkServerKey = useCallback(async (): Promise<CheckResult> => {
    const config = await fetchPushConfig();
    return {
      state: config.serverPush ? 'ok' : 'warn',
      detail: config.serverPush
        ? 'Configured — alerts arrive even when the app is closed.'
        : 'Not configured. Foreground alerts work; closed-app alerts need ONESIGNAL_API_KEY on the server.',
    };
  }, []);

  const checkOne = useCallback(
    async (key: string) => {
      setStepBusy(key, 'check');
      try {
        const result =
          key === 'permission'
            ? await checkPermission()
            : key === 'worker'
            ? await checkWorker()
            : await checkServerKey();
        mark(key, result);
      } finally {
        setStepBusy(key, undefined);
      }
    },
    [checkPermission, checkWorker, checkServerKey]
  );

  const runAll = useCallback(async () => {
    setChecks(
      Object.fromEntries(stepDefs.map((s) => [s.key, { state: 'checking' as StepState, detail: 'Checking…' }]))
    );
    await Promise.all(stepDefs.map((s) => checkOne(s.key)));
  }, [stepDefs, checkOne]);

  useEffect(() => {
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- Fix actions ----------------------------- */

  const fixPermission = async () => {
    setStepBusy('permission', 'fix');
    try {
      const perm = await requestPushPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const id = await getSubscriptionId();
        setSubId(id);
        flash({ kind: 'ok', text: id ? `This device is subscribed (id ${id}).` : 'This device is subscribed.' });
      } else {
        flash({ kind: 'err', text: permissionLabel(perm) });
      }
      mark('permission', await checkPermission());
      mark('worker', await checkWorker());
    } finally {
      setStepBusy('permission', undefined);
    }
  };

  const fixWorker = async () => {
    setStepBusy('worker', 'fix');
    try {
      const ok = await ensureRootServiceWorker();
      mark('worker', {
        state: ok ? 'ok' : 'warn',
        detail: ok ? 'Registered at scope "/".' : 'Still not registered — allow notifications first, then retry.',
      });
      flash(
        ok
          ? { kind: 'ok', text: 'Root service worker registered.' }
          : { kind: 'err', text: 'Could not register the worker — allow notifications first.' }
      );
    } finally {
      setStepBusy('worker', undefined);
    }
  };

  const fixServerKey = async () => {
    try {
      await navigator.clipboard.writeText(
        secretsPrompt(projectRef, 'ONESIGNAL_API_KEY=os_v2_app_your-app-api-key')
      );
      flash({ kind: 'ok', text: 'Secrets prompt copied — paste it to an AI agent (or the Secrets page) with your real OneSignal App API key.' });
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — add ONESIGNAL_API_KEY manually.' });
    }
  };

  const fixFor = (key: string) =>
    key === 'permission' ? fixPermission : key === 'worker' ? fixWorker : fixServerKey;

  /* ----------------------------- Test actions ---------------------------- */

  const testFor = async (key: string) => {
    setStepBusy(key, 'test');
    try {
      if (key === 'permission') {
        const perm = await getPushPermission();
        setPermission(perm);
        flash(
          perm === 'granted'
            ? { kind: 'ok', text: 'Permission test passed — this device allows notifications.' }
            : { kind: 'err', text: `Permission test: ${permissionLabel(perm)}` }
        );
      } else if (key === 'worker') {
        const ok = await ensureRootServiceWorker();
        mark('worker', {
          state: ok ? 'ok' : 'warn',
          detail: ok ? 'Registered at scope "/".' : 'Not registered.',
        });
        flash(
          ok
            ? { kind: 'ok', text: 'Service worker test passed — a root-scope worker is active.' }
            : { kind: 'err', text: 'Service worker test failed — no root-scope worker.' }
        );
      } else {
        const res = await sendPushToUser(
          undefined,
          '🔔 Stakey’s test push',
          'If you can see this on your phone, push notifications are working.'
        );
        if (res.ok && res.via === 'server') {
          flash({ kind: 'ok', text: 'Server push test passed — it should arrive even with the app closed.' });
        } else if (res.ok && res.via === 'local') {
          flash({
            kind: 'ok',
            text: 'Shown as a local notification (app must stay open). Set the server key for closed-app pushes.',
          });
        } else {
          flash({ kind: 'err', text: 'Push test failed — allow notifications on this device first.' });
        }
      }
    } finally {
      setStepBusy(key, undefined);
    }
  };

  const statusIcon = (s: StepState | undefined) => {
    if (s === 'checking' || s === undefined)
      return <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />;
    if (s === 'ok') return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (s === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
    return <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
  };

  const allOk = stepDefs.every((s) => checks[s.key]?.state === 'ok');
  const anyChecking = Object.values(busy).some((b) => b === 'check');
  const recipient = ownerConfig.ownerEmail || 'your account';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-3xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Push Notification Setup</h3>
              <p className="text-xs text-neutral-400">
                Finish phone push alerts. Each step is checked live, with its own Fix and Test.
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

        {/* Status summary */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            allOk ? 'bg-emerald-950/30 border-emerald-600/40' : 'bg-amber-950/25 border-amber-600/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {allOk ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm">
                {allOk ? 'Push looks fully set up' : 'Push setup is not finished yet'}
              </div>
              <div className="text-xs text-neutral-400">
                {allOk
                  ? 'This device is subscribed and the server key is set.'
                  : 'Complete each step below — use Fix, then Test.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={runAll}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${anyChecking ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Re-check all</span>
          </button>
        </div>

        {/* Steps */}
        <ol className="space-y-3">
          {stepDefs.map((step, i) => {
            const result = checks[step.key];
            const b = busy[step.key];
            const done = result?.state === 'ok';
            return (
              <li key={step.key} className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
                <div className="flex items-start gap-3">
                  {statusIcon(result?.state)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-neutral-500">STEP {i + 1}</span>
                      <span className="font-bold text-sm">{step.title}</span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{step.why}</p>
                    <p className="text-[11px] text-emerald-300/90 mt-1 leading-relaxed">→ {step.howto}</p>
                    <p
                      className={`text-xs mt-1.5 ${
                        result?.state === 'ok'
                          ? 'text-emerald-300'
                          : result?.state === 'fail'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {result?.detail ?? 'Checking…'}
                    </p>
                  </div>
                  {step.action && (
                    <a
                      href={step.action.href}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{step.action.label}</span>
                    </a>
                  )}
                </div>

                {/* Per-step buttons */}
                <div className="pl-8 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => checkOne(step.key)}
                    disabled={!!b}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${b === 'check' ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Check</span>
                  </button>
                  <button
                    type="button"
                    onClick={fixFor(step.key)}
                    disabled={!!b || done}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {b === 'fix' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5" />
                    )}
                    <span>{step.key === 'serverkey' ? 'Copy env line' : 'Fix'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => testFor(step.key)}
                    disabled={!!b}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {b === 'test' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Test</span>
                  </button>
                </div>

                {step.key === 'permission' && permission === 'denied' && (
                  <p className="pl-8 text-[11px] text-rose-300 leading-relaxed">
                    Permission is blocked — open your browser/phone notification settings for this site and
                    re-allow, then press Check.
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {/* Overall test */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Send a real test to my phone</h4>
          </div>
          <button
            type="button"
            onClick={() => testFor('serverkey')}
            disabled={!!busy['serverkey']}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {busy['serverkey'] === 'test' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Send a test push</span>
          </button>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Uses the same path as booking alerts. With the server key set it arrives even when the app is
            closed; otherwise it only appears while the app is open.
          </p>
          {subId && <p className="text-[11px] text-neutral-500 font-mono">This device id: {subId}</p>}
        </div>

        {/* How booking alerts reach you */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">How booking alerts reach you</h4>
          </div>
          <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>A new booking is created in the app.</li>
            <li>The app asks the server to push to the <strong>staff</strong> segment.</li>
            <li>Your subscribed phone receives the alert — even with the app closed, once the server key is set.</li>
          </ol>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500">
          <KeyRound className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
          <span>
            The REST API key is a server secret and never reaches the browser. Alerts for {recipient} are
            delivered through the staff segment.
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
