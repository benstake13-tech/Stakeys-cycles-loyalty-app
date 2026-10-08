-- Express SOS mode: the single visual category a rider tapped, plus the media
-- they captured in the app (a photo of the broken part and/or a short voice
-- note). Idempotent and non-destructive — safe to run more than once.
--
-- Run once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.
-- Until it is applied the app still works: the booking insert/update retries
-- without these columns, so the job saves and the notes marker carries the
-- category and the fact that media was attached.

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS sos_category text;

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS sos_photo_url text;

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS sos_voice_note_url text;

-- Verify
SELECT id, customer_name, sos_category, sos_photo_url IS NOT NULL AS has_photo,
       sos_voice_note_url IS NOT NULL AS has_voice
FROM public.service_bookings
WHERE is_sos IS TRUE
ORDER BY created_at DESC
LIMIT 20;
