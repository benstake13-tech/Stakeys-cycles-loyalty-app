/**
 * Shared, testable builders for the booking-alert pipeline setup: the database
 * SQL that wires the webhook, the deploy command, the secret templates and the
 * dashboard links. Used by both the Email Setup and Push Setup modals so the
 * "get this working" buttons all point at the same source of truth.
 */

export const RESEND_KEYS_URL = 'https://resend.com/api-keys';
export const PUSHENGAGE_DASHBOARD_URL = 'https://dashboard.pushengage.com/';

/**
 * SQL that creates the trigger alerting the workshop the moment a booking is
 * inserted. Safe to re-run — it only creates/replaces the function and trigger.
 */
export function webhookTriggerSql(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `-- (Re)builds the trigger that alerts the workshop when a booking is inserted.
-- Replace <SERVICE_ROLE_KEY> with Project Settings -> API -> service_role secret.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_booking_webhook()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := '${base}/functions/v1/notify-booking',
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
  for each row execute function public.notify_booking_webhook();`;
}

/** CLI command that deploys both booking-alert edge functions. */
export function deployFunctionsCommand(projectRef: string): string {
  return (
    `supabase login\nsupabase link --project-ref ${projectRef}\n` +
    `supabase functions deploy send-email\nsupabase functions deploy notify-booking`
  );
}

/**
 * Every edge function the project uses. The first four are the booking-alert
 * pipeline; the rest are the other live integrations that must stay deployed.
 */
export const ALL_FUNCTIONS = [
  'booking-email-notification',
  'booking-push-notification',
  'send-email',
  'notify-booking',
  'spin-wheel',
  'gbp-performance',
  'stamp-log',
  'onesignal-notification',
] as const;

/** CLI command that (re)deploys every edge function from the repo. */
export function deployAllFunctionsCommand(projectRef: string): string {
  const deploys = ALL_FUNCTIONS.map((f) => `supabase functions deploy ${f}`).join('\n');
  return `supabase login\nsupabase link --project-ref ${projectRef}\n${deploys}`;
}

/** A fresh URL-safe secret shared by the triggers (Vault) and the functions. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface FixAllOptions {
  /** The value the triggers send and the functions must be told to expect. */
  webhookSecret: string;
  /** Workshop inbox for booking alerts (becomes BOOKING_NOTIFY_EMAILS). */
  ownerEmail?: string;
}

/**
 * ONE-SHOT repair for the whole booking-alert pipeline.
 *
 * It does three things that must agree or nothing is delivered:
 *  1. Stores the shared webhook secret in Vault (creating or updating it).
 *  2. Rebuilds the two `service_bookings` AFTER INSERT triggers so they POST the
 *     booking row to `booking-email-notification` and `booking-push-notification`
 *     with that secret in the `x-booking-webhook-secret` header.
 *  3. Drops the legacy `notify_booking_webhook` trigger, which called a function
 *     that no longer exists with a placeholder bearer token.
 *
 * Safe to re-run. Pair it with `fixAllBookingAlertsSecrets`, which sets the
 * matching `BOOKING_WEBHOOK_SECRET` on the functions.
 */
export function fixAllBookingAlertsSql(supabaseUrl: string, opts: FixAllOptions): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  const secret = opts.webhookSecret;
  const owner = (opts.ownerEmail || '').trim();
  const ownerUpdate = owner
    ? `\n-- Keep the workshop inbox the app reads in sync with the alert recipient.\nupdate public.app_settings set owner_email = '${owner.replace(/'/g, "''")}' where id = 1;\n`
    : '';

  return `-- ============================================================================
-- FIX ALL BOOKING ALERTS  (safe to re-run)
-- Makes the booking email + push alerts actually deliver by giving the trigger
-- and the edge functions the SAME webhook secret, and pointing the triggers at
-- the functions that are deployed.
-- ============================================================================
create extension if not exists pg_net with schema extensions;
${ownerUpdate}
-- 1. Shared secret (create it once, then keep it updated on every re-run).
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'booking_webhook_secret';
  if v_id is null then
    perform vault.create_secret('${secret}', 'booking_webhook_secret', 'Booking alert webhook secret');
  else
    perform vault.update_secret(v_id, '${secret}');
  end if;
end $$;

-- 2a. Email trigger -> booking-email-notification
create or replace function public.notify_booking_email_via_pg_net()
returns trigger language plpgsql security definer as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_webhook_secret' limit 1;
  if v_secret is null then
    raise warning 'booking_webhook_secret missing from Vault; email not queued';
    return new;
  end if;
  perform net.http_post(
    url     := '${base}/functions/v1/booking-email-notification',
    body    := jsonb_build_object(
      'type', 'INSERT', 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW), 'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-webhook-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists service_bookings_booking_email_insert on public.service_bookings;
create trigger service_bookings_booking_email_insert
  after insert on public.service_bookings
  for each row execute function public.notify_booking_email_via_pg_net();

-- 2b. Push trigger -> booking-push-notification
create or replace function public.notify_service_bookings_push()
returns trigger language plpgsql security definer as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_webhook_secret' limit 1;
  if v_secret is null then
    raise warning 'booking_webhook_secret missing from Vault; push not queued';
    return new;
  end if;
  perform net.http_post(
    url     := '${base}/functions/v1/booking-push-notification',
    body    := jsonb_build_object(
      'type', 'INSERT', 'table', 'service_bookings', 'schema', 'public',
      'record', to_jsonb(NEW), 'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-webhook-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists service_bookings_booking_push_insert on public.service_bookings;
create trigger service_bookings_booking_push_insert
  after insert on public.service_bookings
  for each row execute function public.notify_service_bookings_push();

-- 3. Remove the legacy trigger that called a non-existent function.
drop trigger if exists notify_booking_on_insert on public.service_bookings;
drop function if exists public.notify_booking_webhook();
`;
}

/**
 * The matching edge-function secrets. `BOOKING_WEBHOOK_SECRET` MUST equal the
 * value baked into `fixAllBookingAlertsSql` or every webhook call returns 401.
 */
export function fixAllBookingAlertsSecrets(opts: FixAllOptions): string {
  const lines = [
    `BOOKING_WEBHOOK_SECRET=${opts.webhookSecret}`,
    `BOOKING_FROM_EMAIL=Stakey's Cycles <noreply@stakeyscycles.co.uk>`,
  ];
  if (opts.ownerEmail?.trim()) lines.push(`BOOKING_NOTIFY_EMAILS=${opts.ownerEmail.trim()}`);
  lines.push('RESEND_API_KEY=re_your_key');
  return lines.join('\n');
}

/** The server secret lines the booking-alert pipeline needs. */
export function envTemplate(): string {
  return 'RESEND_API_KEY=re_your_key\nPUSHENGAGE_API_KEY=your_key';
}
