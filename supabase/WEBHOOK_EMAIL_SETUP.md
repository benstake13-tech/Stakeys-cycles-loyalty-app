# Instant workshop email on new bookings (Database Webhook + Resend)

This wires up a **server-side** alert so the workshop is emailed the moment a
booking row lands in `service_bookings` — no browser required. It is the
recommended way to guarantee the owner/staff alert is never missed.

How it fits together:

```
customer submits booking
        │
        ▼
app INSERTs a row into public.service_bookings
        │
        ▼  (Database Webhook: AFTER INSERT, with service_role auth)
POST /functions/v1/notify-booking   ← Supabase Edge Function (this repo)
        │
        ▼
Resend API  ──►  workshop owner_email
```

The app still sends the **customer** confirmation email itself (from
`dispatchBookingNotifications`), because that is a customer-facing nicety tied to
the on-screen "request received" state. The **workshop** alert is now handled
entirely by this webhook, so the app no longer sends it (otherwise the workshop
would get two emails per booking).

---

## What you need

| Thing | Where |
|---|---|
| `RESEND_API_KEY` secret | Supabase → Project Settings → Edge Functions → Secrets |
| Workshop recipient | saved in the app's staff settings (`app_settings.owner_email`) |
| `email_alerts_enabled = true` | app's staff settings (`app_settings.email_alerts_enabled`) |
| Sending domain verified in Resend | `stakeyscycles.co.uk` (or override with `MAIL_FROM`) |

---

## 1. Deploy the function

```bash
supabase login
supabase link --project-ref lhojocpygcnkxvkrcuxh
supabase functions deploy notify-booking
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
# optional sender override (must be a Resend-verified domain):
supabase secrets set MAIL_FROM="Stakey's Cycles <noreply@stakeyscycles.co.uk>"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge
Functions, so the function can read `app_settings` without extra config.

---

## 2. Create the Database Webhook

### Option A — Supabase Dashboard (recommended, easiest)

1. Supabase Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. Name: `notify-booking`.
3. Table: `service_bookings`.
4. Events: tick **Insert** only.
5. Type: **Supabase Edge Function** → select **`notify-booking`**.
6. Method: `POST`. Add an HTTP header
   `Authorization: Bearer <SERVICE_ROLE_KEY>` (Project Settings → API →
   `service_role` secret).
7. Create the hook.

### Option B — SQL (advanced)

Run in the Supabase SQL Editor. Replace `<SERVICE_ROLE_KEY>` with your project's
service-role secret (Project Settings → API).

```sql
-- Extensions used for outbound HTTP from Postgres.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_booking_webhook()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url     := 'https://lhojocpygcnkxvkrcuxh.supabase.co/functions/v1/notify-booking',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'service_bookings',
      'schema', 'public',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$;

drop trigger if exists notify_booking_on_insert on public.service_bookings;
create trigger notify_booking_on_insert
  after insert on public.service_bookings
  for each row
  execute function public.notify_booking_webhook();
```

> The webhook is asynchronous (`pg_net` queues the request), so a slow email
> provider never blocks the booking insert. Failures are visible under
> **Database → Webhooks** (Dashboard) or in `net._http_response` (SQL).

---

## 3. Verify

Submit a test booking (or insert a row), then check:

- Supabase → **Edge Functions → notify-booking → Logs** should show
  `✅ Workshop alert sent to <owner_email> for booking #<id>`.
- The workshop inbox receives the alert.
- Inserting a row with `email_alerts_enabled = false`, or with no
  `app_settings.owner_email`, returns `{ "skipped": true, "reason": ... }` and
  sends nothing — that is expected.

Quick manual smoke test of the function itself (from a shell). The function only
accepts a `service_role` JWT, so this proves the auth gate too:

```bash
curl -s -X POST \
  "https://lhojocpygcnkxvkrcuxh.supabase.co/functions/v1/notify-booking" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","table":"service_bookings","record":{"id":"bk-test","service_title":"Tune-Up","customer_name":"Test Rider","customer_email":"test@example.com","preferred_date":"2026-10-10","preferred_time_slot":"Morning","service_price":0,"vehicle_type":"cycle","vehicle_model":"Trek FX"}}'
```

Calling it with the public anon key returns **403** (webhook-only), which is the
intended behaviour.

---

## Troubleshooting

- **`403 This endpoint is restricted to the database webhook`** — the request did
  not carry a service-role JWT. Fix the `Authorization` header on the webhook.
- **`skipped: no workshop notification recipient is set`** — save a Notification
  Recipient email in the app's staff settings (`app_settings.owner_email`).
- **`skipped: workshop email alerts are turned off`** — enable email alerts in the
  app's staff settings.
- **`Email provider rejected the request`** — check `RESEND_API_KEY` and that the
  `from` domain is verified in Resend.
- **Customer got a confirmation but the workshop didn't** — the customer email is
  sent by the app; the workshop alert needs this webhook (and the `send-email`
  function is not involved in the workshop path any more).

## Related

- `supabase/SEND_EMAIL_SETUP.md` — the general email setup (the `send-email`
  function used for customer confirmations, approvals/declines and test emails).
- `supabase/functions/notify-booking/index.ts` — this webhook's function.
