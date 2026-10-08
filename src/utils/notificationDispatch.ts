/**
 * Notification dispatcher.
 *
 * Given an event, its payload and the workshop's preferences, this fires only
 * the channels the workshop enabled. It is deliberately dependency-injected so
 * the transport (Supabase Edge Function email, OneSignal push) can be swapped in
 * tests, and so a failure in one channel never blocks the others.
 */
import { getSupabaseClient } from '../lib/supabase';
import { sendPushToUser, adminPushTarget, type PushSendResult } from './pushNotifications';
import {
  channelsFor,
  notificationEventMeta,
  type NotificationEventId,
  type NotificationPreferences,
} from './notificationPreferences';

export interface NotificationPayload {
  /** Short title, used for push and the visual record. */
  title: string;
  /** Multi-line body for push and as the plain-text email fallback. */
  body: string;
  /** Deep-link URL a push should open. */
  url?: string;
  /** Email subject; falls back to the title. */
  emailSubject?: string;
  /** Pre-rendered email HTML; falls back to a formatted plain-text block. */
  emailHtml?: string;
  /** Workshop recipient email (owner events). */
  ownerEmail?: string;
  /** Customer recipient email (customer events). */
  customerEmail?: string;
  /** Customer's auth uid, so the push can target that device. */
  customerUserId?: string;
  /** Fallback OneSignal target for the workshop push. */
  pushTarget?: { email?: string; segment?: string; tag?: { key: string; value: string } };
}

export type ChannelOutcome = 'sent' | 'off' | 'skipped' | 'failed';

export interface NotificationDispatchResult {
  event: NotificationEventId;
  /** The channels this event is configured to use. */
  channels: { visual: boolean; email: boolean; push: boolean };
  visual: ChannelOutcome;
  email: ChannelOutcome;
  push: ChannelOutcome;
  /** Human-readable reasons for anything not sent. */
  notes: string[];
}

export interface NotificationDeps {
  /** Records a visual (in-app bell) entry. Optional — the bell also derives a feed. */
  recordVisual?: (event: NotificationEventId, payload: NotificationPayload) => void;
  sendEmail?: (to: string, subject: string, html: string) => Promise<boolean>;
  sendPush?: (
    userId: string | undefined,
    title: string,
    body: string,
    url?: string,
    target?: { segment?: string; email?: string; tag?: { key: string; value: string } }
  ) => Promise<PushSendResult>;
}

/** Live email transport: forwards to the Supabase `send-email` edge function. */
export async function sendWorkshopEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-email', {
      body: { from: 'noreply@stakeyscycles.co.uk', to, subject, html },
    });
    if (error) {
      console.error(`[NOTIFY] Email to ${to} failed: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[NOTIFY] Email dispatch threw:', err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A minimal, brandable HTML body when a caller does not supply one. */
export function plainEmailHtml(title: string, body: string): string {
  const rows = body
    .split('\n')
    .map((line) => `<p style="margin:4px 0;color:#334155;font-size:14px">${escapeHtml(line)}</p>`)
    .join('');
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0f172a;font-size:18px">${escapeHtml(title)}</h2>
    ${rows}
    <p style="margin-top:16px;color:#94a3b8;font-size:12px">Stakey's Cycles — workshop notification</p>
  </div>`;
}

/**
 * Fire one workshop event across its enabled channels. Never throws: a channel
 * that fails is reported as `failed` with a note, and the others still run.
 */
export async function dispatchWorkshopEvent(
  event: NotificationEventId,
  payload: NotificationPayload,
  prefs: NotificationPreferences,
  deps: NotificationDeps = {}
): Promise<NotificationDispatchResult> {
  const channels = channelsFor(prefs, event);
  const meta = notificationEventMeta(event);
  const notes: string[] = [];
  const result: NotificationDispatchResult = {
    event,
    channels,
    visual: 'off',
    email: 'off',
    push: 'off',
    notes,
  };

  if (!channels.visual && !channels.email && !channels.push) {
    notes.push('Event is muted in notification settings.');
    return result;
  }

  // --- Visual (in-app bell) ------------------------------------------------
  if (channels.visual) {
    try {
      deps.recordVisual?.(event, payload);
      result.visual = 'sent';
    } catch (err) {
      result.visual = 'failed';
      notes.push(`Visual record failed: ${(err as Error).message}`);
    }
  }

  // --- Email ---------------------------------------------------------------
  if (channels.email) {
    const recipients: string[] = [];
    const audience = meta?.audience ?? 'both';
    if ((audience === 'staff' || audience === 'both') && payload.ownerEmail) recipients.push(payload.ownerEmail);
    if ((audience === 'customer' || audience === 'both') && payload.customerEmail) recipients.push(payload.customerEmail);

    if (recipients.length === 0) {
      result.email = 'skipped';
      notes.push('No email recipient available for this event.');
    } else {
      const send = deps.sendEmail ?? sendWorkshopEmail;
      const subject = payload.emailSubject || payload.title;
      const html = payload.emailHtml || plainEmailHtml(payload.title, payload.body);
      let anySent = false;
      for (const to of recipients) {
        try {
          if (await send(to, subject, html)) anySent = true;
          else notes.push(`Email to ${to} was rejected.`);
        } catch (err) {
          notes.push(`Email to ${to} threw: ${(err as Error).message}`);
        }
      }
      result.email = anySent ? 'sent' : 'failed';
    }
  }

  // --- Push ----------------------------------------------------------------
  if (channels.push) {
    const send = deps.sendPush ?? sendPushToUser;
    try {
      const target =
        payload.pushTarget ??
        (payload.customerUserId
          ? undefined
          : payload.ownerEmail
          ? adminPushTarget(payload.ownerEmail)
          : undefined);
      const res = await send(payload.customerUserId, payload.title, payload.body, payload.url, target);
      if (res.ok) result.push = 'sent';
      else {
        result.push = 'failed';
        const errs = res.envelope?.errors?.join('; ');
        notes.push(errs ? `Push failed: ${errs}` : 'Push failed.');
      }
    } catch (err) {
      result.push = 'failed';
      notes.push(`Push threw: ${(err as Error).message}`);
    }
  }

  return result;
}
