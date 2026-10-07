-- SOS Emergency Repair columns on service_bookings.
-- A priority call-out: skips the workshop queue and carries an express
-- surcharge. The customer still requests it and describes the fault; staff
-- approve, request the rider's live location over WhatsApp, quote, and set off
-- only once the quoted price is confirmed.
--
-- Idempotent: safe to run more than once.

ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS is_sos BOOLEAN DEFAULT FALSE;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_status TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_location_requested_at TIMESTAMPTZ;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_location_note TEXT;
ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS sos_confirmed_at TIMESTAMPTZ;

-- SOS jobs are found fast by staff, so index the flag.
CREATE INDEX IF NOT EXISTS service_bookings_is_sos_idx
  ON public.service_bookings (is_sos)
  WHERE is_sos IS TRUE;
