# Prompt: complete the Stakey's Cycles database setup (one script, all features)

Two ways to use this file:
1. Paste the **AI prompt** below into the Supabase SQL Editor's AI assistant (or any coding AI) to generate + apply the whole schema.
2. Or run the ready-made SQL directly: `supabase/complete_setup.sql` (idempotent — safe to run on a fresh project or re-run on an existing one), or the in-app **Service Status** badge → "Copy SQL setup".

This one script covers **every** feature in the app, including the ones that were previously missing and caused "staff can edit but nothing saves":

| Feature | Table(s) |
| --- | --- |
| Customers / loyalty members | `profiles` |
| Stamp & reward audit history | `stamp_logs` |
| Customer bikes | `customer_bikes` |
| Workshop bookings + live repair progress tracker | `service_bookings` |
| Prize wheel configuration | `prize_wheels` |
| Weekly prize draws | `prize_draws` |
| Won vouchers / prizes | `service_vouchers` |
| Discount codes | `discount_codes` |
| Counter sales + quote workflow | `counter_sales` |
| Seasonal theme (shared) | `app_theme_config` |
| Staff roster | `staff_members` |
| Promotions manager | `promotions` |
| Notification settings + automated reminders | `app_settings` |

If any of these were "working in the UI but not saving", it is because the table (or a column, grant, or RLS policy) was missing. Running this script fixes all of them at once.

---

## AI prompt (copy/paste)

> You are working on my Supabase Postgres database for a bike-shop loyalty and workshop app ("Stakey's Cycles"). I need the COMPLETE schema for every feature. Apply everything in the `public` schema. The script MUST be idempotent — safe to run on a brand-new project AND safe to re-run on an existing one without data loss or errors. Do not drop tables.
>
> **Create these tables if they do not already exist, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` any columns that may be missing:**
>
> 1. `profiles` — one row per customer/staff. `id text primary key` (app uses text/uuid), `uid text`, `email text`, `display_name text`, `membership_number text`, `role text default 'customer'`, `stamps integer default 0`, `completed_cards integer default 0`, `merit_points integer default 0`, `tickets integer default 0`, `last_spun_at timestamptz`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>
> 2. `stamp_logs` — loyalty audit history. `id text primary key`, `customer_id text`, `user_id text`, `customer_name text`, `membership_number text`, `staff_id text`, `staff_name text`, `action text`, `stamps_before integer`, `stamps_after integer`, `note text`, `timestamp timestamptz default now()`.
>
> 3. `customer_bikes` — bikes belonging to customers. `id text primary key`, `customer_id text`, `customer_name text`, `vehicle_category text`, `model text`, `make text`, `year text`, `frame_number text`, `color text`, `scraped_data jsonb`, `stock_specs_scraped boolean default false`, `created_at timestamptz default now()`.
>
> 4. `service_bookings` — workshop bookings **and the customer-facing live repair progress tracker**. `id text primary key`, `customer_id text`, `customer_name text`, `customer_phone text`, `customer_email text`, `membership_number text`, `service_id text`, `service_title text`, `service_price numeric default 0`, `vehicle_type text default 'Bicycle'`, `vehicle_model text`, `preferred_date text`, `preferred_time_slot text`, `notes text`, `status text default 'pending'`, `reminder_24h_sent boolean default false`, `repair_stage text default 'received'`, `progress_events jsonb default '[]'::jsonb`, `estimate_ready_at text`, `created_at timestamptz default now()`. (`repair_stage`, `progress_events`, `estimate_ready_at` are the repair-tracker columns — please include them.)
>
> 5. `prize_wheels` — staff-editable wheel config. `id text primary key`, `title text not null`, `description text`, `segments jsonb not null`, `is_active boolean default true`, `ticket_cost integer default 1`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>
> 6. `prize_draws` — weekly winner draws. `id text primary key`, `title text not null`, `prize_description text`, `draw_date text`, `status text default 'upcoming'`, `winner_uid text`, `winner_name text`, `completed_at timestamptz`, `created_at timestamptz default now()`.
>
> 7. `service_vouchers` — vouchers/prizes a customer has won. `id text primary key`, `customer_id text`, `code text not null`, `title text not null`, `description text`, `value numeric default 0`, `type text default 'merch'`, `terms text`, `status text default 'available'`, `claimed_at timestamptz default now()`, `redeemed_at timestamptz`.
>
> 8. `discount_codes` — staff-created till discount codes. `id text primary key`, `code text not null`, `title text not null`, `description text`, `type text default 'percent'` (`percent` | `fixed`), `value numeric default 0`, `status text default 'active'`, `expires_at timestamptz`, `usage_limit integer`, `times_used integer default 0`, `assigned_to_uid text`, `assigned_to_membership text`, `assigned_to_name text`, `eligible_categories jsonb default '[]'::jsonb`, `minimum_spend numeric`, `created_by text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>
> 9. `counter_sales` — completed over-the-counter sales **plus the quote/approve workflow**. `id text primary key`, `sale_number text`, `customer_id text`, `membership_number text`, `customer_name text`, `items jsonb not null default '[]'::jsonb`, `subtotal numeric default 0`, `vat_rate numeric default 0`, `vat_amount numeric default 0`, `discount numeric default 0`, `discount_code text`, `discount_label text`, `discount_source text`, `grand_total numeric default 0`, `payment_method text default 'unpaid'`, `staff_uid text`, `staff_name text`, `created_at timestamptz default now()`, `status text default 'completed'`, `quoted_amount numeric`, `quote_note text`, `quote_sent_at timestamptz`, `quote_sent_by text`, `approved_at timestamptz`, `approved_by text`, `declined_at timestamptz`, `decline_reason text`.
>
> 10. `app_theme_config` — ONE shared row, so a theme applied once applies to every account. `id integer primary key default 1`, `theme text default 'none'` (`none` | `halloween` | `christmas` | `easter` | `cny` | `valentines`), `updated_at timestamptz default now()`. Then `INSERT INTO public.app_theme_config (id, theme) SELECT 1, 'none' WHERE NOT EXISTS (SELECT 1 FROM public.app_theme_config WHERE id = 1);`
>
> 11. `staff_members` — the workshop **staff roster** (this table is why staff edits currently don't save). `id text primary key`, `name text`, `email text`, `phone text`, `role text default 'Mechanic'`, `status text default 'Active'`, `joined_date text`, `certification_level text`, `avatar_color text`, `notes text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>
> 12. `promotions` — the shop **promotions manager** (also currently not saving). `id text primary key`, `title text`, `subtitle text`, `code text`, `discount_percentage numeric`, `discount_amount numeric`, `badge_text text`, `status text default 'active'`, `start_date text`, `end_date text`, `terms_and_conditions jsonb default '[]'::jsonb`, `eligible_categories jsonb default '[]'::jsonb`, `bg_gradient text`, `featured boolean default false`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
>
> 13. `app_settings` — ONE shared row for workshop-wide **notification settings + automated reminders** (this is why the notification tester/settings currently don't save). `id integer primary key default 1`, `owner_email text`, `owner_phone text`, `email_alerts_enabled boolean default false`, `sms_alerts_enabled boolean default false`, `business_name text`, `automated_reminders_enabled boolean default true`, `updated_at timestamptz default now()`. Then `INSERT INTO public.app_settings (id) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 1);`
>
> **Then, so reads/writes don't fail with 42501 / RLS errors — but only for tables that exist:**
>
> - Grant `USAGE ON SCHEMA public` and the table privileges, guarded so a missing role or table can never abort the script. Wrap in a `DO` block that checks `pg_roles` for `anon` / `authenticated` and `to_regclass` for each table.
> - `GRANT SELECT, INSERT, UPDATE ON <each table> TO anon, authenticated;`
> - `GRANT DELETE ON public.discount_codes, public.staff_members, public.promotions TO anon, authenticated;` (these three support delete in the UI).
> - `ALTER TABLE <each table> ENABLE ROW LEVEL SECURITY;` then `DROP POLICY IF EXISTS ...` and `CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true)` for anon + authenticated (permissive, matching the rest of this app). Make it re-runnable.
> - Add every table to the `supabase_realtime` publication, skipping ones already present and skipping gracefully if the publication does not exist.
>
> **Data-repair steps (important):**
>
> - In the live database `stamp_logs.id` and `stamp_logs.staff_id` may be typed `uuid`, but the app writes text ids, which throws `22P02`. Add a guarded `ALTER TABLE public.stamp_logs ALTER COLUMN id TYPE text USING id::text;` (and the same for `staff_id`), catching and skipping if the column doesn't exist or the cast fails.
> - Auto-create a `profiles` row for every new auth user via a trigger on `auth.users`, and backfill profiles for existing auth users that have none. Guard the whole block so a plain Postgres database without `auth.users` is skipped cleanly.
>
> Finally, print a short summary of what was created/repaired. The entire script must exit `0` both on a fresh database and on a re-run. Please output the full SQL.
