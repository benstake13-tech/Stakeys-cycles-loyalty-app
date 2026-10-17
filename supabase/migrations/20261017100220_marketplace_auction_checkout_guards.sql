-- Direct inserts and legacy RPCs must not bypass bidding on an auction bike.
drop policy if exists marketplace_conversations_buyer_start on public.marketplace_conversations;
create policy marketplace_conversations_buyer_start on public.marketplace_conversations
for insert to authenticated with check (
  buyer_id=(select auth.uid()) and exists(
    select 1 from public.marketplace_listings l
    where l.id=marketplace_conversations.listing_id
      and l.seller_id=marketplace_conversations.seller_id
      and l.seller_id<>(select auth.uid()) and l.status='active'
  )
  and (
    not exists(select 1 from public.marketplace_auctions a where a.listing_id=marketplace_conversations.listing_id)
    or exists(
      select 1 from public.marketplace_auctions a
      join public.marketplace_bids b on b.id=a.winning_bid_id
      where a.listing_id=marketplace_conversations.listing_id
        and a.status='ended' and b.bidder_id=(select auth.uid())
    )
  )
);

create or replace function public.start_marketplace_conversation(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_seller uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to message a seller'; end if;
  select l.seller_id into v_seller from public.marketplace_listings l
    where l.id=p_listing_id and l.status='active';
  if v_seller is null then raise exception 'This listing is no longer available'; end if;
  if v_seller=auth.uid() then raise exception 'You cannot message yourself'; end if;
  if exists(select 1 from public.marketplace_auctions a where a.listing_id=p_listing_id)
    and not exists(
      select 1 from public.marketplace_auctions a
      join public.marketplace_bids b on b.id=a.winning_bid_id
      where a.listing_id=p_listing_id and a.status='ended' and b.bidder_id=auth.uid()
    ) then raise exception 'Only the auction winner can arrange this sale'; end if;
  insert into public.marketplace_conversations(listing_id,buyer_id,seller_id)
    values(p_listing_id,auth.uid(),v_seller)
    on conflict(listing_id,buyer_id) do update set updated_at=now()
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.start_marketplace_conversation(uuid) from public,anon;
grant execute on function public.start_marketplace_conversation(uuid) to authenticated;

create or replace function public.propose_marketplace_price(p_conversation_id uuid,p_price numeric)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.marketplace_conversations%rowtype;
begin
  if auth.uid() is null or p_price is null or p_price<=0 or p_price>50000 then raise exception 'Enter a valid price'; end if;
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  if exists(select 1 from public.marketplace_auctions where listing_id=v_c.listing_id) then
    raise exception 'Auction winning prices cannot be negotiated';
  end if;
  insert into public.marketplace_deal_terms(conversation_id,proposed_price,proposed_by)
    values(p_conversation_id,round(p_price,2),auth.uid())
    on conflict(conversation_id) do update set proposed_price=round(p_price,2),proposed_by=auth.uid(),
      agreed_price=null,accepted_by=null,agreed_at=null,location_method=null,location_details=null,
      location_set_by=null,buyer_location_confirmed_at=null,seller_location_confirmed_at=null,updated_at=now();
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;
revoke all on function public.propose_marketplace_price(uuid,numeric) from public,anon;
grant execute on function public.propose_marketplace_price(uuid,numeric) to authenticated;

create or replace function public.accept_marketplace_price(p_conversation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype;
begin
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  if exists(select 1 from public.marketplace_auctions where listing_id=v_c.listing_id) then
    raise exception 'Auction winning prices cannot be negotiated';
  end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.proposed_by=auth.uid() then raise exception 'Only the other party can accept this price'; end if;
  update public.marketplace_deal_terms set agreed_price=proposed_price,accepted_by=auth.uid(),agreed_at=now(),updated_at=now()
    where conversation_id=p_conversation_id;
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;
revoke all on function public.accept_marketplace_price(uuid) from public,anon;
grant execute on function public.accept_marketplace_price(uuid) to authenticated;

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
    values(p_listing_id,p_buyer_id,v_listing.seller_id,v_listing.asking_price,2000) returning * into v_tx;
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
    values(v_listing.id,p_buyer_id,v_c.seller_id,v_d.agreed_price,2000) returning * into v_tx;
  return v_tx;
end;
$$;
revoke all on function public.reserve_marketplace_agreed_transaction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_marketplace_agreed_transaction(uuid,uuid) to service_role;
