-- ============================================================================
-- Stakey's Cycles — Bike identity & e-bike conversion details
-- ============================================================================
-- Adds a single JSONB column to bookings and garage bikes that stores the
-- structured identity captured by the booking form and the "Add to Garage"
-- form: e-bike status (factory / converted), motor system, battery position,
-- drive type, serial number, frame size, year and mileage.
--
-- The app degrades gracefully if this is not run: it retries the insert without
-- the column and folds the data into scraped_data.meta instead. Running it
-- enables the dedicated column (and richer staff reporting).
--
-- Safe to run multiple times.
-- ============================================================================

ALTER TABLE public.service_bookings ADD COLUMN IF NOT EXISTS bike_details jsonb;
ALTER TABLE public.customer_bikes  ADD COLUMN IF NOT EXISTS bike_details jsonb;

-- Helpful for "show me every converted e-bike" style workshop queries.
CREATE INDEX IF NOT EXISTS idx_service_bookings_ebike_status
  ON public.service_bookings ((bike_details->>'ebikeStatus'));

CREATE INDEX IF NOT EXISTS idx_customer_bikes_ebike_status
  ON public.customer_bikes ((bike_details->>'ebikeStatus'));
