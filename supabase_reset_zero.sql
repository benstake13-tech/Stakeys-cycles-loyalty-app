-- ============================================================================
-- STAKEY'S CYCLES - RESET ALL VALUES BACK TO ZERO (SUPABASE SQL)
-- Run this in your Supabase SQL Editor to reset all profiles, stamps, tickets, 
-- bookings, and logs to zero across all devices.
-- ============================================================================

-- 1. Reset all user profiles stamps, tickets, and merits back to 0
UPDATE public.profiles
SET 
  stamps = 0,
  completed_cards = 0,
  merit_points = 0,
  last_spin_date = NULL,
  updated_at = TIMEZONE('utc'::text, NOW());

-- 2. Clear all service bookings
DELETE FROM public.service_bookings;

-- 3. Clear all visit stamp audit logs
DELETE FROM public.stamp_logs;

-- 4. Optional: clear customer bikes garage (uncomment if you want bikes reset too)
-- DELETE FROM public.customer_bikes;

SELECT 'Database successfully reset back to zero across all connected devices!' AS status;
