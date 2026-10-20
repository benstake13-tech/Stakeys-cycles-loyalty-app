-- The durable native outbox replaces only the old booking push transport.
-- Preserve booking email/webhook triggers.
drop trigger if exists service_bookings_booking_push_insert on public.service_bookings;
