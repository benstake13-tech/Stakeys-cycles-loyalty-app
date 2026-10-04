import { describe, it, expect } from 'vitest';
import {
  webhookTriggerSql,
  deployFunctionsCommand,
  envTemplate,
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
