-- Bilingual booking translation payload: the English job sheet the workshop
-- reads, plus the rider's untouched original native text for verification. The
-- booking form translates the four free-text fields on submit (BookingPortal)and
-- stores both sides in this jsonb column; the staff card renders the English
-- primary with a collapsible "view original" toggle. Idempotent and
-- non-destructive — safe to run more than once.
--
-- Run once in the Supabase SQL Editor for project lhojocpygcnkxvkrcuxh.
-- Until it is applied the app still works:the booking insert/update retries
-- without this column, so the job saves with just the English notes.

ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS translation_payload jsonb;

-- Verify
SELECT id, customer_name, customer_language, language_detected,
       translated_payload_en->>'issue_description' AS en_issue,
       original_payload_native->>'issue_description' AS native_issue
FROM public.service_bookings
CROSS JOIN LATERAL jsonb_to_record(translation_payload) AS x(
  customer_language text,
  language_detected text,
  translated_payload_en jsonb,
  original_payload_native jsonb
)
WHERE translation_payload IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;