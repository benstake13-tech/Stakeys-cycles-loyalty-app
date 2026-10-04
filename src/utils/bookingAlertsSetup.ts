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

/** The server secret lines the booking-alert pipeline needs. */
export function envTemplate(): string {
  return 'RESEND_API_KEY=re_your_key\nPUSHENGAGE_API_KEY=your_key';
}
