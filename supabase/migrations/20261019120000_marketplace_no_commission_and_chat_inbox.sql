-- Marketplace sales are peer-to-peer: Stakey's does not take a per-sale commission.
-- Preserve completed historical ledger entries, but remove fees from pending and new sales.
alter table public.marketplace_transactions
  alter column commission_rate_bps set default 0;

update public.marketplace_transactions
set commission_rate_bps = 0
where payment_status = 'pending'
  and commission_rate_bps <> 0;

create or replace function public.reserve_marketplace_transaction(p_listing_id uuid,p_buyer_id uuid)
returns public.marketplace_transactions language plpgsql security definer set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype; v_tx public.marketplace_transactions%rowtype;
begin
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer available'; end if;
  if exists(select 1 from public.marketplace_auctions where listing_id=p_listing_id) then
    raise exception 'Auction bikes require the winning bid checkout';
  end if;
  if v_listing.seller_id=p_buyer_id then raise exception 'You cannot buy your own listing'; end if;
  update public.marketplace_transactions set payment_status='cancelled'
    where listing_id=p_listing_id and payment_status='pending' and created_at<now()-interval '1 hour';
  if exists(select 1 from public.marketplace_transactions
    where listing_id=p_listing_id and payment_status in ('pending','completed')) then
    raise exception 'This listing already has an active checkout';
  end if;
  insert into public.marketplace_transactions(listing_id,buyer_id,seller_id,gross_amount,commission_rate_bps)
    values(p_listing_id,p_buyer_id,v_listing.seller_id,v_listing.asking_price,0) returning * into v_tx;
  return v_tx;
end;
$$;
revoke all on function public.reserve_marketplace_transaction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_marketplace_transaction(uuid,uuid) to service_role;

create or replace function public.reserve_marketplace_agreed_transaction(p_conversation_id uuid,p_buyer_id uuid)
returns public.marketplace_transactions language plpgsql security definer set search_path='' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype;
  v_listing public.marketplace_listings%rowtype; v_tx public.marketplace_transactions%rowtype;
  v_a public.marketplace_auctions%rowtype; v_bid public.marketplace_bids%rowtype;
begin
  if auth.uid() is not null and auth.uid()<>p_buyer_id then raise exception 'Buyer session does not match'; end if;
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or v_c.buyer_id<>p_buyer_id then raise exception 'Marketplace conversation not found'; end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.agreed_price is null or v_d.buyer_location_confirmed_at is null
    or v_d.seller_location_confirmed_at is null then
    raise exception 'Both parties must agree on the price and handover location first';
  end if;
  select * into v_listing from public.marketplace_listings where id=v_c.listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer available'; end if;
  select * into v_a from public.marketplace_auctions where listing_id=v_listing.id;
  if found then
    select * into v_bid from public.marketplace_bids where id=v_a.winning_bid_id;
    if v_a.status<>'ended' or not found or v_bid.bidder_id<>p_buyer_id
      or v_d.agreed_price<>v_bid.amount then
      raise exception 'Only the winning bidder may pay the winning amount';
    end if;
  end if;
  update public.marketplace_transactions set payment_status='cancelled'
    where listing_id=v_listing.id and payment_status='pending' and created_at<now()-interval '1 hour';
  if exists(select 1 from public.marketplace_transactions
    where listing_id=v_listing.id and payment_status in ('pending','completed')) then
    raise exception 'This listing already has an active checkout';
  end if;
  insert into public.marketplace_transactions(listing_id,buyer_id,seller_id,gross_amount,commission_rate_bps)
    values(v_listing.id,p_buyer_id,v_c.seller_id,v_d.agreed_price,0) returning * into v_tx;
  return v_tx;
end;
$$;
revoke all on function public.reserve_marketplace_agreed_transaction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_marketplace_agreed_transaction(uuid,uuid) to service_role;

-- Keep inbox ordering useful: a new message makes its conversation the most recent.
create or replace function private.touch_marketplace_conversation_on_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.marketplace_conversations
    set updated_at = greatest(now(), updated_at + interval '1 microsecond')
    where id = new.conversation_id;
  return new;
end;
$$;
revoke all on function private.touch_marketplace_conversation_on_message() from public, anon, authenticated;
drop trigger if exists marketplace_message_bump_conversation on public.marketplace_messages;
create trigger marketplace_message_bump_conversation
  after insert on public.marketplace_messages
  for each row execute function private.touch_marketplace_conversation_on_message();
