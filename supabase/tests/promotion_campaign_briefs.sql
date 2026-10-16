-- Integration regression: run against the migrated project; leaves no rows.
begin;
do $$
declare
  test_id text := 'promotion-check-' || gen_random_uuid()::text;
  blocked boolean := false;
begin
  insert into public.promotions (id,title,status,start_date,end_date,eligible_categories,terms_and_conditions,discount_percentage,discount_amount,campaign_brief)
  values (test_id,'Rollback-only quote test','upcoming','2099-01-01','2099-01-07','["cycle"]','["Written quote required"]',0,0,
  '{"version":1,"objective":"workshop","requiresQuote":true,"uptakeLimit":3,"serviceId":"test-service","segmentId":"test-segment","audience":"member"}');
  if not exists(select 1 from public.promotions where id=test_id and campaign_brief->>'serviceId'='test-service') then raise exception 'Campaign scope did not round-trip'; end if;
  begin update public.promotions set discount_percentage=10 where id=test_id;
  exception when check_violation then blocked := true; end;
  if not blocked then raise exception 'Quote-only discount guard failed'; end if;
  blocked := false;
  begin update public.promotions set campaign_brief=null where id=test_id;
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Campaign scope lock failed'; end if;
  blocked := false;
  begin update public.promotions set start_date='2099-01-02' where id=test_id;
  exception when raise_exception then blocked := true; end;
  if not blocked then raise exception 'Campaign date lock failed'; end if;
  update public.promotions set status='expired' where id=test_id;
end $$;
set local role anon;
do $$
declare blocked boolean := false;
begin
  perform id from public.promotions limit 1;
  begin insert into public.promotions (id,title) values ('denied-'||gen_random_uuid()::text,'Must not publish');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Anonymous publication was permitted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true) is not null as customer_context_set;
set local role authenticated;
do $$
declare blocked boolean := false;
begin
  begin insert into public.promotions (id,title) values ('denied-'||gen_random_uuid()::text,'Must not publish');
  exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Customer publication was permitted'; end if;
end $$;
reset role;
-- Use a real staff identity only inside this rolled-back SQL transaction.
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role in ('staff','admin') limit 1),true) is not null as staff_context_set;
set local role authenticated;
do $$
begin
  if not private.can_manage_promotions() then raise exception 'No staff identity available for publication test'; end if;
  insert into public.promotions (id,title) values ('staff-check-'||gen_random_uuid()::text,'Rollback-only staff publication');
end $$;
reset role;
rollback;
select 'PASS: scope round-trip, quote-only prices, immutable targeting, anonymous/customer denial and staff publication; all test rows rolled back' as result;
