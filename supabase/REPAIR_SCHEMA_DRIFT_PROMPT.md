# Supabase Repair — Supabase Dashboard Assistant Prompt

Copy everything between the lines into the Supabase **Dashboard → SQL Editor → New query**
assistant (or any Supabase-connected assistant). It is self-contained and idempotent.

---

You are working on the Supabase project `lhojocpygcnkxvkrcuxh`
(`https://lhojocpygcnkxvkrcuxh.supabase.co`). This project backs a React 19 + Vite
loyalty / workshop-booking app for a bike shop. An external audit of the live project
found the following. Please apply the fixes below, then run the verification queries
and report the results.

## Context: what the audit found

The live project currently has **13 tables** in `public` — all exist and all are
readable/writable and realtime-enabled:

```
profiles, stamp_logs, customer_bikes, service_bookings, prize_wheels, prize_draws,
service_vouchers, discount_codes, counter_sales, app_settings, app_theme_config,
staff_members, promotions
```

Authentication is healthy: Email + Google are both enabled, `mailer_autoconfirm = false`
(so email confirmation is required — the app handles that). No RPCs are used by the app.
Storage buckets are not used.

The remaining failures are all **schema drift** (columns the app writes that the live
tables lack) plus **one missing edge function** and **one empty settings row**.

### Confirmed defects

| # | Area | Live problem | Impact |
|---|------|--------------|--------|
| 1 | `stamp_logs` | `id` is type **uuid**, but the app writes ids like `log-1727…-482`. Every stamp / merit / audit log insert fails with `22P02`. Also `reward_id` and `staff_id` (uuid) are written but `reward_id` is missing and `staff_id` is uuid while the app sends `staff-1234`. | Stamp history, audit trail, and the customer activity feed never persist. |
| 2 | `customer_bikes` | The app reads `last_spin_date`-style meta fields out of `scraped_data.meta` (fine), but `customer_bikes.id` is uuid while the app sends `bike-…` ids. | Bikes added from the app fail to insert. |
| 3 | `profiles` | `last_spin_date` is written by `updateUserProfileInDb` but the column does not exist → `PGRST204`, which **aborts the whole upsert**. `profiles.id` is also uuid with an FK to `auth.users` (see item 6). | Stamp/ticket/merit balance updates silently fail. |
| 4 | `service_bookings` | `customer_phone`, `service_id`, `service_title`, `preferred_date`, `preferred_time_slot` are `NOT NULL` with no defaults; the app sends `null` for several. | Online bookings fail to persist. |
| 5 | `discount_codes` | `type` has a CHECK constraint allowing only `percent` / `fixed`; the app also writes `service_credit` (from voucher conversion). | Voucher→discount conversion fails. |
| 6 | `send-email` | The edge function does not exist (HTTP 404). The app calls `supabase.functions.invoke('send-email', …)`. | All booking/approval emails are skipped. |
| 7 | `app_settings` | Row `id = 1` exists but `owner_email` is `NULL` and `email_alerts_enabled = false`. | The app skips workshop email alerts entirely, before even calling the function. |

## Task

Produce and run a single, idempotent SQL script that:

1. **`stamp_logs`** — change `id` to `text`; add `reward_id text`; change `staff_id` to
   `text`; make `user_id` nullable (or give it a default) so the app's primary payload
   lands. Keep the table realtime-enabled.
2. **`customer_bikes`** — change `id` to `text`.
3. **`profiles`** — add `last_spin_date text`. Keep `last_spun_at` (both are read).
4. **`service_bookings`** — add defaults (`''` for the two text fields, `now()` for
   `preferred_date`) or drop `NOT NULL` on `customer_phone`, `service_id`,
   `service_title`, `preferred_date`, `preferred_time_slot` so an app payload with nulls
   persists.
5. **`discount_codes`** — replace the `type` CHECK constraint so it allows
   `percent`, `fixed`, and `service_credit`.
6. **Profile auto-creation** — add an `AFTER INSERT ON auth.users` trigger that inserts a
   matching `public.profiles` row, and backfill any auth users missing a profile. (There
   is an FK from `profiles.id` to `auth.users.id`, so a profile row can only be created
   after the auth user exists.)
7. **`app_settings`** — ensure the singleton row exists and set a real `owner_email`
   (ask the operator for the workshop address) and `email_alerts_enabled = true`.
8. **Grants / RLS** — re-assert `USAGE` on schema `public` and `SELECT/INSERT/UPDATE/DELETE`
   for `anon` and `authenticated` on every table, with a permissive RLS policy.

Then run and report:

```sql
-- every table should have anon + authenticated grants
SELECT table_name, grantee, count(*) AS privs
  FROM information_schema.role_table_grants
 WHERE table_schema='public' AND grantee IN ('anon','authenticated')
 GROUP BY table_name, grantee ORDER BY table_name;

-- should list every table
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';

-- should be empty after the fix
SELECT u.id, u.email FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL;

-- stamp_logs.id / customer_bikes.id should be 'text'
SELECT table_name, column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND column_name='id'
   AND table_name IN ('stamp_logs','customer_bikes');
```

## Notes

- The app also has a client-side fallback that retries a minimal `stamp_logs` payload, but
  it cannot succeed while `id` is uuid — fixing the column type is the real fix.
- Do **not** change `auth` config: `mailer_autoconfirm = false` is intentional; the app
  passes `emailRedirectTo` and handles the confirmation link.
- Keep everything idempotent — this may be re-run.

---

## Companion file

The ready-to-run SQL implementing items 1–8 is in `supabase/repair_schema_drift.sql`
in the app repository.
