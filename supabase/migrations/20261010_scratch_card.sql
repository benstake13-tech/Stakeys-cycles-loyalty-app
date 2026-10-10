-- Scratch card feature (Prize Hub).
--
-- A shop-wide scratch card that customers play from their loyalty area. The
-- whole configuration — the master enabled flag, the cooldown, the ticket cost
-- and the weighted prize table — is one jsonb blob on the shared app_settings
-- row, so every staff terminal and every rider sees the same card. `enabled`
-- is the switch the Prize Hub toggles; when false the customer tab is hidden.
--
-- Also adds profiles.last_scratched_at so the per-rider cooldown is enforced
-- server-side, mirroring last_spun_at for the prize wheel.
--
-- Idempotent and non-destructive.
--
-- Run this once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS scratch_card_config JSONB;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_scratched_at TIMESTAMPTZ;

-- Seed a sensible default card only when nothing has been stored yet, so a
-- workshop that has already configured its prizes is never overwritten.
UPDATE public.app_settings
SET scratch_card_config = '{
  "id": "scratch-main-01",
  "title": "Stakey''s Scratch Card",
  "enabled": false,
  "cooldownHours": 168,
  "ticketCost": 0,
  "prizes": [
    {"id": "scratch-prize-stamp-1",   "label": "+1 Loyalty Stamp",     "weight": 30, "rewardType": "stamp",    "stampsAmount": 1},
    {"id": "scratch-prize-stamp-2",   "label": "+2 Loyalty Stamps",    "weight": 16, "rewardType": "stamp",    "stampsAmount": 2},
    {"id": "scratch-prize-gear-10",   "label": "£10 Off Gear",         "weight": 14, "rewardType": "discount", "rewardValue": "£10 Off In-Store Accessories"},
    {"id": "scratch-prize-cleaner",   "label": "Muc-Off Cleaner",      "weight": 12, "rewardType": "merch",    "rewardValue": "Complimentary Muc-Off Bike Cleaner"},
    {"id": "scratch-prize-points-50", "label": "+50 Store Points",     "weight": 10, "rewardType": "points",   "pointsAmount": 50},
    {"id": "scratch-prize-ticket-1",  "label": "Prize Draw Ticket",    "weight": 8,  "rewardType": "ticket",   "ticketAmount": 1},
    {"id": "scratch-prize-coffee",    "label": "Free Workshop Coffee", "weight": 6,  "rewardType": "service",  "rewardValue": "Free Coffee while bike is serviced"},
    {"id": "scratch-prize-tube",      "label": "Free Inner Tube",      "weight": 4,  "rewardType": "merch",    "rewardValue": "Free Presta/Schrader Inner Tube at Till"}
  ]
}'::jsonb
WHERE id = 1
  AND scratch_card_config IS NULL;

-- Verify
SELECT id, scratch_card_config FROM public.app_settings WHERE id = 1;
