import { describe, it, expect } from 'vitest';
import {
  webhookTriggerSql,
  deployFunctionsPrompt,
  deployAllFunctionsPrompt,
  secretsPrompt,
  envTemplate,
  fixAllBookingAlertsSql,
  fixAllBookingAlertsSecrets,
  generateWebhookSecret,
  ALL_FUNCTIONS,
  NO_JWT_FUNCTIONS,
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

describe('deployFunctionsPrompt', () => {
  it('asks to deploy the booking-alert functions without any CLI login', () => {
    const prompt = deployFunctionsPrompt('lhojocpygcnkxvkrcuxh');
    expect(prompt).toContain('lhojocpygcnkxvkrcuxh');
    for (const fn of ['booking-email-notification', 'booking-push-notification', 'send-email', 'notify-booking']) {
      expect(prompt).toContain(fn);
    }
    // It is a prompt, not a bare CLI script: no login/link, and it says to use a token.
    expect(prompt).not.toMatch(/^supabase login/m);
    expect(prompt).toContain('SUPABASE_ACCESS_TOKEN');
    expect(prompt).toContain('--no-verify-jwt');
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

describe('deployAllFunctionsPrompt', () => {
  it('names every function the project uses and flags the no-JWT ones', () => {
    const prompt = deployAllFunctionsPrompt('lhojocpygcnkxvkrcuxh');
    expect(prompt).toContain('lhojocpygcnkxvkrcuxh');
    for (const fn of ALL_FUNCTIONS) {
      expect(prompt).toContain(fn);
    }
    expect(prompt).toContain('SUPABASE_ACCESS_TOKEN');
    // The trigger-invoked functions are called out for --no-verify-jwt.
    for (const fn of NO_JWT_FUNCTIONS) {
      expect(prompt).toContain(fn);
    }
  });
});

describe('secretsPrompt', () => {
  it('wraps the KEY=value lines in a pasteable prompt', () => {
    const prompt = secretsPrompt('lhojocpygcnkxvkrcuxh', envTemplate());
    expect(prompt).toContain('RESEND_API_KEY=');
    expect(prompt).toContain('PUSHENGAGE_API_KEY=');
    expect(prompt).toContain('SUPABASE_ACCESS_TOKEN');
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
