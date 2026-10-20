create function public.latest_staff_push_verification() returns text language sql security definer set search_path='' as $$ select provider_message_id from private.staff_push_events where event_type='system.native_push_verification' and status='accepted' order by created_at desc limit 1 $$;
revoke all on function public.latest_staff_push_verification() from public,anon,authenticated;
grant execute on function public.latest_staff_push_verification() to service_role;
