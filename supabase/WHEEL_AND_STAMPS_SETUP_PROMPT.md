# Prompt: make the Prize Wheel + Stamp Card persist in Supabase (and remove local caching)

Two ways to use this file:
1. Paste the **AI prompt** below into the Supabase SQL Editor's AI assistant (or any coding AI) to generate + apply the changes.
2. Or run the ready-made SQL directly: **Service Status** badge → "Copy SQL setup" (it is the same superset of statements, safe to re-run).

Use this when the wheel or stamp card "works" in the UI but reverts to 0 on reload.

---

## Symptom this fixes

The app awards stamps/prizes optimistically, then the value snaps back to 0 seconds later. Underneath, every write is being **rejected** by the database and the app was swallowing the error. Typical errors seen when reading/writing with the `anon` key:

- `42501 permission denied for table profiles` — the `anon`/`authenticated` roles have no table GRANTs.
- `42703 column profiles.stamps does not exist` — the live `profiles` table drifted and is missing columns.
- `42501 new row violates row-level security policy for table "stamp_logs"` — RLS enabled with no permissive policy.
- `22P02 invalid input syntax for type uuid: "system-wheel"` / `"log-…"` — `stamp_logs.staff_id` and `stamp_logs.id` were created as `uuid`, but the app uses readable text ids.

## AI prompt (copy/paste)

> You are working on my Supabase Postgres database for a bike-shop loyalty app. The award "Prize Wheel" and the "Stamp Card" do not persist: stamps and prizes are awarded in the UI but revert to 0 on reload, and the browser console shows `42501 permission denied`, `42703 column does not exist`, or `22P02 invalid input syntax for type uuid`. Please fix the schema and privileges so the app can read and write this data, and make every statement safe to re-run. Apply everything in the `public` schema.
>
> Context: the app talks to Postgres **only through Supabase** (no localStorage for loyalty data). It uses readable text ids such as `log-1759500000000-42`, `wheel-main-01`, `staff-…`. The `anon` and `authenticated` roles must be able to read and write.
>
> 1. **Repair the `profiles` table** (it has drifted). Add any missing columns, keeping existing data:
>    - `stamps integer default 0`, `completed_cards integer default 0`, `merit_points integer default 0`
>    - `last_spun_at timestamptz`, `last_spin_date text`, `last_stamped_at timestamptz`
>    - make `membership_number` and `email` nullable (the app creates a profile at login before a membership code exists).
>
> 2. **Repair the `stamp_logs` table** so it matches what the app writes:
>    - add (if missing): `customer_id text`, `customer_name text`, `membership_number text`, `staff_name text`, `action text default 'add_stamp'`, `stamps_before integer`, `stamps_after integer`, `reward_id text`, `note text`, `timestamp timestamptz default now()`, `user_id uuid`.
>    - `ALTER COLUMN staff_id DROP NOT NULL`, `ALTER COLUMN action DROP NOT NULL`, `ALTER COLUMN user_id DROP NOT NULL`.
>    - `ALTER COLUMN id TYPE text USING id::text` and `ALTER COLUMN staff_id TYPE text USING staff_id::text` — the app mints readable text ids; uuid columns reject them with `22P02`.
>
> 3. **Create any of these tables that do not already exist**, all with `text` primary keys:
>    - `prize_wheels` — `id text primary key`, `title text not null`, `description text`, `segments jsonb not null` (array of slices: id, label, color, probability, prizeId, rewardType, rewardValue), `is_active boolean default true`, `ticket_cost integer default 1`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>    - `prize_draws` — `id text primary key`, `title text not null`, `prize_description text`, `draw_date text`, `status text default 'upcoming'`, `winner_uid text`, `winner_name text`, `completed_at timestamptz`, `created_at timestamptz default now()`.
>    - `service_vouchers` — `id text primary key`, `customer_id text not null`, `code text not null`, `title text not null`, `description text`, `value numeric default 0`, `type text default 'merch'`, `terms text`, `status text default 'available'`, `claimed_at timestamptz default now()`, `redeemed_at timestamptz`.
>    - `counter_sales`, `discount_codes` — if they are missing, recreate them per the discount-code system (see `DISCOUNT_CODES_SETUP_PROMPT.md`).
>    - `customer_bikes` and `service_bookings` — if missing, recreate them per the app tables (text ids, `created_at timestamptz default now()`).
>
> 4. **Privileges.** `GRANT USAGE ON SCHEMA public TO anon, authenticated;` then `GRANT SELECT, INSERT, UPDATE` (and `DELETE` on `discount_codes`) on every table above to `anon, authenticated`, wrapped so a missing optional table never aborts the script.
>
> 5. **Row Level Security.** Enable RLS on each table and, for each one, `DROP POLICY IF EXISTS "Allow all on <table>"` then `CREATE POLICY "Allow all on <table>" FOR ALL USING (true) WITH CHECK (true)` so the script can be re-run after a partial attempt. Wrap this in a `DO` block that skips tables that do not exist.
>
> 6. **Auto-create a profile at signup.** Add an `AFTER INSERT ON auth.users` trigger calling a `SECURITY DEFINER` function that inserts a `profiles` row (`id`, `email`, `display_name` from `raw_user_meta_data` → full_name/display_name/email local-part, role `customer`, counters 0) with `ON CONFLICT (id) DO NOTHING`. Backfill any existing `auth.users` that have no profile, joining `auth.users.id::text = profiles.id`.
>
> 7. **Seed one default wheel** if `prize_wheels` is empty: `id = 'wheel-main-01'`, title `Stakey's Weekly Prize Wheel`, `is_active = true`, `ticket_cost = 0`, and 8 segments summing to probability 1: +1 Loyalty Stamp (stamp, 0.28), £10 Off Gear (discount, 0.18), +2 Stamps (stamp, 0.16), Muc-Off Cleaner (merch, 0.12), +3 Stamps Jackpot! (stamp, 0.08), Free Inner Tube (merch, 0.08), +50 Store Merits (merit, 0.05), Free Workshop Coffee (service, 0.05).
>
> 8. **Realtime.** Add `profiles`, `stamp_logs`, `prize_wheels` and `prize_draws` to the `supabase_realtime` publication (skip any already present).
>
> Every statement must be idempotent so I can run the whole script again safely.

---

## Manual steps (no AI)

1. Open the Supabase dashboard → your project (`lhojocpygcnkxvkrcuxh`).
2. Left sidebar → **SQL Editor** → **New query**.
3. In the app, open **Service Status → "Copy SQL Script"**, paste it in, and click **Run**.
   (Or paste `supabase/migrations/20261003_loyalty_schema_sync.sql` if the tables already exist.)
4. Verify:

```sql
-- stamps column exists and is writable
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('stamps','completed_cards','merit_points','last_spun_at');

-- anon can read
set role anon;
select count(*) from public.profiles;
select count(*) from public.stamp_logs;
select id, title, is_active, jsonb_array_length(segments) as slices from public.prize_wheels;
reset role;
```

Expected: the 4 profile columns listed; counts return without `42501`; one wheel `wheel-main-01` with 8 slices.

5. Reload the app. Award a stamp / spin the wheel, then reload — the value should stick, and other devices should see it within ~4 seconds (polling) or instantly (realtime).

## What the app writes after this is applied

| Action | Table / column |
| --- | --- |
| Staff saves wheel edits (`WheelEditorModal`) | `prize_wheels` (upsert by `id`) |
| Customer spins; wins stamps / tickets / merits | `profiles.stamps`, `profiles.completed_cards`, `profiles.merit_points`, `profiles.last_spun_at` |
| Staff adds a visit stamp | `profiles.stamps`, `profiles.last_stamped_at` |
| Customer completes a 10-stamp card | `service_vouchers` + `profiles.stamps` reset |
| Prize draw executed | `prize_draws` (winner + `completed_at`) |
| Voucher redeemed at the till | `service_vouchers.status = 'redeemed'` |
| Every event | `stamp_logs` audit row |

Note: the app intentionally keeps **no localStorage cache** for loyalty data — profiles/stamps, wheels, draws, logs, bookings, promotions, staff roster and owner config are all read from and written to Supabase only.
