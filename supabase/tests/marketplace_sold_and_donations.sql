-- Synthetic accounts, sale and donation fixtures; every change is rolled back.
begin;
do $$ declare seller uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); listing uuid:=gen_random_uuid(); donation uuid:=gen_random_uuid();begin
 perform set_config('test.seller',seller::text,true);perform set_config('test.outsider',outsider::text,true);perform set_config('test.staff',staff::text,true);perform set_config('test.listing',listing::text,true);perform set_config('test.donation',donation::text,true);
 insert into auth.users(id,email,raw_user_meta_data)values(seller,seller||'@example.test','{}'),(outsider,outsider||'@example.test','{}'),(staff,staff||'@example.test','{}');
 update public.profiles set role='staff' where id=staff;
 insert into public.marketplace_listings(id,seller_id,title,make_model,category,condition,asking_price,status)values(listing,seller,'Sold visibility fixture','Fixture part','parts','good',10,'active');
 insert into storage.objects(bucket_id,name)values('marketplace-images',seller||'/'||listing||'/test.jpg');
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.outsider'),'role','authenticated')::text,true);
do $$begin
 begin perform public.record_marketplace_manual_sale(current_setting('test.listing')::uuid,'Test buyer','buyer@example.test',8,'');raise exception 'FAIL outsider completion';exception when insufficient_privilege then null;end;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.seller'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.seller'),'role','authenticated')::text,true);
select public.record_marketplace_manual_sale(current_setting('test.listing')::uuid,'Test buyer','buyer@example.test',8,'Completed fixture');
select set_config('test.sale_time',(select sold_at::text from public.marketplace_listings where id=current_setting('test.listing')::uuid),true);
select public.record_marketplace_manual_sale(current_setting('test.listing')::uuid,'Test buyer','buyer@example.test',8,'Retry');
do $$begin
 if not exists(select 1 from public.marketplace_listings where id=current_setting('test.listing')::uuid and status='sold' and sold_at=current_setting('test.sale_time')::timestamptz)then raise exception 'FAIL saved sale/idempotency';end if;
end;$$;
reset role;
do $$begin
 if(select count(*) from public.marketplace_record_events where listing_id=current_setting('test.listing')::uuid and event_type='manual_sale_recorded')<>1 then raise exception 'FAIL duplicate audit record';end if;
end;$$;
update public.marketplace_listings set sold_at='2099-01-01' where id=current_setting('test.listing')::uuid;
do $$begin if(select sold_at from public.marketplace_listings where id=current_setting('test.listing')::uuid)<>current_setting('test.sale_time')::timestamptz then raise exception 'FAIL timestamp tampering';end if;end;$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$begin
 if not exists(select 1 from public.marketplace_listings where id=current_setting('test.listing')::uuid)then raise exception 'FAIL fresh sold hidden';end if;
 if not exists(select 1 from storage.objects where bucket_id='marketplace-images' and name=current_setting('test.seller')||'/'||current_setting('test.listing')||'/test.jpg')then raise exception 'FAIL fresh sold photo hidden';end if;
 begin perform public.record_marketplace_manual_sale(current_setting('test.listing')::uuid,'Test buyer','buyer@example.test',8,'');raise exception 'FAIL anonymous completion';exception when insufficient_privilege then null;end;
 perform public.submit_bike_donation(current_setting('test.donation')::uuid,'Test donor',current_setting('test.donation')||'@example.test','','M1 1AA','Hybrid bicycle','needs_repairs','Fixture only',true);
 perform public.submit_bike_donation(current_setting('test.donation')::uuid,'Test donor',current_setting('test.donation')||'@example.test','','M1 1AA','Hybrid bicycle','needs_repairs','Fixture retry',true);
 begin perform public.submit_bike_donation(gen_random_uuid(),'Test donor','invalid','','','Bike','working','',true);raise exception 'FAIL invalid donor email';exception when raise_exception then if sqlerrm='FAIL invalid donor email' then raise;end if;end;
 begin perform public.submit_bike_donation(gen_random_uuid(),'Test donor','valid@example.test','','','Bike','working','',false);raise exception 'FAIL consent';exception when raise_exception then if sqlerrm='FAIL consent' then raise;end if;end;
 begin perform 1 from public.bike_donation_requests;raise exception 'FAIL anonymous donor privacy';exception when insufficient_privilege then null;end;
end;$$;
reset role;
-- Simulate the 48-hour boundary for this fixture only. Rollback restores trigger/data.
alter table public.marketplace_listings disable trigger marketplace_sale_timestamp;
update public.marketplace_listings set sold_at=now()-interval '48 hours' where id=current_setting('test.listing')::uuid;
alter table public.marketplace_listings enable trigger marketplace_sale_timestamp;
set local role anon;
do $$begin
 if exists(select 1 from public.marketplace_listings where id=current_setting('test.listing')::uuid)then raise exception 'FAIL expired sold public';end if;
 if exists(select 1 from storage.objects where bucket_id='marketplace-images' and name=current_setting('test.seller')||'/'||current_setting('test.listing')||'/test.jpg')then raise exception 'FAIL expired photo public';end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.seller'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.seller'),'role','authenticated')::text,true);
do $$begin
 if not exists(select 1 from public.marketplace_listings where id=current_setting('test.listing')::uuid and status='sold')then raise exception 'FAIL history removed';end if;
 if exists(select 1 from public.bike_donation_requests where id=current_setting('test.donation')::uuid)then raise exception 'FAIL customer donor privacy';end if;
 update public.bike_donation_requests set status='donated' where id=current_setting('test.donation')::uuid;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.staff'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.staff'),'role','authenticated')::text,true);
do $$begin
 if(select count(*) from public.bike_donation_requests where id=current_setting('test.donation')::uuid and status='new')<>1 then raise exception 'FAIL donor persistence/idempotency/privacy';end if;
 update public.bike_donation_requests set status='contacted' where id=current_setting('test.donation')::uuid;
 if not exists(select 1 from public.bike_donation_requests where id=current_setting('test.donation')::uuid and status='contacted')then raise exception 'FAIL staff tracking';end if;
end;$$;
rollback;
select 'PASS: owner completion, audit/idempotency, immutable sale time, public sold/photo visibility until 48h boundary, retained history, anonymous donation submission, consent validation and staff-only contact/status access; fixtures rolled back' as result;
