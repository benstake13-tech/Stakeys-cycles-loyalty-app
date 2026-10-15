create or replace function public.reserve_marketplace_agreed_transaction(p_conversation_id uuid, p_buyer_id uuid)
returns public.marketplace_transactions language plpgsql security definer set search_path = '' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype; v_listing public.marketplace_listings%rowtype; v_tx public.marketplace_transactions%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_buyer_id then raise exception 'Buyer session does not match'; end if;
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or v_c.buyer_id<>p_buyer_id then raise exception 'Marketplace conversation not found'; end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.agreed_price is null or v_d.buyer_location_confirmed_at is null or v_d.seller_location_confirmed_at is null then
    raise exception 'Both parties must agree on the price and handover location first';
  end if;
  select * into v_listing from public.marketplace_listings where id=v_c.listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer available'; end if;
  update public.marketplace_transactions set payment_status='cancelled'
    where listing_id=v_listing.id and payment_status='pending' and created_at<now()-interval '1 hour';
  if exists(select 1 from public.marketplace_transactions where listing_id=v_listing.id and payment_status in ('pending','completed')) then
    raise exception 'This listing already has an active checkout';
  end if;
  insert into public.marketplace_transactions(listing_id,buyer_id,seller_id,gross_amount,commission_rate_bps)
    values(v_listing.id,p_buyer_id,v_c.seller_id,v_d.agreed_price,2000) returning * into v_tx;
  return v_tx;
end;
$$;
revoke all on function public.reserve_marketplace_agreed_transaction(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_marketplace_agreed_transaction(uuid,uuid) to service_role;
