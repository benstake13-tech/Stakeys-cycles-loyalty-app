/**
 * Shared, testable builders for the booking-alert pipeline setup: the database
 * SQL that wires the webhook, the deploy/secret PROMPTS (ready to paste to an AI
 * agent, instead of the interactive Supabase CLI), the secret templates and the
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

/**
 * Edge functions that must be deployed with JWT verification DISABLED. They are
 * invoked by database triggers (via pg_net) with a shared-secret header instead
 * of a Supabase JWT, so the gateway must not require one.
 */
export const NO_JWT_FUNCTIONS = [
  'booking-email-notification',
  'booking-push-notification',
  'pushengage-notification',
] as const;

/**
 * A ready-to-send PROMPT (instead of a CLI command) that asks an AI agent — or
 * anyone holding the Supabase access token — to deploy the edge functions.
 * `supabase login`/`link` are interactive and are frequently blocked ("generate
 * a token for your first build"), so the prompt instructs the deployer to use
 * `SUPABASE_ACCESS_TOKEN` + `--project-ref` and never the login flow.
 */
export function deployPrompt(projectRef: string, functions: readonly string[]): string {
  const noJwt = functions.filter((f) => (NO_JWT_FUNCTIONS as readonly string[]).includes(f));
  const jwtOn = functions.filter((f) => !(NO_JWT_FUNCTIONS as readonly string[]).includes(f));

  const lines = [
    `Please deploy these Supabase Edge Functions to project "${projectRef}" and confirm each is ACTIVE afterwards.`,
    '',
    'Functions to deploy:',
    ...functions.map((f) => `- ${f}`),
    '',
    'The function source lives in supabase/functions/<name>/ in the repo. Deploy from the repo root.',
  ];

  if (noJwt.length) {
    lines.push(
      '',
      'Deploy these with JWT verification DISABLED (add --no-verify-jwt):',
      ...noJwt.map((f) => `- ${f}`),
    );
  }
  if (jwtOn.length) {
    lines.push(
      '',
      'Keep JWT verification ENABLED for the rest (the repo supabase/config.toml already records each function\u2019s setting).',
    );
  }

  lines.push(
    '',
    'Use an access token instead of the interactive login \u2014 do NOT run `supabase login` or `supabase link`:',
    `  SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy <name> --project-ref ${projectRef}`,
    '  (append --no-verify-jwt for the functions listed above)',
    '',
    'When finished, list the functions for this project and report each one\u2019s status.',
  );
  return lines.join('\n');
}

/** Prompt to deploy the booking-alert edge functions. */
export function deployFunctionsPrompt(projectRef: string): string {
  return deployPrompt(projectRef, [
    'booking-email-notification',
    'booking-push-notification',
    'send-email',
    'notify-booking',
  ]);
}

/**
 * A ready-to-send PROMPT that sets the edge-function secrets, instead of the
 * `supabase secrets set …` CLI command. The raw `KEY=value` lines are included
 * so they can also be pasted straight into the Dashboard → Secrets page.
 */
export function secretsPrompt(projectRef: string, secretLines: string): string {
  return [
    `Please set the following Supabase Edge Function secrets for project "${projectRef}".`,
    '',
    secretLines,
    '',
    'Do not run the interactive `supabase login`; use the Supabase access token (SUPABASE_ACCESS_TOKEN)',
    'with the Management API, or add them in Dashboard \u2192 Edge Functions \u2192 Secrets.',
    'Replace any placeholder values (e.g. re_your_key) with the real keys.',
  ].join('\n');
}

/**
 * Every edge function the project uses. The booking-alert pipeline is the first
 * five (email + push webhooks, the two client-invoked senders, and the
 * PushEngage server-send); the rest are the other live integrations that must
 * stay deployed.
 */
export const ALL_FUNCTIONS = [
  'booking-email-notification',
  'booking-push-notification',
  'send-email',
  'notify-booking',
  'pushengage-send',
  'pushengage-notification',
  'spin-wheel',
  'gbp-performance',
  'stamp-log',
] as const;

/** Prompt that (re)deploys every edge function from the repo. */
export function deployAllFunctionsPrompt(projectRef: string): string {
  return deployPrompt(projectRef, ALL_FUNCTIONS);
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

-- 4. In-app notifications -> PushEngage (replaces the OneSignal webhook).
${pushengageNotificationSql(base, secret).trim()}
`;
}

/**
 * SQL that routes `notifications` INSERTs to the `pushengage-notification` edge
 * function (targeted per-user push). Replaces the old OneSignal webhook: the
 * Vault secret `pushengage_notification_webhook_secret` is created/updated, the
 * trigger is rebuilt, and the legacy OneSignal trigger + function are dropped.
 */
export function pushengageNotificationSql(supabaseUrl: string, webhookSecret: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `-- 4. In-app notifications -> PushEngage (replaces OneSignal)
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'pushengage_notification_webhook_secret';
  if v_id is null then
    perform vault.create_secret('${webhookSecret}', 'pushengage_notification_webhook_secret', 'PushEngage notification webhook secret');
  else
    perform vault.update_secret(v_id, '${webhookSecret}');
  end if;
end $$;

create or replace function private.dispatch_pushengage_notification()
returns trigger language plpgsql security definer set search_path to 'pg_catalog', 'public', 'vault', 'net' as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'pushengage_notification_webhook_secret' limit 1;
  if v_secret is null or v_secret = '' then
    raise warning 'pushengage_notification_webhook_secret missing from Vault; skipping push for notification %', NEW.id;
    return new;
  end if;
  begin
    perform net.http_post(
      url     := '${base}/functions/v1/pushengage-notification',
      body    := jsonb_build_object(
        'type', 'INSERT', 'schema', 'public', 'table', 'notifications',
        'record', jsonb_build_object(
          'id', NEW.id, 'user_id', NEW.user_id, 'title', NEW.title,
          'message', NEW.message, 'type', NEW.type
        ),
        'old_record', null
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'Could not enqueue PushEngage push for notification %: %', NEW.id, SQLERRM;
  end;
  return new;
end;
$$;

drop trigger if exists notifications_onesignal_push_after_insert on public.notifications;
create trigger notifications_pushengage_push_after_insert
  after insert on public.notifications
  for each row execute function private.dispatch_pushengage_notification();

drop function if exists private.dispatch_onesignal_notification();
`;
}

/**
 * The matching edge-function secrets. `BOOKING_WEBHOOK_SECRET` MUST equal the
 * value baked into `fixAllBookingAlertsSql` or every webhook call returns 401.
 */
export function fixAllBookingAlertsSecrets(opts: FixAllOptions): string {
  const lines = [
    `BOOKING_WEBHOOK_SECRET=${opts.webhookSecret}`,
    `BOOKING_FROM_EMAIL=Stakey's Cycles <noreply@stakeyswheels.co.uk>`,
  ];
  if (opts.ownerEmail?.trim()) lines.push(`BOOKING_NOTIFY_EMAILS=${opts.ownerEmail.trim()}`);
  lines.push('RESEND_API_KEY=re_your_key');
  return lines.join('\n');
}

/** The server secret lines the booking-alert pipeline needs. */
export function envTemplate(): string {
  return 'RESEND_API_KEY=re_your_key\nPUSHENGAGE_API_KEY=your_key';
}
