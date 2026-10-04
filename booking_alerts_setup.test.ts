import { describe, it, expect } from 'vitest';
import {
  webhookTriggerSql,
  deployFunctionsCommand,
  deployAllFunctionsCommand,
  envTemplate,
  fixAllBookingAlertsSql,
  fixAllBookingAlertsSecrets,
  generateWebhookSecret,
  ALL_FUNCTIONS,
  RESEND_KEYS_URL,
  PUSHENGAGE_DASHBOARD_URL,
} from './src/utils/bookingAlertsSetup';

describe('webhookTriggerSql', () => {
  const sql = webhookTriggerSql('https://lhojocpygcnkxvkrcuxh.supabase.co');

  it('targets the notify-booking edge function', () => {
    expect(sql).toContain('https://lhojocpygcnkxvkrcuxh.supabase.co/functions/v1/notify-booking');
  });
  it('creates an AFTER INSERT trigger on service_bookings, safely re-runnable', () => {
    expect(sql).toContain('create extension if not exists pg_net');
    expect(sql).toMatch(/create or replace function public\.notify_booking_webhook/i);
    expect(sql).toMatch(/drop trigger if exists notify_booking_on_insert/i);
    expect(sql).toMatch(/after insert on public\.service_bookings/i);
  });
  it('strips any trailing slash from the base URL', () => {
    const withSlash = webhookTriggerSql('https://x.supabase.co/');
    expect(withSlash).toContain("url     := 'https://x.supabase.co/functions/v1/notify-booking'");
  });
});

describe('deployFunctionsCommand', () => {
  it('links the project and deploys both booking-alert functions', () => {
    const cmd = deployFunctionsCommand('lhojocpygcnkxvkrcuxh');
    expect(cmd).toContain('supabase link --project-ref lhojocpygcnkxvkrcuxh');
    expect(cmd).toContain('supabase functions deploy send-email');
    expect(cmd).toContain('supabase functions deploy notify-booking');
  });
});

describe('envTemplate', () => {
  it('lists both server secrets', () => {
    const env = envTemplate();
    expect(env).toContain('RESEND_API_KEY=');
    expect(env).toContain('PUSHENGAGE_API_KEY=');
  });
});

describe('dashboard links', () => {
  it('points at the Resend key page and PushEngage dashboard', () => {
    expect(RESEND_KEYS_URL).toContain('resend.com');
    expect(PUSHENGAGE_DASHBOARD_URL).toContain('pushengage.com');
  });
});

describe('deployAllFunctionsCommand', () => {
  it('deploys every function the project uses', () => {
    const cmd = deployAllFunctionsCommand('lhojocpygcnkxvkrcuxh');
    expect(cmd).toContain('supabase link --project-ref lhojocpygcnkxvkrcuxh');
    for (const fn of ALL_FUNCTIONS) {
      expect(cmd).toContain(`supabase functions deploy ${fn}`);
    }
  });
});

describe('generateWebhookSecret', () => {
  it('produces a long, unique, URL-safe secret', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe('fixAllBookingAlertsSql', () => {
  const opts = { webhookSecret: 'deadbeef'.repeat(6), ownerEmail: 'owner@stakeys.co.uk' };
  const sql = fixAllBookingAlertsSql('https://lhojocpygcnkxvkrcuxh.supabase.co/', opts);

  it('stores the shared secret in Vault, creating or updating it', () => {
    expect(sql).toContain("vault.create_secret('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'");
    expect(sql).toContain('vault.update_secret(v_id,');
    expect(sql).toContain("name = 'booking_webhook_secret'");
  });

  it('points both triggers at the deployed booking functions with the secret header', () => {
    expect(sql).toContain('/functions/v1/booking-email-notification');
    expect(sql).toContain('/functions/v1/booking-push-notification');
    expect(sql).toContain("'x-booking-webhook-secret', v_secret");
    expect(sql).toMatch(/after insert on public\.service_bookings/i);
  });

  it('removes the legacy notify-booking trigger and function', () => {
    expect(sql).toMatch(/drop trigger if exists notify_booking_on_insert/i);
    expect(sql).toMatch(/drop function if exists public\.notify_booking_webhook\(\)/i);
  });

  it('routes in-app notifications to PushEngage and removes the OneSignal webhook', () => {
    expect(sql).toContain('/functions/v1/pushengage-notification');
    expect(sql).toContain("'pushengage_notification_webhook_secret'");
    expect(sql).toMatch(/create trigger notifications_pushengage_push_after_insert/i);
    expect(sql).toMatch(/drop trigger if exists notifications_onesignal_push_after_insert/i);
    expect(sql).toMatch(/drop function if exists private\.dispatch_onesignal_notification\(\)/i);
    expect(sql).not.toMatch(/api\.onesignal\.com/);
  });

  it('syncs the workshop owner email and escapes quotes', () => {
    expect(sql).toContain("owner_email = 'owner@stakeys.co.uk'");
    const quoted = fixAllBookingAlertsSql('https://x.supabase.co', {
      webhookSecret: 'a'.repeat(48),
      ownerEmail: "o'brien@x.co",
    });
    expect(quoted).toContain("owner_email = 'o''brien@x.co'");
  });
});

describe('fixAllBookingAlertsSecrets', () => {
  it('sets BOOKING_WEBHOOK_SECRET to the same value used by the SQL', () => {
    const opts = { webhookSecret: 'a'.repeat(48), ownerEmail: 'owner@stakeys.co.uk' };
    const sql = fixAllBookingAlertsSql('https://x.supabase.co', opts);
    const secrets = fixAllBookingAlertsSecrets(opts);
    expect(secrets).toContain(`BOOKING_WEBHOOK_SECRET=${opts.webhookSecret}`);
    expect(sql).toContain(opts.webhookSecret);
    expect(secrets).toContain('BOOKING_FROM_EMAIL=');
    expect(secrets).toContain('BOOKING_NOTIFY_EMAILS=owner@stakeys.co.uk');
  });

  it('omits BOOKING_NOTIFY_EMAILS when no owner email is given', () => {
    const secrets = fixAllBookingAlertsSecrets({ webhookSecret: 'a'.repeat(48) });
    expect(secrets).not.toContain('BOOKING_NOTIFY_EMAILS');
  });
});
