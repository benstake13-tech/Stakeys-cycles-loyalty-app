-- Events are recorded in the same transaction as the business change. Neither
-- the website nor an open staff app is required to send them.
create table private.staff_push_config (
 singleton boolean primary key default true check(singleton),
 dispatch_token text not null default encode(extensions.gen_random_bytes(32),'hex'),
 endpoint text not null default 'https://lhojocpygcnkxvkrcuxh.supabase.co/functions/v1/staff-event-push'
);
insert into private.staff_push_config(singleton) values(true);
create table private.staff_push_events (
 id uuid primary key default gen_random_uuid(),
 event_type text not null, source_id text not null, section text not null, title text not null,
 recipient_ids uuid[], created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','retry','accepted','skipped','failed')),
 attempts int not null default 0, next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 provider_message_id text, last_error text, accepted_at timestamptz
);
create index staff_push_pending on private.staff_push_events(next_attempt_at) where status in('pending','retry');
alter table private.staff_push_config enable row level security;
alter table private.staff_push_events enable row level security;
revoke all on private.staff_push_config,private.staff_push_events from public,anon,authenticated;

create function private.capture_staff_push_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare n jsonb:=to_jsonb(new); o jsonb:='{}'; title text; section text; kind text; audience uuid[];
begin
 if tg_op='UPDATE' then o:=to_jsonb(old); end if;
 case tg_table_name
 when 'service_bookings' then
  section:='bookings';
  if tg_op='INSERT' then
   title:=case when coalesce((n->>'is_sos')::boolean,false) then 'New SOS repair request' else 'New repair booking' end;
  elsif (n->'status',n->'approval_status',n->'repair_stage',n->'sos_status',n->'quoted_price') is distinct from
        (o->'status',o->'approval_status',o->'repair_stage',o->'sos_status',o->'quoted_price') then title:='Repair / SOS booking updated';
  end if;
 when 'profiles' then
  section:='customers';
  if tg_op='INSERT' then title:='New member registered';
  elsif n->'role' is distinct from o->'role' then title:='Member access role changed';
  elsif (n->'stamps',n->'completed_cards',n->'merit_points',n->'tickets') is distinct from
        (o->'stamps',o->'completed_cards',o->'merit_points',o->'tickets') then title:='Member loyalty balance updated'; end if;
 when 'customer_bikes' then section:='customers'; if tg_op='INSERT' then title:='Bike added to a member garage'; end if;
 when 'service_vouchers' then section:='customers';
  if tg_op='INSERT' then title:='Service voucher issued'; elsif n->'status' is distinct from o->'status' then title:='Service voucher updated'; end if;
 when 'wheel_spins' then section:='draws'; if tg_op='INSERT' and not coalesce((n->>'is_test')::boolean,false) then title:='Member won a wheel prize'; end if;
 when 'prize_draws' then section:='draws';
  if tg_op='INSERT' then title:='Prize draw created'; elsif (n->'status',n->'winner_uid') is distinct from (o->'status',o->'winner_uid') then title:='Prize draw result updated'; end if;
 when 'orders','ecommerce_orders','counter_sales' then section:='till';
  if tg_op='INSERT' then title:='New shop order / counter sale'; elsif n->'status' is distinct from o->'status' then title:='Shop order / quote updated'; end if;
 when 'marketplace_listings' then section:='marketplace';
  if tg_op='INSERT' then title:='New marketplace listing'; elsif n->'status' is distinct from o->'status' then
   title:=case when n->>'status'='sold' then 'Marketplace bike marked sold' else 'Marketplace listing status changed' end; end if;
 when 'marketplace_bids' then section:='marketplace'; if tg_op='INSERT' then title:='New marketplace auction bid'; end if;
 when 'marketplace_auctions' then section:='marketplace';
  if tg_op='INSERT' then title:='Marketplace auction started'; elsif n->'status' is distinct from o->'status' then title:='Marketplace auction updated'; end if;
 when 'marketplace_transactions' then section:='marketplace';
  if tg_op='INSERT' then title:='Marketplace checkout started'; elsif (n->'payment_status',n->'payout_status') is distinct from (o->'payment_status',o->'payout_status') then title:='Marketplace payment / payout updated'; end if;
 when 'marketplace_stolen_listing_flags' then section:='marketplace'; if tg_op='INSERT' then title:='Marketplace bike safety report'; end if;
 when 'marketplace_messages' then section:='marketplace';
  if tg_op='INSERT' then
   -- Never send another customer's private negotiation to all workshop staff.
   select array_agg(p.id) into audience from public.marketplace_conversations c
    join public.profiles p on p.id in(c.buyer_id,c.seller_id)
    where c.id=(n->>'conversation_id')::uuid and p.role in('admin','staff') and p.id<>(n->>'sender_id')::uuid;
   if audience is null then return new; end if;
   title:='New marketplace message';
  end if;
 when 'bike_donation_requests' then section:='tradeins';
  if tg_op='INSERT' then title:='New bicycle donation offer'; elsif n->'status' is distinct from o->'status' then title:='Bicycle donation status updated'; end if;
 when 'reviews' then section:='reviews'; if tg_op='INSERT' then title:='New customer review'; end if;
 when 'referrals' then section:='referrals'; if tg_op='INSERT' then title:='New member referral'; end if;
 else return new;
 end case;
 if title is not null then
  kind:=tg_table_name||case when tg_op='INSERT' then '.created' else '.updated' end;
  insert into private.staff_push_events(event_type,source_id,section,title,recipient_ids)
   values(kind,n->>'id',section,title,audience);
 end if;
 return new;
end $$;
revoke all on function private.capture_staff_push_event() from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['service_bookings','profiles','customer_bikes','service_vouchers','wheel_spins','prize_draws',
 'orders','ecommerce_orders','counter_sales','marketplace_listings','marketplace_bids','marketplace_auctions',
 'marketplace_transactions','marketplace_stolen_listing_flags','marketplace_messages','bike_donation_requests','reviews','referrals'] loop
  execute format('create trigger staff_native_event after insert or update on public.%I for each row execute function private.capture_staff_push_event()',t);
 end loop;
end $$;

create function public.claim_staff_push_events(p_token text) returns setof private.staff_push_events
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.staff_push_config where dispatch_token=p_token) then raise exception 'Invalid dispatch token' using errcode='42501'; end if;
 return query with due as (
  select id from private.staff_push_events where status in('pending','retry') and next_attempt_at<=now()
   and (lease_until is null or lease_until<now()) and attempts<12 order by created_at for update skip locked limit 8
 ) update private.staff_push_events e set attempts=e.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes'
 from due where e.id=due.id returning e.*;
end $$;
create function public.finish_staff_push_event(p_id uuid,p_lease uuid,p_status text,p_message_id text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in('accepted','retry','skipped') then raise exception 'Invalid outcome'; end if;
 update private.staff_push_events set
  status=case when p_status='retry' and attempts>=12 then 'failed' else p_status end,
  provider_message_id=p_message_id,last_error=nullif(left(p_reason,300),''),
  accepted_at=case when p_status='accepted' then now() else null end,
  next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,7))::int)),lease_until=null,lease_id=null
 where id=p_id and lease_id=p_lease and status in('pending','retry');
end $$;
revoke all on function public.claim_staff_push_events(text),public.finish_staff_push_event(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_staff_push_events(text),public.finish_staff_push_event(uuid,uuid,text,text,text) to service_role;

create function private.dispatch_staff_push_events() returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Recover a worker that crashed after claiming its final attempt.
 update private.staff_push_events set status='failed',last_error='Worker lease expired after final attempt'
 where status in('pending','retry') and attempts>=12 and lease_until<now();
 if not exists(select 1 from private.staff_push_events where status in('pending','retry') and next_attempt_at<=now()
  and (lease_until is null or lease_until<now()) and attempts<12) then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-stakeys-dispatch-token',dispatch_token),
  body:='{}'::jsonb,timeout_milliseconds:=150000) from private.staff_push_config;
end $$;
revoke all on function private.dispatch_staff_push_events() from public,anon,authenticated;
select cron.schedule('stakeys-staff-native-events','* * * * *','select private.dispatch_staff_push_events()');
