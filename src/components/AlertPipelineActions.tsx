import React, { useState } from 'react';
import { Database, Rocket, KeyRound, ExternalLink, Copy, Check, Wand2, RefreshCw, Mail } from 'lucide-react';
import { getStoredSupabaseUrl } from '../supabase';
import { deriveProjectRef } from '../utils/emailSetup';
import {
  webhookTriggerSql,
  deployFunctionsPrompt,
  deployAllFunctionsPrompt,
  envTemplate,
  secretsPrompt,
  fixAllBookingAlertsSql,
  fixAllBookingAlertsSecrets,
  generateWebhookSecret,
  RESEND_KEYS_URL,
  ONESIGNAL_DASHBOARD_URL,
} from '../utils/bookingAlertsSetup';

interface PipelineRow {
  key: string;
  step: string;
  icon: React.ReactNode;
  title: string;
  /** Shown while the copy button is idle — what the button copies. */
  copyHint: string;
  /** Shown right after copying — where to paste it and what to do next. */
  pasteHint: string;
  /** The deployable text: a ready-to-send prompt (or the SQL to paste). */
  text: string;
  /** The page to paste the copied text into, with a "Paste here" button. */
  paste: { label: string; href: string; hint: string };
}

/**
 * One-stop "make booking alerts work" actions for the Feature Test Bench.
 * Each row is a copy button with an explicit "where to paste it" link right
 * beside it, so every step says exactly what to do with what it copies.
 */
export const AlertPipelineActions: React.FC<{
  onFlash?: (text: string, ok: boolean) => void;
  ownerEmail?: string;
}> = ({ onFlash, ownerEmail }) => {
  const supabaseUrl = getStoredSupabaseUrl();
  const projectRef = deriveProjectRef(supabaseUrl);
  const dash = `https://supabase.com/dashboard/project/${projectRef}`;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // One secret drives both the SQL (Vault) and the function secrets, so they
  // always match — a mismatch is exactly what silently broke the alerts.
  const [fixSecret] = useState(() => generateWebhookSecret());
  const [fixEmail, setFixEmail] = useState(ownerEmail || '');

  const copy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 3000);
      onFlash?.(`${label} copied — press the "Paste here" button to open where it goes.`, true);
    } catch {
      onFlash?.('Clipboard blocked — select the text and copy it manually.', false);
    }
  };

  const rows: PipelineRow[] = [
    {
      key: 'deploy',
      step: 'STEP 1',
      icon: <Rocket className="w-4 h-4" />,
      title: 'Deploy the edge functions',
      copyHint: 'Copies a ready-to-send prompt to deploy the booking-alert edge functions.',
      pasteHint:
        'Paste the prompt to an AI agent (or whoever holds the Supabase access token). It deploys the functions with SUPABASE_ACCESS_TOKEN — no supabase login needed.',
      text: deployFunctionsPrompt(projectRef),
      paste: {
        label: 'Open Edge Functions',
        href: `${dash}/functions`,
        hint: 'After deploying, confirm both functions are listed and no longer say "not deployed".',
      },
    },
    {
      key: 'env',
      step: 'STEP 2',
      icon: <KeyRound className="w-4 h-4" />,
      title: 'Set the server secrets',
      copyHint: 'Copies a prompt (with the RESEND_API_KEY / ONESIGNAL_API_KEY lines) to set the secrets.',
      pasteHint:
        'Paste the prompt to an AI agent to set them, or copy the KEY=value lines into Supabase → Edge Functions → Secrets.',
      text: secretsPrompt(projectRef, envTemplate()),
      paste: {
        label: 'Open Secrets page',
        href: `${dash}/settings/functions`,
        hint: 'Add each KEY=value line as a secret here.',
      },
    },
    {
      key: 'sql',
      step: 'STEP 3',
      icon: <Database className="w-4 h-4" />,
      title: 'Wire the webhook that alerts staff',
      copyHint: 'Copies the SQL that (re)builds the pg_net trigger → notify-booking.',
      pasteHint:
        'Paste into Supabase → SQL Editor → New query, replace <SERVICE_ROLE_KEY> with your service_role key, then click Run. Safe to re-run.',
      text: webhookTriggerSql(supabaseUrl),
      paste: {
        label: 'Open SQL Editor',
        href: `${dash}/sql/new`,
        hint: 'Paste the SQL in a new query and press Run.',
      },
    },
  ];

  return (
    <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
      <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
        <Database className="w-4 h-4 text-emerald-400" />
        Booking Alert Pipeline — Fix Buttons
      </div>
      <p className="text-[11px] text-neutral-400 mb-4 max-w-3xl leading-relaxed">
        Everything needed to (re)build the notification that fires after a booking. Each step has a copy
        button and a button that opens the exact page to paste it into. Do them in order: 1 → 2 → 3.
      </p>

      {/* ONE-SHOT repair — fixes the secret mismatch that silently broke alerts */}
      <div className="mb-4 p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5">
        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
          <Wand2 className="w-4 h-4" />
          Fix everything at once
        </div>
        <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed max-w-3xl">
          The alerts were failing because the trigger and the edge functions were told{' '}
          <span className="text-white font-semibold">different</span> webhook secrets, so every call was
          rejected. This copies both halves using <span className="text-white font-semibold">one matching secret</span>{' '}
          — paste each where its button says, then press <span className="text-white font-semibold">Re-run system test</span>.
        </p>

        <label className="block mt-3">
          <span className="text-[11px] font-bold text-neutral-300">Workshop alert email (owner)</span>
          <input
            type="email"
            value={fixEmail}
            onChange={(e) => setFixEmail(e.target.value)}
            placeholder="owner@example.com"
            className="mt-1 w-full max-w-md px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-sm text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy('fix-sql', fixAllBookingAlertsSql(supabaseUrl, { webhookSecret: fixSecret, ownerEmail: fixEmail }), 'Fix-all SQL')}
            className="flex items-center gap-2 p-2.5 pr-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-colors cursor-pointer"
          >
            <span className="w-8 h-8 rounded-xl bg-neutral-950/15 flex items-center justify-center shrink-0">
              {copiedKey === 'fix-sql' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </span>
            <span className="text-xs font-bold whitespace-nowrap">
              {copiedKey === 'fix-sql' ? 'Copied!' : 'Copy the fix-all SQL'}
            </span>
          </button>
          <a
            href={`${dash}/sql/new`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 p-2.5 pr-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/40 transition-colors"
          >
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-xs font-bold text-emerald-300 whitespace-nowrap">SQL Editor — paste &amp; Run</span>
              <span className="block text-[10px] text-neutral-400">Rebuilds the triggers with the shared secret.</span>
            </span>
          </a>

          <button
            type="button"
            onClick={() => copy('fix-secrets', secretsPrompt(projectRef, fixAllBookingAlertsSecrets({ webhookSecret: fixSecret, ownerEmail: fixEmail })), 'Fix-all secrets prompt')}
            className="flex items-center gap-2 p-2.5 pr-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-colors cursor-pointer"
          >
            <span className="w-8 h-8 rounded-xl bg-neutral-950/15 flex items-center justify-center shrink-0">
              {copiedKey === 'fix-secrets' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </span>
            <span className="text-xs font-bold whitespace-nowrap">
              {copiedKey === 'fix-secrets' ? 'Copied!' : 'Copy the fix-all secrets prompt'}
            </span>
          </button>
          <a
            href={`${dash}/settings/functions`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 p-2.5 pr-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/40 transition-colors"
          >
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ExternalLink className="w-4 h-4" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-xs font-bold text-emerald-300 whitespace-nowrap">Secrets — paste here</span>
              <span className="block text-[10px] text-neutral-400">Sets BOOKING_WEBHOOK_SECRET to the same value.</span>
            </span>
          </a>
        </div>

        <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed">
          Order matters: paste the <span className="text-neutral-200">SQL</span> first (creates the secret), then the{' '}
          <span className="text-neutral-200">secrets</span> (so the functions accept it). Need to redeploy the functions
          from the repo?{' '}
          <button
            type="button"
            onClick={() => copy('fix-deploy', deployAllFunctionsPrompt(projectRef), 'Deploy-all prompt')}
            className="inline-flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
          >
            {copiedKey === 'fix-deploy' ? <Check className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
            <span>{copiedKey === 'fix-deploy' ? 'Copied deploy-all prompt' : 'copy the deploy-all prompt'}</span>
          </button>{' '}
          and paste it to an AI agent to deploy every function with the Supabase access token.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const copied = copiedKey === row.key;
          return (
            <div
              key={row.key}
              className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col lg:flex-row lg:items-center gap-3"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  {row.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-500">{row.step}</span>
                    <span className="text-sm font-bold text-white">{row.title}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    {copied ? row.pasteHint : row.copyHint}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copy(row.key, row.text, row.title)}
                  className="flex items-center gap-3 p-2.5 pr-3.5 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </span>
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    {copied ? 'Copied!' : 'Copy'}
                  </span>
                </button>

                <a
                  href={row.paste.href}
                  target="_blank"
                  rel="noreferrer"
                  title={row.paste.hint}
                  className="flex items-center gap-3 p-2.5 pr-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 transition-colors"
                >
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-xs font-bold text-emerald-300 whitespace-nowrap">
                      {row.paste.label} — Paste here
                    </span>
                    <span className="block text-[10px] text-neutral-400 max-w-[220px] leading-snug">
                      {row.paste.hint}
                    </span>
                  </span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-neutral-500 mt-4 leading-relaxed">
        Need the API keys?{' '}
        <a href={RESEND_KEYS_URL} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
          Create a Resend key
        </a>{' '}
        ·{' '}
        <a
          href={ONESIGNAL_DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-400 hover:underline"
        >
          Get the OneSignal App API key
        </a>
        . When all three steps are done, run <span className="text-neutral-300">Test workshop alert</span>{' '}
        above and <span className="text-neutral-300">Send a test push</span> in Push Setup.
      </p>
    </div>
  );
};
