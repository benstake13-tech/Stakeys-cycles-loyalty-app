import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Send,
  Webhook,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { getStoredSupabaseUrl, getStoredSupabaseAnonKey } from '../supabase';
import { getSupabaseClient } from '../lib/supabase';
import { probeEdgeFunction, deriveProjectRef, testWorkshopEmail, EmailTestResult } from '../utils/emailSetup';
import { deployFunctionsPrompt, secretsPrompt, envTemplate } from '../utils/bookingAlertsSetup';
import { dispatchTestEmail } from '../utils/notificationService';

type Toast = { kind: 'ok' | 'err'; text: string } | null;
type StepState = 'unknown' | 'checking' | 'ok' | 'fail';

interface Step {
  key: string;
  title: string;
  why: string;
  state: StepState;
  detail: string;
  action: { label: string; href: string };
}

/**
 * Staff-facing "Email Setup" control. Walks through every step required to make
 * booking-notification emails work — deploying both edge functions, creating the
 * database webhook and setting the workshop recipient — checks each against the
 * live project, and lets staff exercise each stage with a real test.
 */
export const EmailSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { ownerConfig } = useShop();

  const supabaseUrl = useMemo(() => getStoredSupabaseUrl(), []);
  const anonKey = useMemo(() => getStoredSupabaseAnonKey(), []);
  const projectRef = useMemo(() => deriveProjectRef(supabaseUrl), [supabaseUrl]);
  const dash = `https://supabase.com/dashboard/project/${projectRef}`;

  const [steps, setSteps] = useState<Step[]>([]);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [testResult, setTestResult] = useState<EmailTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const webhookSql = useMemo(
    () =>
      `-- Creates the trigger that alerts the workshop the moment a booking is inserted.
-- Replace <SERVICE_ROLE_KEY> with Project Settings -> API -> service_role secret.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_booking_webhook()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := '${supabaseUrl}/functions/v1/notify-booking',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := jsonb_build_object(
      'type', 'INSERT', 'table', 'service_bookings', 'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists notify_booking_on_insert on public.service_bookings;
create trigger notify_booking_on_insert
  after insert on public.service_bookings
  for each row execute function public.notify_booking_webhook();`,
    [supabaseUrl]
  );

  const deployCmd = useMemo(
    () =>
      deployFunctionsPrompt(projectRef) +
      '\n\n---\n\n' +
      secretsPrompt(projectRef, envTemplate()),
    [projectRef]
  );

  const flash = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  };

  const runChecks = useCallback(async () => {
    setChecking(true);
    const pending = (key: string, title: string, why: string, action: Step['action']): Step => ({
      key,
      title,
      why,
      state: 'checking',
      detail: 'Checking…',
      action,
    });
    setSteps([
      pending('send-email', 'Deploy the send-email function', 'Sends the customer confirmation, approval/decline emails and the staff test email.', {
        label: 'Open Edge Functions',
        href: `${dash}/functions`,
      }),
      pending('notify-booking', 'Deploy the notify-booking function', 'The webhook target that emails the workshop when a booking is created.', {
        label: 'Open Edge Functions',
        href: `${dash}/functions`,
      }),
      pending('webhook', 'Create the database webhook', 'Fires notify-booking the instant a booking row is inserted (server-side, so it works even if the customer closes the tab).', {
        label: 'Open Database → Webhooks',
        href: `${dash}/database/webhooks`,
      }),
      pending('recipient', 'Set the workshop recipient & enable alerts', 'The address the workshop alert is sent to.', {
        label: 'Open Staff Bookings',
        href: '#',
      }),
    ]);

    const [sendEmail, notifyBooking] = await Promise.all([
      probeEdgeFunction(supabaseUrl, anonKey, 'send-email'),
      probeEdgeFunction(supabaseUrl, anonKey, 'notify-booking'),
    ]);

    // The webhook runs server-side, so its presence cannot be read with the anon
    // key. We infer readiness from the deployed function; the manual SQL/Dashboard
    // step is called out explicitly.
    const webhookReady = notifyBooking.deployed;
    const recipientReady = Boolean(ownerConfig.ownerEmail) && ownerConfig.emailAlertsEnabled;

    const built: Step[] = [
      {
        key: 'send-email',
        title: 'Deploy the send-email function',
        why: 'Sends the customer confirmation, approval/decline emails and the staff test email.',
        state: sendEmail.deployed ? 'ok' : 'fail',
        detail: sendEmail.deployed
          ? `Deployed (${sendEmail.detail}).`
          : `${sendEmail.detail} — deploy it with the prompt below.`,
        action: { label: 'Open Edge Functions', href: `${dash}/functions` },
      },
      {
        key: 'notify-booking',
        title: 'Deploy the notify-booking function',
        why: 'The webhook target that emails the workshop when a booking is created.',
        state: notifyBooking.deployed ? 'ok' : 'fail',
        detail: notifyBooking.deployed
          ? `Deployed (${notifyBooking.detail}).`
          : `${notifyBooking.detail} — deploy it with the prompt below.`,
        action: { label: 'Open Edge Functions', href: `${dash}/functions` },
      },
      {
        key: 'webhook',
        title: 'Create the database webhook',
        why: 'Fires notify-booking the instant a booking row is inserted (server-side, so it works even if the customer closes the tab).',
        state: webhookReady ? 'ok' : 'fail',
        detail: webhookReady
          ? 'notify-booking is deployed. Create the webhook once in Database → Webhooks (or run the SQL below) — its presence can’t be auto-verified from the browser.'
          : 'Deploy notify-booking first, then create the webhook.',
        action: { label: 'Open Database → Webhooks', href: `${dash}/database/webhooks` },
      },
      {
        key: 'recipient',
        title: 'Set the workshop recipient & enable alerts',
        why: 'The address the workshop alert is sent to.',
        state: recipientReady ? 'ok' : 'fail',
        detail: recipientReady
          ? `Alerts enabled → ${ownerConfig.ownerEmail}.`
          : 'No recipient saved, or email alerts are turned off. Set them in Staff Bookings → Notification settings.',
        action: { label: 'Open Staff Bookings', href: '#' },
      },
    ];

    setSteps(built);
    setChecking(false);
  }, [supabaseUrl, anonKey, dash, ownerConfig]);

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash({ kind: 'ok', text: `${label} copied.` });
    } catch {
      flash({ kind: 'err', text: 'Clipboard blocked — select the text and copy manually.' });
    }
  };

  const runWorkshopTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = getSupabaseClient();
      const res = await testWorkshopEmail(client, ownerConfig);
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const runCustomerTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await dispatchTestEmail(ownerConfig);
      setTestResult(
        res.success
          ? { ok: true, message: `send-email accepted a test to ${ownerConfig.ownerEmail}. Check that inbox.` }
          : { ok: false, message: res.message || 'send-email did not accept the test.' }
      );
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const statusIcon = (s: StepState) => {
    if (s === 'checking') return <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />;
    if (s === 'ok') return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
    if (s === 'fail') return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
    return <XCircle className="w-5 h-5 text-neutral-600 shrink-0" />;
  };

  const allOk = steps.length > 0 && steps.every((s) => s.state === 'ok');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-3xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Email Notification Setup</h3>
              <p className="text-xs text-neutral-400">
                Get booking emails working. Work top to bottom — each step is checked against your live project.
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
                {allOk ? 'Email pipeline looks ready' : 'Email pipeline is not fully set up yet'}
              </div>
              <div className="text-xs text-neutral-400">
                {allOk
                  ? 'All steps pass. Use the tests below to confirm delivery.'
                  : 'Complete the failing steps below, then re-check.'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={runChecks}
            disabled={checking}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Re-check</span>
          </button>
        </div>

        {/* Steps */}
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.key} className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-2">
              <div className="flex items-start gap-3">
                {statusIcon(step.state)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-500">STEP {i + 1}</span>
                    <span className="font-bold text-sm">{step.title}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{step.why}</p>
                  <p
                    className={`text-xs mt-1.5 ${
                      step.state === 'ok' ? 'text-emerald-300' : step.state === 'fail' ? 'text-amber-300' : 'text-neutral-400'
                    }`}
                  >
                    {step.detail}
                  </p>
                </div>
                {step.action.href !== '#' && (
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

              {/* Step 1 & 2: deploy prompt */}
              {(step.key === 'send-email' || step.key === 'notify-booking') && (
                <div className="pl-8">
                  <button
                    type="button"
                    onClick={async () => {
                      await copy(deployCmd, 'Deploy prompt');
                      setCopiedCmd(true);
                      setTimeout(() => setCopiedCmd(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'Copied!' : 'Copy deploy + secrets prompt'}</span>
                  </button>
                </div>
              )}

              {/* Step 3: webhook SQL */}
              {step.key === 'webhook' && (
                <div className="pl-8 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copy(webhookSql, 'Webhook SQL')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-[11px] uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy webhook SQL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSql((v) => !v)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
                      <span>{showSql ? 'Hide' : 'Preview'} SQL</span>
                    </button>
                  </div>
                  {showSql && (
                    <pre className="max-h-56 overflow-auto text-[10px] leading-relaxed font-mono bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-neutral-300 whitespace-pre-wrap">
                      {webhookSql}
                    </pre>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* Tests */}
        <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Test each step</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runCustomerTest}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test customer email (send-email)</span>
            </button>
            <button
              type="button"
              onClick={runWorkshopTest}
              disabled={testing}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Webhook className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Test workshop alert (insert + delete a booking)</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            The workshop test writes a throwaway booking row and deletes it again — that is what a
            real booking looks like, so the webhook fires exactly as it would in production. It
            never touches real customer data.
          </p>
          {testResult && (
            <div
              className={`text-xs px-3 py-2 rounded-xl border ${
                testResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500">
          <KeyRound className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
          <span>
            Secrets and the webhook run in Supabase, not the browser. The webhook step needs your
            project's service_role key, which is why it is a one-time copy-paste rather than a button.
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
