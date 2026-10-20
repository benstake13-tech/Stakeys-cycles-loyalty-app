-- No notifications leave this transaction: all fixtures and pg_net work roll back.
begin;
do $$
declare staff uuid:=gen_random_uuid(); customer uuid:=gen_random_uuid(); listing uuid:=gen_random_uuid();
 conversation uuid:=gen_random_uuid(); message uuid:=gen_random_uuid(); donor uuid:=gen_random_uuid();
 e private.staff_push_events; original_count int;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (staff,staff||'@example.test','{}'),(customer,customer||'@example.test','{}');
 update public.profiles set role='staff' where id=staff;
 select count(*) into original_count from private.staff_push_events where source_id=customer::text;
 update public.profiles set avatar_color='test' where id=customer;
 if (select count(*) from private.staff_push_events where source_id=customer::text)<>original_count then raise exception 'Avatar edit should not notify'; end if;
 update public.profiles set stamps=coalesce(stamps,0)+1 where id=customer;
 if (select count(*) from private.staff_push_events where source_id=customer::text)<>original_count+1 then raise exception 'Loyalty change lost'; end if;
 insert into public.marketplace_listings(id,seller_id,title,make_model,category,condition,asking_price,status)
 values(listing,staff,'Push fixture','Fixture','parts','good',10,'active');
 insert into public.marketplace_conversations(id,listing_id,buyer_id,seller_id) values(conversation,listing,customer,staff);
 insert into public.marketplace_messages(id,conversation_id,sender_id,body) values(message,conversation,customer,'Private fixture text');
 select * into e from private.staff_push_events where source_id=message::text;
 if e.id is null or e.recipient_ids<>array[staff] then raise exception 'Private message staff recipient restriction failed'; end if;
 if e.title like '%Private fixture%' then raise exception 'Message text leaked'; end if;
 perform set_config('request.jwt.claim.sub',staff::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated')::text,true);
 perform public.record_marketplace_manual_sale(listing,'Fixture buyer','fixture@example.test',8,'Push fixture');
 if not exists(select 1 from private.staff_push_events where source_id=listing::text and title='Marketplace bike marked sold') then raise exception 'Sold event lost'; end if;
 insert into public.bike_donation_requests(id,donor_name,email,postcode,bike_details,condition,consent_to_contact)
 values(donor,'Fixture','fixture@example.test','M1 1AA','Fixture bike','needs_repairs',true);
 if not exists(select 1 from private.staff_push_events where source_id=donor::text and section='tradeins') then raise exception 'Donation event lost'; end if;
 if has_table_privilege('anon','private.staff_push_events','select') or has_table_privilege('authenticated','private.staff_push_config','select') then raise exception 'Private queue/config exposed'; end if;
 if has_function_privilege('authenticated','public.claim_staff_push_events(text)','execute') then raise exception 'Public claim exposed'; end if;
 begin perform public.claim_staff_push_events(repeat('0',64)); raise exception 'Invalid token accepted'; exception when insufficient_privilege then null; end;
 -- Lease-bound outcomes reject stale worker acknowledgements.
 update private.staff_push_events set lease_id=gen_random_uuid(),attempts=1 where id=e.id returning * into e;
 perform public.finish_staff_push_event(e.id,gen_random_uuid(),'accepted','wrong',null);
 if exists(select 1 from private.staff_push_events where id=e.id and status='accepted') then raise exception 'Stale worker accepted'; end if;
 perform public.finish_staff_push_event(e.id,e.lease_id,'retry',null,'Provider unavailable');
 if not exists(select 1 from private.staff_push_events where id=e.id and status='retry' and next_attempt_at>now()) then raise exception 'Retry lost'; end if;
end $$;
rollback;
select 'PASS: transactional events, privacy, role targeting, sold/donation coverage, protected queue/RPCs, invalid-token rejection, stale lease rejection and retry; fixtures rolled back' as result;
