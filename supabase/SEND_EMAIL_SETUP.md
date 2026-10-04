# Notification emails — setup and troubleshooting

The app sends its customer-facing and staff notification emails (booking
confirmation → customer, approval/decline → customer, and the staff "Send test
email" button) through a Supabase Edge Function called **`send-email`**, which
forwards them to [Resend](https://resend.com).

The **new booking → workshop** alert is different: it is sent server-side by a
Database Webhook + the `notify-booking` Edge Function, so it still fires when the
customer's browser is closed. See `supabase/WEBHOOK_EMAIL_SETUP.md`.

If emails never arrive, it is almost always because one of these three things is
missing. Work top to bottom.

## 1. The `send-email` function must be deployed

The source lives at `supabase/functions/send-email/index.ts`. Deploy it:

```bash
# install the CLI once: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref lhojocpygcnkxvkrcuxh
supabase functions deploy send-email
```

Verify it exists (should NOT be `404 NOT_FOUND`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://lhojocpygcnkxvkrcuxh.supabase.co/functions/v1/send-email
```

## 2. The `RESEND_API_KEY` secret must be set

Create a Resend account, add your sending domain, and create an API key. Then:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
# optional: override the default sender
supabase secrets set MAIL_FROM="Stakey's Cycles <noreply@stakeyscycles.co.uk>"
```

Or via Dashboard → Project Settings → Edge Functions → Secrets.

## 3. The sending domain must be verified in Resend

The app sends `from: noreply@stakeyscycles.co.uk`. That domain (or a subdomain
you choose) must be **verified in Resend** (DNS records added), otherwise Resend
rejects the request with a 4xx and nothing is delivered. Note the correct
spelling is `stakeyscycles.co.uk` — earlier code had a typo
(`stakeyscyles.co.uk`) which has since been fixed.

## 4. The workshop recipient must be set in the app

The "Send test email" button sends to `ownerEmail` from workshop settings
(stored in the `app_settings` table). Make sure a Notification Recipient email
is saved in the app's staff settings.

## Stop the false "delivered" logs

The app previously logged `✅ Delivered …` even when the call failed, because it
ignored the `{ error }` returned by `functions.invoke`. Those call sites now log
`❌ … failed` with the provider's message instead, so the browser console tells
you the truth (e.g. `Requested function was not found` = function not deployed).
