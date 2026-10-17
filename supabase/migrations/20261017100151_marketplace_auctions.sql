-- Auction listings retain the marketplace's existing seller verification,
-- serial check, moderation and payment ledger. Bids are append-only.
create table public.marketplace_auctions (
  listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete restrict,
  start_price numeric(10,2) not null check (start_price between 1 and 50000),
  duration_hours integer not null check (duration_hours in (24,72,168)),
  status text not null default 'pending' check (status in ('pending','live','ended','no_sale','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  highest_bid numeric(10,2),
  bid_count integer not null default 0 check (bid_count >= 0),
  extension_count integer not null default 0 check (extension_count between 0 and 5),
  winning_bid_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (highest_bid is null or highest_bid >= start_price),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at > starts_at))
);
create index marketplace_auctions_ending_idx on public.marketplace_auctions(ends_at)
  where status='live';

create table public.marketplace_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_auctions(listing_id) on delete restrict,
  bidder_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(10,2) not null check (amount between 1 and 50000),
  created_at timestamptz not null default now()
);
create index marketplace_bids_listing_amount_idx on public.marketplace_bids(listing_id,amount desc,created_at);
create index marketplace_bids_bidder_idx on public.marketplace_bids(bidder_id,created_at desc);
alter table public.marketplace_auctions
  add constraint marketplace_auctions_winning_bid_fk
  foreign key (winning_bid_id) references public.marketplace_bids(id) on delete restrict;

alter table public.marketplace_auctions enable row level security;
alter table public.marketplace_bids enable row level security;
create policy marketplace_auctions_browse on public.marketplace_auctions
  for select to anon,authenticated using (
    exists(select 1 from public.marketplace_listings l
      where l.id=listing_id and l.status='active')
  );
create policy marketplace_auctions_seller on public.marketplace_auctions
  for select to authenticated using (seller_id=(select auth.uid()));
create policy marketplace_auctions_staff on public.marketplace_auctions
  for select to authenticated using (exists(
    select 1 from public.profiles p where p.id::text=(select auth.uid())::text and p.role in ('staff','admin')
  ));
create policy marketplace_bids_own on public.marketplace_bids
  for select to authenticated using (bidder_id=(select auth.uid()));
create policy marketplace_bids_seller_after_close on public.marketplace_bids
  for select to authenticated using (exists(
    select 1 from public.marketplace_auctions a
    where a.listing_id=marketplace_bids.listing_id and a.seller_id=(select auth.uid()) and a.status='ended'
  ));
create policy marketplace_bids_staff on public.marketplace_bids
  for select to authenticated using (exists(
    select 1 from public.profiles p where p.id::text=(select auth.uid())::text and p.role in ('staff','admin')
  ));
revoke all on public.marketplace_auctions,public.marketplace_bids from public,anon,authenticated;
grant select (listing_id,start_price,duration_hours,status,starts_at,ends_at,highest_bid,bid_count,extension_count,winning_bid_id)
  on public.marketplace_auctions to anon,authenticated;
grant select (id,listing_id,bidder_id,amount,created_at) on public.marketplace_bids to authenticated;
grant all on public.marketplace_auctions,public.marketplace_bids to service_role;

-- Only the verified listing Edge Function can configure an auction, and only
-- before staff approves the listing. Staff approval starts the clock.
create or replace function public.configure_marketplace_auction(
  p_listing_id uuid,p_seller_id uuid,p_start_price numeric,p_duration_hours integer
) returns void language plpgsql security invoker set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype;
begin
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  if not found or v_listing.seller_id<>p_seller_id or v_listing.status not in ('pending_approval','pending_review') then
    raise exception 'Auction must be configured before staff approval';
  end if;
  if p_start_price is null or p_start_price<1 or p_start_price>50000
    or p_duration_hours not in (24,72,168) then
    raise exception 'Choose a valid opening bid and auction duration';
  end if;
  insert into public.marketplace_auctions(listing_id,seller_id,start_price,duration_hours)
    values(p_listing_id,p_seller_id,round(p_start_price,2),p_duration_hours);
end;
$$;
revoke all on function public.configure_marketplace_auction(uuid,uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.configure_marketplace_auction(uuid,uuid,numeric,integer) to service_role;

create or replace function public.marketplace_auction_listing_transition()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status then
    if new.status='active' then
      update public.marketplace_auctions
        set status='live',starts_at=now(),ends_at=now()+duration_hours*interval '1 hour',updated_at=now()
        where listing_id=new.id and status='pending';
    elsif new.status in ('cancelled','rejected') then
      update public.marketplace_auctions set status='cancelled',updated_at=now()
        where listing_id=new.id and status in ('pending','live');
    end if;
  end if;
  return new;
end;
$$;
create trigger marketplace_auction_listing_transition
after update of status on public.marketplace_listings
for each row execute function public.marketplace_auction_listing_transition();

-- Prevent edits, direct sale and manual "mark sold" while bidding is live.
create or replace function public.marketplace_auction_listing_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.marketplace_auctions a where a.listing_id=old.id and a.status='live')
    and new.status not in ('active','cancelled','rejected') then
    raise exception 'Settle or cancel the auction before changing the listing';
  end if;
  if exists(select 1 from public.marketplace_auctions a where a.listing_id=old.id and a.status='live')
    and (new.title,new.category,new.make_model,new.condition,new.description,new.asking_price,new.images)
      is distinct from (old.title,old.category,old.make_model,old.condition,old.description,old.asking_price,old.images) then
    raise exception 'A live auction cannot be edited';
  end if;
  return new;
end;
$$;
create trigger marketplace_auction_listing_guard
before update on public.marketplace_listings
for each row execute function public.marketplace_auction_listing_guard();

-- Called by the authenticated auction Edge Function using service_role.
-- Locking the listing then auction serialises bids with moderation and close.
create or replace function public.place_marketplace_bid(
  p_listing_id uuid,p_bidder_id uuid,p_amount numeric
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype; v_a public.marketplace_auctions%rowtype;
  v_bid uuid; v_min numeric(10,2); v_end timestamptz;
begin
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  select * into v_a from public.marketplace_auctions where listing_id=p_listing_id for update;
  if not found or v_listing.status<>'active' or v_a.status<>'live' or v_a.ends_at<=now() then
    raise exception 'This auction is no longer accepting bids';
  end if;
  if p_bidder_id=v_listing.seller_id then raise exception 'You cannot bid on your own listing'; end if;
  if not exists(select 1 from auth.users u where u.id=p_bidder_id and u.email_confirmed_at is not null) then
    raise exception 'Verify your email before bidding';
  end if;
  v_min := case when v_a.bid_count=0 then v_a.start_price
    else v_a.highest_bid + greatest(1,ceil(v_a.highest_bid*0.02)) end;
  if p_amount is null or p_amount<>round(p_amount,2) or p_amount<v_min or p_amount>50000 then
    raise exception 'Bid must be at least % and no more than £50,000',v_min;
  end if;
  insert into public.marketplace_bids(listing_id,bidder_id,amount)
    values(p_listing_id,p_bidder_id,p_amount) returning id into v_bid;
  v_end := v_a.ends_at;
  if v_a.ends_at-now() < interval '2 minutes' and v_a.extension_count<5 then
    v_end := v_a.ends_at+interval '2 minutes';
  end if;
  update public.marketplace_auctions set highest_bid=p_amount,bid_count=bid_count+1,
    ends_at=v_end,extension_count=extension_count+case when v_end>v_a.ends_at then 1 else 0 end,
    updated_at=now() where listing_id=p_listing_id;
  return jsonb_build_object('bid_id',v_bid,'highest_bid',p_amount,'next_minimum',
    p_amount+greatest(1,ceil(p_amount*0.02)),'ends_at',v_end);
end;
$$;
revoke all on function public.place_marketplace_bid(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.place_marketplace_bid(uuid,uuid,numeric) to service_role;

-- Ended auctions create the same private agreement used by fixed-price deals.
-- The winner and seller then confirm a handover before any checkout is made.
create or replace function public.finalize_marketplace_auction(p_listing_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype; v_a public.marketplace_auctions%rowtype;
  v_top public.marketplace_bids%rowtype; v_conversation uuid;
begin
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  select * into v_a from public.marketplace_auctions where listing_id=p_listing_id for update;
  if not found then raise exception 'Auction not found'; end if;
  if v_a.status<>'live' or v_a.ends_at>now() then
    return jsonb_build_object('status',v_a.status,'ends_at',v_a.ends_at);
  end if;
  select * into v_top from public.marketplace_bids where listing_id=p_listing_id
    order by amount desc,created_at,id limit 1;
  if not found then
    update public.marketplace_auctions set status='no_sale',updated_at=now() where listing_id=p_listing_id;
    update public.marketplace_listings set status='cancelled' where id=p_listing_id;
    return jsonb_build_object('status','no_sale');
  end if;
  update public.marketplace_auctions set status='ended',winning_bid_id=v_top.id,updated_at=now()
    where listing_id=p_listing_id;
  insert into public.marketplace_conversations(listing_id,buyer_id,seller_id)
    values(p_listing_id,v_top.bidder_id,v_listing.seller_id)
    on conflict(listing_id,buyer_id) do update set updated_at=now()
    returning id into v_conversation;
  insert into public.marketplace_deal_terms(
    conversation_id,proposed_price,proposed_by,agreed_price,accepted_by,agreed_at
  ) values(
    v_conversation,v_top.amount,v_listing.seller_id,v_top.amount,v_top.bidder_id,now()
  ) on conflict(conversation_id) do update set
    proposed_price=excluded.proposed_price,proposed_by=excluded.proposed_by,
    agreed_price=excluded.agreed_price,accepted_by=excluded.accepted_by,agreed_at=excluded.agreed_at,
    location_method=null,location_details=null,location_set_by=null,
    buyer_location_confirmed_at=null,seller_location_confirmed_at=null,updated_at=now();
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
    values(p_listing_id,v_top.bidder_id,'auction_ended',
      jsonb_build_object('winning_bid',v_top.amount,'bid_count',v_a.bid_count));
  return jsonb_build_object('status','ended','winning_bid_id',v_top.id);
end;
$$;
revoke all on function public.finalize_marketplace_auction(uuid) from public,anon,authenticated;
grant execute on function public.finalize_marketplace_auction(uuid) to service_role;

create or replace function public.finalize_expired_marketplace_auctions()
returns integer language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_count integer := 0;
begin
  for v_id in select listing_id from public.marketplace_auctions
    where status='live' and ends_at<=now() order by ends_at limit 100
  loop
    perform public.finalize_marketplace_auction(v_id);
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.finalize_expired_marketplace_auctions() from public,anon,authenticated;
grant execute on function public.finalize_expired_marketplace_auctions() to service_role;

-- The job runs in the database, including when no customer has the app open.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('stakeys-marketplace-auction-close','* * * * *',
  'select public.finalize_expired_marketplace_auctions()');
