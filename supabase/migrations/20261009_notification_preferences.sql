-- Staff-managed notification preferences.
--
-- Each workshop event (new booking, SOS, new member, stamp milestone, bike
-- added, voucher issued, prize won) can be routed to any combination of three
-- channels: an in-app visual notification (the bell), email, and OneSignal push.
-- The whole matrix is one jsonb blob on the shared app_settings row, so the
-- choice is shared across every staff terminal.
--
-- Idempotent and non-destructive.
--
-- Run this once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

-- Seed the high-urgency defaults only when nothing has been stored yet, so an
-- existing workshop's choices are never overwritten by a re-run.
UPDATE public.app_settings
SET notification_preferences = '{
  "new_booking":     {"visual": true, "email": true,  "push": true},
  "sos_request":     {"visual": true, "email": true,  "push": true},
  "sos_confirmed":   {"visual": true, "email": true,  "push": true},
  "new_member":      {"visual": true, "email": false, "push": false},
  "stamp_milestone": {"visual": true, "email": false, "push": false},
  "reward_ready":    {"visual": true, "email": false, "push": false},
  "bike_added":      {"visual": true, "email": false, "push": false},
  "voucher_earned":  {"visual": true, "email": false, "push": false},
  "prize_won":       {"visual": true, "email": false, "push": false}
}'::jsonb
WHERE id = 1
  AND notification_preferences IS NULL;

-- Verify
SELECT id, notification_preferences FROM public.app_settings WHERE id = 1;
