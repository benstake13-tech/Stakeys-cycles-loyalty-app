create table if not exists public.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_messages_conversation_created_idx
  on public.marketplace_messages(conversation_id, created_at);

create table if not exists public.marketplace_deal_terms (
  conversation_id uuid primary key references public.marketplace_conversations(id) on delete cascade,
  proposed_price numeric(10,2) not null check (proposed_price > 0 and proposed_price <= 50000),
  proposed_by uuid not null references auth.users(id),
  agreed_price numeric(10,2),
  accepted_by uuid references auth.users(id),
  agreed_at timestamptz,
  location_method text check (location_method in ('whatsapp','manual')),
  location_details text,
  location_set_by uuid references auth.users(id),
  buyer_location_confirmed_at timestamptz,
  seller_location_confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((agreed_price is null and accepted_by is null and agreed_at is null) or
         (agreed_price is not null and accepted_by is not null and agreed_at is not null)),
  check ((location_method is null and location_details is null and location_set_by is null) or
         (location_method is not null and location_details is not null and location_set_by is not null and agreed_price is not null))
);

alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;
alter table public.marketplace_deal_terms enable row level security;
revoke all on public.marketplace_conversations, public.marketplace_messages, public.marketplace_deal_terms from public, anon;
grant select on public.marketplace_conversations, public.marketplace_messages, public.marketplace_deal_terms to authenticated;
grant insert on public.marketplace_messages to authenticated;

create policy marketplace_conversations_participants_read on public.marketplace_conversations
  for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy marketplace_conversations_buyer_start on public.marketplace_conversations
  for insert to authenticated with check (
    buyer_id = auth.uid() and exists (
      select 1 from public.marketplace_listings l
      where l.id = listing_id and l.seller_id = seller_id and l.seller_id <> auth.uid() and l.status = 'active'
    )
  );
create policy marketplace_messages_participants_read on public.marketplace_messages
  for select to authenticated using (exists (
    select 1 from public.marketplace_conversations c
    where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  ));
create policy marketplace_messages_participants_send on public.marketplace_messages
  for insert to authenticated with check (sender_id = auth.uid() and exists (
    select 1 from public.marketplace_conversations c
    where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  ));
create policy marketplace_deals_participants_read on public.marketplace_deal_terms
  for select to authenticated using (exists (
    select 1 from public.marketplace_conversations c
    where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  ));

create or replace function public.start_marketplace_conversation(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_seller uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to message a seller'; end if;
  select l.seller_id into v_seller from public.marketplace_listings l
    where l.id=p_listing_id and l.status='active';
  if v_seller is null then raise exception 'This listing is no longer available'; end if;
  if v_seller=auth.uid() then raise exception 'You cannot message yourself'; end if;
  insert into public.marketplace_conversations(listing_id,buyer_id,seller_id)
    values(p_listing_id,auth.uid(),v_seller)
    on conflict(listing_id,buyer_id) do update set updated_at=now()
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.propose_marketplace_price(p_conversation_id uuid, p_price numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.marketplace_conversations%rowtype;
begin
  if auth.uid() is null or p_price is null or p_price <= 0 or p_price > 50000 then raise exception 'Enter a valid price'; end if;
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  insert into public.marketplace_deal_terms(conversation_id,proposed_price,proposed_by)
    values(p_conversation_id,round(p_price,2),auth.uid())
    on conflict(conversation_id) do update set proposed_price=round(p_price,2), proposed_by=auth.uid(),
      agreed_price=null, accepted_by=null, agreed_at=null, location_method=null, location_details=null,
      location_set_by=null, buyer_location_confirmed_at=null, seller_location_confirmed_at=null, updated_at=now();
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;

create or replace function public.accept_marketplace_price(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype;
begin
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.proposed_by=auth.uid() then raise exception 'Only the other party can accept this price'; end if;
  update public.marketplace_deal_terms set agreed_price=proposed_price, accepted_by=auth.uid(), agreed_at=now(), updated_at=now()
    where conversation_id=p_conversation_id;
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;

create or replace function public.set_marketplace_handover_location(p_conversation_id uuid, p_method text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype;
begin
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.agreed_price is null then raise exception 'Both parties must agree on a price first'; end if;
  if p_method not in ('whatsapp','manual') then raise exception 'Choose WhatsApp or a manual location'; end if;
  if char_length(trim(coalesce(p_details,''))) < 3 or char_length(trim(p_details)) > 500 then raise exception 'Enter a valid meeting location or note'; end if;
  update public.marketplace_deal_terms set location_method=p_method, location_details=trim(p_details), location_set_by=auth.uid(),
    buyer_location_confirmed_at=case when auth.uid()=v_c.buyer_id then now() else null end,
    seller_location_confirmed_at=case when auth.uid()=v_c.seller_id then now() else null end, updated_at=now()
    where conversation_id=p_conversation_id;
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;

create or replace function public.confirm_marketplace_handover_location(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.marketplace_conversations%rowtype; v_d public.marketplace_deal_terms%rowtype;
begin
  select * into v_c from public.marketplace_conversations where id=p_conversation_id for update;
  if not found or auth.uid() not in (v_c.buyer_id,v_c.seller_id) then raise exception 'Conversation not found'; end if;
  select * into v_d from public.marketplace_deal_terms where conversation_id=p_conversation_id for update;
  if not found or v_d.agreed_price is null or v_d.location_method is null then raise exception 'Agree on a price and location first'; end if;
  if auth.uid()=v_c.buyer_id then
    update public.marketplace_deal_terms set buyer_location_confirmed_at=now(),updated_at=now() where conversation_id=p_conversation_id;
  else
    update public.marketplace_deal_terms set seller_location_confirmed_at=now(),updated_at=now() where conversation_id=p_conversation_id;
  end if;
  update public.marketplace_conversations set updated_at=now() where id=p_conversation_id;
end;
$$;

revoke all on function public.start_marketplace_conversation(uuid) from public, anon;
revoke all on function public.propose_marketplace_price(uuid,numeric) from public, anon;
revoke all on function public.accept_marketplace_price(uuid) from public, anon;
revoke all on function public.set_marketplace_handover_location(uuid,text,text) from public, anon;
revoke all on function public.confirm_marketplace_handover_location(uuid) from public, anon;
grant execute on function public.start_marketplace_conversation(uuid) to authenticated;
grant execute on function public.propose_marketplace_price(uuid,numeric) to authenticated;
grant execute on function public.accept_marketplace_price(uuid) to authenticated;
grant execute on function public.set_marketplace_handover_location(uuid,text,text) to authenticated;
grant execute on function public.confirm_marketplace_handover_location(uuid) to authenticated;
