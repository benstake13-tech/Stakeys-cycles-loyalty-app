import React, { useState } from 'react';
import { Database, Rocket, KeyRound, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { getStoredSupabaseUrl } from '../supabase';
import { deriveProjectRef } from '../utils/emailSetup';
import {
  webhookTriggerSql,
  deployFunctionsCommand,
  envTemplate,
  RESEND_KEYS_URL,
  PUSHENGAGE_DASHBOARD_URL,
} from '../utils/bookingAlertsSetup';

/**
 * One-stop "make booking alerts work" actions for the Feature Test Bench.
 * Collects the copy buttons (SQL rebuild, deploy command, server secrets) and
 * the deep links (Resend, PushEngage, Supabase webhooks/functions) that finish
 * the notification pipeline after a booking.
 */
export const AlertPipelineActions: React.FC<{ onFlash?: (text: string, ok: boolean) => void }> = ({
  onFlash,
}) => {
  const supabaseUrl = getStoredSupabaseUrl();
  const projectRef = deriveProjectRef(supabaseUrl);
  const dash = `https://supabase.com/dashboard/project/${projectRef}`;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2500);
      onFlash?.(`${label} copied.`, true);
    } catch {
      onFlash?.('Clipboard blocked — copy the text manually.', false);
    }
  };

  const CopyButton: React.FC<{ id: string; label: string; text: string; icon: React.ReactNode }> = ({
    id,
    label,
    text,
    icon,
  }) => (
    <button
      type="button"
      onClick={() => copy(id, text, label)}
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700 text-left transition-colors cursor-pointer"
    >
      <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
        {copiedKey === id ? <Check className="w-4 h-4" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white truncate">
          {copiedKey === id ? 'Copied!' : label}
        </span>
        <span className="block text-[11px] text-neutral-400 truncate">click to copy</span>
      </span>
    </button>
  );

  const LinkButton: React.FC<{ label: string; subtitle: string; href: string; icon: React.ReactNode }> = ({
    label,
    subtitle,
    href,
    icon,
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-700 text-left transition-colors"
    >
      <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white truncate">{label}</span>
        <span className="block text-[11px] text-neutral-400 truncate">{subtitle}</span>
      </span>
    </a>
  );

  return (
    <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
      <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
        <Database className="w-4 h-4 text-emerald-400" />
        Booking Alert Pipeline — Fix Buttons
      </div>
      <p className="text-[11px] text-neutral-400 mb-4 max-w-2xl leading-relaxed">
        Everything needed to (re)build the notification that fires after a booking. Copy each block and
        paste it where shown, then open the dashboards to set the keys.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CopyButton
          id="sql"
          label="Copy webhook SQL (rebuild trigger)"
          text={webhookTriggerSql(supabaseUrl)}
          icon={<Database className="w-4 h-4" />}
        />
        <CopyButton
          id="deploy"
          label="Copy edge-function deploy command"
          text={deployFunctionsCommand(projectRef)}
          icon={<Rocket className="w-4 h-4" />}
        />
        <CopyButton
          id="env"
          label="Copy server secrets (Resend + PushEngage)"
          text={envTemplate()}
          icon={<KeyRound className="w-4 h-4" />}
        />
        <LinkButton
          label="Open Resend API keys"
          subtitle="create RESEND_API_KEY"
          href={RESEND_KEYS_URL}
          icon={<ExternalLink className="w-4 h-4" />}
        />
        <LinkButton
          label="Open PushEngage dashboard"
          subtitle="REST API key + staff segment"
          href={PUSHENGAGE_DASHBOARD_URL}
          icon={<ExternalLink className="w-4 h-4" />}
        />
        <LinkButton
          label="Open Supabase Webhooks"
          subtitle="wire notify-booking on INSERT"
          href={`${dash}/database/webhooks`}
          icon={<ExternalLink className="w-4 h-4" />}
        />
        <LinkButton
          label="Open Edge Functions"
          subtitle="send-email + notify-booking"
          href={`${dash}/functions`}
          icon={<ExternalLink className="w-4 h-4" />}
        />
      </div>
    </div>
  );
};
