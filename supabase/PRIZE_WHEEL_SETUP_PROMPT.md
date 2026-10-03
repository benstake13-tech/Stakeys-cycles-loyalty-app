# Prompt: make the Prize Wheel work and save its data in Supabase

Two ways to use this file:
1. Paste the **AI prompt** below into the Supabase SQL Editor's AI assistant (or any coding AI) to generate + apply the changes.
2. Or run the ready-made SQL directly: `supabase/migrations/20261003_prize_wheel_persistence.sql`, or the in-app **Service Status** badge → "Copy SQL setup".

---

## AI prompt (copy/paste)

> You are working on my Supabase Postgres database for a bike-shop loyalty app. The award "Prize Wheel" currently does not persist anything: wheel edits, spins, prizes and the weekly cooldown are lost on reload. Please create the missing schema and privileges so the app can read and write this data. Apply it in the `public` schema.
>
> Create these tables if they do not already exist:
>
> 1. `prize_wheels` — the editable wheel configuration.
>    - `id text primary key`
>    - `title text not null`
>    - `description text`
>    - `segments jsonb not null` (array of slices; each slice has id, label, color, probability, prizeId, rewardType, rewardValue)
>    - `is_active boolean default true`
>    - `ticket_cost integer default 1`
>    - `created_at timestamptz default now()`
>    - `updated_at timestamptz default now()`
>
> 2. `prize_draws` — the weekly winner draws.
>    - `id text primary key`, `title text not null`, `prize_description text`, `draw_date text`, `status text default 'upcoming'`, `winner_uid text`, `winner_name text`, `completed_at timestamptz`, `created_at timestamptz default now()`
>
> 3. `service_vouchers` — prizes the customer wins (discount, merch, service credit).
>    - `id text primary key`, `customer_id text not null`, `code text not null`, `title text not null`, `description text`, `value numeric default 0`, `type text default 'merch'`, `terms text`, `status text default 'available'`, `claimed_at timestamptz default now()`, `redeemed_at timestamptz`
>
> For the existing `profiles` table, add the column `last_spun_at timestamptz` if it is missing. This stores the weekly one-spin-per-rider cooldown.
>
> Then grant the `anon` and `authenticated` roles `SELECT, INSERT, UPDATE` on `profiles`, `prize_wheels`, `prize_draws` and `service_vouchers`, enable Row Level Security on the three new tables, and add an `FOR ALL USING (true)` policy on each so the shop app can read and write.
>
> Finally, seed one default wheel with `id = 'wheel-main-01'`, title `Stakey's Weekly Prize Wheel`, `is_active = true`, `ticket_cost = 0`, and these 8 segments (probabilities sum to 1): +1 Loyalty Stamp (stamp, 0.28), £10 Off Gear (discount, 0.18), +2 Stamps (stamp, 0.16), Muc-Off Cleaner (merch, 0.12), +3 Stamps Jackpot! (stamp, 0.08), Free Inner Tube (merch, 0.08), +50 Store Merits (merit, 0.05), Free Workshop Coffee (service, 0.05).
>
> Make every statement safe to re-run.

---

## Manual steps (no AI)

1. Open the Supabase dashboard → your project (`lhojocpygcnkxvkrcuxh`).
2. Left sidebar → **SQL Editor** → **New query**.
3. Paste `supabase/migrations/20261003_prize_wheel_persistence.sql` and click **Run**.
4. Verify with:
   ```sql
   select id, title, is_active, ticket_cost, jsonb_array_length(segments) as slices
   from public.prize_wheels;
   ```
   Expected: one row, `wheel-main-01`, 8 slices.

## What the app writes after this is applied

| Action | Table / column |
| --- | --- |
| Staff saves wheel edits (`WheelEditorModal`) | `prize_wheels` (upsert by `id`) |
| Customer spins and wins stamps/tickets/merits | `profiles.stamps`, `profiles.completed_cards`, `profiles.merit_points`, `profiles.last_spun_at` |
| Customer collects a full card (£40 service) | `service_vouchers` + `profiles.stamps` reset |
| Prize draw executed | `prize_draws` (winner + `completed_at`) |
| Voucher redeemed at the till | `service_vouchers.status = 'redeemed'` |
| Every event | `stamp_logs` audit row |

Once the table exists the app also loads the wheel on startup, so a config saved on one device appears on all devices.
