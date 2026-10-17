-- Private, durable marketplace case file. The record keeps the latest bike
-- snapshot; the event rows preserve what was known at each transition.
-- No FK to listings/accounts: an archive or later account removal must not
-- silently erase the sale/auction record.
create table public.marketplace_records (
  listing_id uuid primary key,
  seller_id uuid not null,
  seller_snapshot jsonb not null,
  bike_snapshot jsonb not null,
  sale_mode text not null check (sale_mode in ('fixed','auction')),
  listing_status text not null,
  listing_created_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketplace_records_recent_idx on public.marketplace_records(updated_at desc);

create table public.marketplace_record_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.marketplace_records(listing_id) on delete restrict,
  event_type text not null,
  actor_id uuid,
  people jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  bike_snapshot jsonb,
  occurred_at timestamptz not null default now()
);
create index marketplace_record_events_listing_idx
  on public.marketplace_record_events(listing_id,occurred_at desc,id desc);

alter table public.marketplace_records enable row level security;
alter table public.marketplace_record_events enable row level security;
create policy marketplace_records_staff_read on public.marketplace_records
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('staff','admin')
  ));
create policy marketplace_record_events_staff_read on public.marketplace_record_events
  for select to authenticated using (exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('staff','admin')
  ));
revoke all on public.marketplace_records,public.marketplace_record_events from public,anon,authenticated;
grant select on public.marketplace_records,public.marketplace_record_events to authenticated;
grant all on public.marketplace_records,public.marketplace_record_events to service_role;

create or replace function private.marketplace_record_party(p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',p_user_id,
    'name',p.display_name,
    'email',coalesce(u.email,p.email),
    'phone',p.phone
  ) from (select p_user_id as id) x
  left join public.profiles p on p.id=x.id
  left join auth.users u on u.id=x.id;
$$;
revoke all on function private.marketplace_record_party(uuid) from public,anon,authenticated;

create or replace function private.marketplace_record_bike(p_listing_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',l.id,'title',l.title,'category',l.category,'subcategory',l.subcategory,
    'make_model',l.make_model,'condition',l.condition,'description',l.description,
    'asking_price',l.asking_price,'image_paths',l.images,
    'ai_inspection',l.ai_inspection,'frame_serial',s.frame_serial_number,
    'serial_check_status',s.check_status,'serial_checked_at',s.checked_at,
    'serial_photo_path',s.serial_number_photo_path
  ) from public.marketplace_listings l
  left join public.marketplace_serial_checks s on s.listing_id=l.id
  where l.id=p_listing_id;
$$;
revoke all on function private.marketplace_record_bike(uuid) from public,anon,authenticated;

create or replace function private.marketplace_record_listing_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_bike jsonb; v_type text;
begin
  v_bike := private.marketplace_record_bike(new.id);
  insert into public.marketplace_records(
    listing_id,seller_id,seller_snapshot,bike_snapshot,sale_mode,listing_status,listing_created_at
  ) values (
    new.id,new.seller_id,private.marketplace_record_party(new.seller_id),v_bike,'fixed',new.status,new.created_at
  ) on conflict(listing_id) do update set
    bike_snapshot=excluded.bike_snapshot,listing_status=excluded.listing_status,updated_at=now();
  if tg_op='INSERT' then
    v_type := 'listing_submitted';
  elsif old.status is distinct from new.status then
    v_type := 'listing_status_changed';
  elsif (old.title,old.category,old.subcategory,old.make_model,old.condition,old.description,old.asking_price,old.images,old.ai_inspection)
    is distinct from (new.title,new.category,new.subcategory,new.make_model,new.condition,new.description,new.asking_price,new.images,new.ai_inspection) then
    v_type := 'listing_edited';
  else
    return new;
  end if;
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
  values(new.id,v_type,auth.uid(),jsonb_build_object('seller',private.marketplace_record_party(new.seller_id)),
    jsonb_build_object('status',new.status,'previous_status',case when tg_op='UPDATE' then old.status else null end),v_bike);
  return new;
end;
$$;
revoke all on function private.marketplace_record_listing_change() from public,anon,authenticated;
create trigger marketplace_record_listing_change after insert or update on public.marketplace_listings
for each row execute function private.marketplace_record_listing_change();

create or replace function private.marketplace_record_serial_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_bike jsonb;
begin
  v_bike := private.marketplace_record_bike(new.listing_id);
  update public.marketplace_records set bike_snapshot=v_bike,updated_at=now()
    where listing_id=new.listing_id;
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
  values(new.listing_id,'serial_checked',auth.uid(),
    jsonb_build_object('seller',private.marketplace_record_party(new.seller_id)),
    jsonb_build_object('check_status',new.check_status,'matched_stolen_records',new.matched_stolen_records),v_bike);
  return new;
end;
$$;
revoke all on function private.marketplace_record_serial_change() from public,anon,authenticated;
create trigger marketplace_record_serial_change after insert or update on public.marketplace_serial_checks
for each row execute function private.marketplace_record_serial_change();

create or replace function private.marketplace_record_auction_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text; v_winner uuid; v_bike jsonb;
begin
  if tg_op='INSERT' then v_type := 'auction_submitted';
  elsif old.status is distinct from new.status then v_type := 'auction_'||new.status;
  elsif old.ends_at is distinct from new.ends_at then v_type := 'auction_extended';
  else return new;
  end if;
  update public.marketplace_records set sale_mode='auction',updated_at=now()
    where listing_id=new.listing_id;
  if new.winning_bid_id is not null then
    select bidder_id into v_winner from public.marketplace_bids where id=new.winning_bid_id;
  end if;
  v_bike := private.marketplace_record_bike(new.listing_id);
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
  values(new.listing_id,v_type,auth.uid(),
    jsonb_build_object('seller',private.marketplace_record_party(new.seller_id),
      'winner',case when v_winner is not null then private.marketplace_record_party(v_winner) else null end),
    jsonb_build_object('opening_price',new.start_price,'duration_hours',new.duration_hours,
      'status',new.status,'starts_at',new.starts_at,'ends_at',new.ends_at,
      'highest_bid',new.highest_bid,'bid_count',new.bid_count,
      'winning_bid_id',new.winning_bid_id,'extension_count',new.extension_count),v_bike);
  return new;
end;
$$;
revoke all on function private.marketplace_record_auction_change() from public,anon,authenticated;
create trigger marketplace_record_auction_change after insert or update on public.marketplace_auctions
for each row execute function private.marketplace_record_auction_change();

create or replace function private.marketplace_record_bid_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_seller uuid;
begin
  select seller_id into v_seller from public.marketplace_auctions where listing_id=new.listing_id;
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,occurred_at)
  values(new.listing_id,'bid_placed',new.bidder_id,
    jsonb_build_object('seller',private.marketplace_record_party(v_seller),
      'bidder',private.marketplace_record_party(new.bidder_id)),
    jsonb_build_object('bid_id',new.id,'amount',new.amount),new.created_at);
  update public.marketplace_records set updated_at=now() where listing_id=new.listing_id;
  return new;
end;
$$;
revoke all on function private.marketplace_record_bid_change() from public,anon,authenticated;
create trigger marketplace_record_bid_change after insert on public.marketplace_bids
for each row execute function private.marketplace_record_bid_change();

create or replace function private.marketplace_record_transaction_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text;
begin
  if tg_op='INSERT' then v_type := 'checkout_reserved';
  elsif old.payment_status is distinct from new.payment_status then
    v_type := case when new.payment_status='completed' then 'sale_completed'
      when new.payment_status='refunded' then 'payment_refunded'
      else 'payment_'||new.payment_status end;
  elsif old.payout_status is distinct from new.payout_status then
    v_type := 'payout_'||new.payout_status;
  elsif old.sumup_checkout_id is distinct from new.sumup_checkout_id then
    v_type := 'checkout_created';
  else return new;
  end if;
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
  values(new.listing_id,v_type,auth.uid(),
    jsonb_build_object('seller',private.marketplace_record_party(new.seller_id),
      'buyer',private.marketplace_record_party(new.buyer_id)),
    jsonb_build_object('transaction_id',new.id,'gross_amount',new.gross_amount,
      'commission_amount',new.commission_amount,'seller_payable',new.seller_payable,
      'payment_status',new.payment_status,'payout_status',new.payout_status,
      'sumup_checkout_id',new.sumup_checkout_id,'sumup_transaction_id',new.sumup_transaction_id,
      'payout_reference',new.payout_reference,'payout_paid_at',new.payout_paid_at,
      'completed_at',new.completed_at),private.marketplace_record_bike(new.listing_id));
  update public.marketplace_records set updated_at=now() where listing_id=new.listing_id;
  return new;
end;
$$;
revoke all on function private.marketplace_record_transaction_change() from public,anon,authenticated;
create trigger marketplace_record_transaction_change after insert or update on public.marketplace_transactions
for each row execute function private.marketplace_record_transaction_change();

create or replace function private.marketplace_record_event_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'Marketplace record events are append-only';
end;
$$;
revoke all on function private.marketplace_record_event_immutable() from public,anon,authenticated;
create trigger marketplace_record_events_immutable before update or delete on public.marketplace_record_events
for each row execute function private.marketplace_record_event_immutable();

-- A staff-recorded offline sale needs a named buyer and actual amount. This
-- records the event without claiming that SumUp took or verified a payment.
create or replace function public.record_marketplace_manual_sale(
  p_listing_id uuid,p_buyer_name text,p_buyer_contact text,p_amount numeric,p_note text
) returns void language plpgsql security definer set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin')
  ) then raise exception 'Staff access required'; end if;
  if char_length(btrim(coalesce(p_buyer_name,''))) not between 2 and 120
    or char_length(btrim(coalesce(p_buyer_contact,''))) not between 3 and 200
    or p_amount is null or p_amount<>round(p_amount,2) or p_amount<=0 or p_amount>50000
    or char_length(coalesce(p_note,''))>500 then
    raise exception 'Enter the buyer, contact details and actual sale amount';
  end if;
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer active'; end if;
  if exists(select 1 from public.marketplace_auctions where listing_id=p_listing_id)
    or exists(select 1 from public.marketplace_transactions where listing_id=p_listing_id and payment_status in ('pending','completed')) then
    raise exception 'An auction or active checkout must use its own sale record';
  end if;
  insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
  values(p_listing_id,'manual_sale_recorded',auth.uid(),
    jsonb_build_object('seller',private.marketplace_record_party(v_listing.seller_id),
      'buyer',jsonb_build_object('name',btrim(p_buyer_name),'contact',btrim(p_buyer_contact))),
    jsonb_build_object('amount',p_amount,'payment_status','recorded_offline_unverified',
      'note',btrim(coalesce(p_note,''))),private.marketplace_record_bike(p_listing_id));
  update public.marketplace_listings set status='sold' where id=p_listing_id;
end;
$$;
revoke all on function public.record_marketplace_manual_sale(uuid,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_marketplace_manual_sale(uuid,text,text,numeric,text) to authenticated;

create or replace function private.marketplace_require_sale_record()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and new.status='sold'
    and not exists(select 1 from public.marketplace_transactions t
      where t.listing_id=new.id and t.payment_status='completed')
    and not exists(select 1 from public.marketplace_record_events e
      where e.listing_id=new.id and e.event_type='manual_sale_recorded'
        and e.occurred_at>=old.updated_at) then
    raise exception 'Record the buyer and sale details before marking this listing sold';
  end if;
  return new;
end;
$$;
revoke all on function private.marketplace_require_sale_record() from public,anon,authenticated;
create trigger marketplace_require_sale_record before update of status on public.marketplace_listings
for each row execute function private.marketplace_require_sale_record();

-- Existing data is imported as a point-in-time snapshot; import events do not
-- claim that the people/contact details were captured at an earlier date.
insert into public.marketplace_records(
  listing_id,seller_id,seller_snapshot,bike_snapshot,sale_mode,listing_status,listing_created_at
)
select l.id,l.seller_id,private.marketplace_record_party(l.seller_id),
  private.marketplace_record_bike(l.id),case when a.listing_id is null then 'fixed' else 'auction' end,
  l.status,l.created_at
from public.marketplace_listings l
left join public.marketplace_auctions a on a.listing_id=l.id
on conflict(listing_id) do nothing;

insert into public.marketplace_record_events(listing_id,event_type,people,details,bike_snapshot)
select l.id,'listing_imported',jsonb_build_object('seller',private.marketplace_record_party(l.seller_id)),
  jsonb_build_object('current_status',l.status,'listing_created_at',l.created_at,'historical_import',true),
  private.marketplace_record_bike(l.id)
from public.marketplace_listings l;

insert into public.marketplace_record_events(listing_id,event_type,people,details,bike_snapshot)
select a.listing_id,'auction_imported',
  jsonb_build_object('seller',private.marketplace_record_party(a.seller_id),
    'winner',case when b.bidder_id is not null then private.marketplace_record_party(b.bidder_id) else null end),
  jsonb_build_object('opening_price',a.start_price,'duration_hours',a.duration_hours,
    'status',a.status,'starts_at',a.starts_at,'ends_at',a.ends_at,
    'highest_bid',a.highest_bid,'bid_count',a.bid_count,'winning_bid_id',a.winning_bid_id,
    'historical_import',true),private.marketplace_record_bike(a.listing_id)
from public.marketplace_auctions a left join public.marketplace_bids b on b.id=a.winning_bid_id;

insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,occurred_at)
select b.listing_id,'bid_imported',b.bidder_id,
  jsonb_build_object('bidder',private.marketplace_record_party(b.bidder_id)),
  jsonb_build_object('bid_id',b.id,'amount',b.amount,'historical_import',true),b.created_at
from public.marketplace_bids b;

insert into public.marketplace_record_events(listing_id,event_type,people,details,bike_snapshot)
select t.listing_id,'transaction_imported',
  jsonb_build_object('seller',private.marketplace_record_party(t.seller_id),
    'buyer',private.marketplace_record_party(t.buyer_id)),
  jsonb_build_object('transaction_id',t.id,'gross_amount',t.gross_amount,
    'commission_amount',t.commission_amount,'seller_payable',t.seller_payable,
    'payment_status',t.payment_status,'payout_status',t.payout_status,
    'sumup_transaction_id',t.sumup_transaction_id,'payout_reference',t.payout_reference,
    'completed_at',t.completed_at,'historical_import',true),
  private.marketplace_record_bike(t.listing_id)
from public.marketplace_transactions t;
