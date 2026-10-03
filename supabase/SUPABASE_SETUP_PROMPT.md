# Supabase setup prompt

Copy everything between the lines into the Supabase Assistant (Dashboard → **Ask AI**),
or paste it to whoever runs your SQL. It is self-contained: the assistant should not
need the rest of the repo to act on it.

---

You are helping me finish the database setup for **Stakey's Cycles & Scooter**, a
React + Supabase loyalty / rewards / workshop-booking app. The anon key talks to this
project directly from the browser.

**Status:** the `service_bookings` migration has already run successfully — the approval
and quote columns exist and `approval_status` is backfilled. Do not redo it.

**Ground rules**
- Everything must be **idempotent** — safe to run repeatedly, no errors on re-run.
- **Never DROP a table and never DELETE rows.** Only add columns / grants / policies / rows.
- Wrap each logical step so one failure cannot roll back the rest (guarded `DO $$` blocks).
- After running, report a short verification result.

**What to create or verify** (all in schema `public`):

1. **Tables** (create if missing; then `ADD COLUMN IF NOT EXISTS` every listed column):
   - `profiles` — `id TEXT PK, email, display_name TEXT NOT NULL, phone, role DEFAULT 'customer', membership_number, stamps INT DEFAULT 0, completed_cards INT DEFAULT 0, merit_points INT DEFAULT 0, last_spun_at TIMESTAMPTZ, last_spin_date TEXT, last_stamped_at TIMESTAMPTZ, created_at, updated_at`
   - `stamp_logs` — `id TEXT PK, customer_id, customer_name, membership_number, staff_id, staff_name, action DEFAULT 'add_stamp', stamps_before INT, stamps_after INT, reward_id, note, user_id UUID, timestamp`
   - `customer_bikes` — `id TEXT PK, customer_id, brand, model, year, color, serial_number, category DEFAULT 'Bicycle', stock_specs_scraped BOOL, scraped_data JSONB, created_at`
   - `service_bookings` — `id TEXT PK, customer_id, customer_name, customer_phone, customer_email, membership_number, service_id, service_title, service_price NUMERIC, vehicle_type, vehicle_model, preferred_date, preferred_time_slot, notes, status DEFAULT 'pending', reminder_24h_sent BOOL, repair_stage DEFAULT 'received', progress_events JSONB, estimate_ready_at TEXT, approval_status DEFAULT 'pending_approval', approved_at TIMESTAMPTZ, approved_by TEXT, declined_at TIMESTAMPTZ, decline_reason TEXT, staff_notes TEXT, quoted_price NUMERIC, quote_note TEXT, quote_sent_at TIMESTAMPTZ, quote_sent_by TEXT, created_at`
   - `prize_wheels` — `id TEXT PK, title TEXT NOT NULL, description, segments JSONB NOT NULL, is_active BOOL DEFAULT true, ticket_cost INT DEFAULT 1, created_at, updated_at`
   - `prize_draws` — `id TEXT PK, title TEXT NOT NULL, prize_description, draw_date TEXT, status DEFAULT 'upcoming', winner_uid, winner_name, completed_at, created_at`
   - `service_vouchers` — `id TEXT PK, customer_id, code TEXT NOT NULL, title TEXT NOT NULL, description, value NUMERIC, type DEFAULT 'merch', terms, status DEFAULT 'available', claimed_at, redeemed_at`
   - `discount_codes` — `id TEXT PK, code TEXT NOT NULL, title TEXT NOT NULL, description, type DEFAULT 'percent', value NUMERIC, status DEFAULT 'active', expires_at, usage_limit INT, times_used INT DEFAULT 0, assigned_to_uid, assigned_to_membership, assigned_to_name, eligible_categories JSONB, minimum_spend NUMERIC, created_by, created_at, updated_at`
   - `counter_sales` — `id TEXT PK, sale_number, customer_id, membership_number, customer_name, items JSONB NOT NULL, subtotal NUMERIC, vat_rate NUMERIC, vat_amount NUMERIC, discount NUMERIC, discount_code, discount_label, discount_source, grand_total NUMERIC, payment_method DEFAULT 'unpaid', staff_uid, staff_name, created_at, status DEFAULT 'completed', quoted_amount NUMERIC, quote_note, quote_sent_at, quote_sent_by, approved_at, approved_by, declined_at, decline_reason`
   - `app_theme_config` — `id INT PK DEFAULT 1, theme TEXT DEFAULT 'none', updated_at`
   - `staff_members` — `id TEXT PK, name, email, phone, role DEFAULT 'Cytech Mechanic', status DEFAULT 'Active', joined_date TEXT, cytech_level, avatar_color, notes, created_at, updated_at`
   - `promotions` — `id TEXT PK, title, subtitle, code, discount_percentage NUMERIC, discount_amount NUMERIC, badge_text, status DEFAULT 'active', start_date TEXT, end_date TEXT, terms_and_conditions JSONB, eligible_categories JSONB, bg_gradient, featured BOOL DEFAULT false, created_at, updated_at`
   - `app_settings` — `id INT PK DEFAULT 1, owner_email, owner_phone, email_alerts_enabled BOOL DEFAULT false, sms_alerts_enabled BOOL DEFAULT false, business_name, automated_reminders_enabled BOOL DEFAULT true, updated_at`

   Notes: all app ids are **TEXT** (not uuid) — this matters for `stamp_logs.id` / `staff_id`
   and `profiles.id`. `stamp_logs.user_id` is the only UUID column.

2. **Grants** — for each existing table above, `GRANT SELECT, INSERT, UPDATE, DELETE` to
   `anon` and `authenticated`; also `GRANT USAGE ON SCHEMA public` to those roles plus
   `service_role`. Guard each grant so a missing role/table does not abort the script.

3. **Row Level Security** — `ENABLE ROW LEVEL SECURITY` and a permissive
   `CREATE POLICY "Allow all on <table>" ON public.<table> FOR ALL USING (true) WITH CHECK (true)`
   on every table.

4. **Signup function + trigger** — create `public.handle_new_loyalty_user()` (SECURITY DEFINER,
   `search_path = public`) that inserts a `profiles` row for `NEW.id::text` with
   `display_name` = `full_name` → `display_name` → email local-part → `'Stakey Rider'`,
   role `'customer'`, zeroed counters, `ON CONFLICT (id) DO NOTHING`; attach it as
   `AFTER INSERT ON auth.users` trigger `on_auth_user_created_loyalty`. Then **backfill**:
   insert a profile for every `auth.users` row that has none.

5. **Singleton rows** — ensure `app_settings(id=1)` and `app_theme_config(id=1,'none')` exist.
   If `app_theme_config` has a legacy `active_theme` column, copy its value into `theme`.

6. **Seed** — if `prize_wheels` is empty, insert the default active wheel (id
   `wheel-main-01`, title "Stakey's Weekly Prize Wheel", 8 segments with probabilities,
   `is_active = true`, `ticket_cost = 0`).

7. **Realtime** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.<table>` for every
   table (ignore "already member" errors).

**Then verify and report:**
- `SELECT column_name FROM information_schema.columns WHERE table_name='service_bookings'`
  (should include the approval/quote columns).
- Row counts for `profiles`, `service_bookings`, `app_settings`, `prize_wheels`.
- Confirm `handle_new_loyalty_user` and trigger `on_auth_user_created_loyalty` exist.
- Any `RAISE NOTICE` warnings produced.

The authoritative reference is `supabase/complete_setup.sql` in the app repo — if you can
see it, running that file top-to-bottom is the intended one-shot action.
