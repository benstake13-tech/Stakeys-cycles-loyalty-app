-- Existing account roles remain the source of truth. This narrow private helper
-- checks only the caller, without granting access to auth.users.
create schema if not exists private;
create or replace function private.marketplace_email_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;
revoke all on function private.marketplace_email_verified() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.marketplace_email_verified() to authenticated;

-- Local peer-to-peer marketplace. Existing public.profiles remains the account
-- source of truth; seller identity and private contact details stay private.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 4 and 120),
  category text not null check (category in ('bicycle','ebike','escooter')),
  make_model text not null check (char_length(make_model) between 2 and 120),
  condition text not null check (condition in ('new','excellent','good','fair','spares')),
  description text not null default '' check (char_length(description) <= 2000),
  asking_price numeric(10,2) not null check (asking_price > 0 and asking_price <= 50000),
  images text[] not null default '{}' check (cardinality(images) <= 5),
  status text not null default 'pending_approval' check (status in ('pending_approval','active','sold','cancelled','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listings_active_idx on public.marketplace_listings(status, created_at desc);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings(seller_id, created_at desc);

create table if not exists public.marketplace_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  gross_amount numeric(10,2) not null check (gross_amount > 0),
  commission_rate_bps integer not null default 2000 check (commission_rate_bps between 0 and 10000),
  commission_amount numeric(10,2) generated always as (round(gross_amount * commission_rate_bps / 10000.0, 2)) stored,
  seller_payable numeric(10,2) generated always as (gross_amount - round(gross_amount * commission_rate_bps / 10000.0, 2)) stored,
  sumup_checkout_id text unique,
  sumup_transaction_id text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending','completed','refunded','cancelled')),
  payout_status text not null default 'not_due' check (payout_status in ('not_due','due','processing','paid','held')),
  payout_reference text,
  payout_paid_at timestamptz,
  payout_paid_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint marketplace_buyer_not_seller check (buyer_id <> seller_id)
);
create index if not exists marketplace_transactions_seller_idx on public.marketplace_transactions(seller_id, created_at desc);
create unique index if not exists marketplace_one_open_sale_per_listing on public.marketplace_transactions(listing_id)
  where payment_status in ('pending','completed');

create table if not exists public.marketplace_audit_log (
  id bigint generated always as identity primary key,
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_transactions enable row level security;
alter table public.marketplace_audit_log enable row level security;

drop policy if exists marketplace_public_browse on public.marketplace_listings;
create policy marketplace_public_browse on public.marketplace_listings for select to anon, authenticated using (status = 'active');
drop policy if exists marketplace_seller_read on public.marketplace_listings;
create policy marketplace_seller_read on public.marketplace_listings for select to authenticated using (seller_id = auth.uid());
drop policy if exists marketplace_staff_read on public.marketplace_listings;
create policy marketplace_staff_read on public.marketplace_listings for select to authenticated using (
  exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role in ('staff','admin'))
);
drop policy if exists marketplace_seller_create on public.marketplace_listings;
create policy marketplace_seller_create on public.marketplace_listings for insert to authenticated with check (
  seller_id = auth.uid() and status = 'pending_approval'
  and (select private.marketplace_email_verified())
);
drop policy if exists marketplace_seller_edit_pending on public.marketplace_listings;
drop policy if exists marketplace_staff_moderate on public.marketplace_listings;
create policy marketplace_staff_moderate on public.marketplace_listings for update to authenticated using (
  exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role in ('staff','admin'))
) with check (
  exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role in ('staff','admin'))
);

-- Buyers and sellers may read only their own transaction rows. Inserts and
-- payment-state changes are service-role only, after verified SumUp status.
drop policy if exists marketplace_transaction_party_read on public.marketplace_transactions;
create policy marketplace_transaction_party_read on public.marketplace_transactions for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
drop policy if exists marketplace_transaction_staff_read on public.marketplace_transactions;
create policy marketplace_transaction_staff_read on public.marketplace_transactions for select to authenticated using (
  exists (select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role in ('staff','admin'))
);
drop policy if exists marketplace_transaction_admin_payout on public.marketplace_transactions;
create policy marketplace_transaction_admin_payout on public.marketplace_transactions for update to authenticated
using (payment_status='completed' and exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role='admin'))
with check (
  payment_status='completed'
  and exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role='admin')
  and (payout_status<>'paid' or (nullif(btrim(payout_reference),'') is not null and payout_paid_by=auth.uid() and payout_paid_at is not null))
);
drop policy if exists marketplace_audit_staff_read on public.marketplace_audit_log;
create policy marketplace_audit_staff_read on public.marketplace_audit_log for select to authenticated using (
  exists (select 1 from public.profiles p where p.id::text = auth.uid()::text and p.role in ('staff','admin'))
);

-- Sellers can upload into their own folder; images are served publicly only
-- after moderation activates the listing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-images','marketplace-images',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false;
drop policy if exists marketplace_images_public_read on storage.objects;
create policy marketplace_images_public_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'marketplace-images' and (
    exists(select 1 from public.marketplace_listings l where l.id::text=(storage.foldername(name))[2] and l.status='active')
    or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text)
    or exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role in ('staff','admin'))
  )
);
drop policy if exists marketplace_images_owner_insert on storage.objects;
create policy marketplace_images_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists marketplace_images_owner_update on storage.objects;
create policy marketplace_images_owner_update on storage.objects for update to authenticated using (
  bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = auth.uid()::text
) with check (bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists marketplace_images_owner_delete on storage.objects;
create policy marketplace_images_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'marketplace-images' and (storage.foldername(name))[1] = auth.uid()::text
);

revoke select on public.marketplace_listings from anon, authenticated;
grant select (id,title,category,make_model,condition,description,asking_price,images,status,created_at,updated_at) on public.marketplace_listings to anon;
grant select (id,seller_id,title,category,make_model,condition,description,asking_price,images,status,created_at,updated_at) on public.marketplace_listings to authenticated;
grant insert (id,seller_id,title,category,make_model,condition,description,asking_price,images,status) on public.marketplace_listings to authenticated;
grant update (status) on public.marketplace_listings to authenticated;
grant select on public.marketplace_transactions, public.marketplace_audit_log to authenticated;
grant update (payout_status,payout_reference,payout_paid_at,payout_paid_by) on public.marketplace_transactions to authenticated;
grant all on public.marketplace_listings, public.marketplace_transactions, public.marketplace_audit_log to service_role;

create or replace function private.marketplace_audit_transaction_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.payment_status is distinct from new.payment_status or old.payout_status is distinct from new.payout_status then
    insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
    values(new.listing_id,auth.uid(),'transaction_status_changed',jsonb_build_object(
      'transaction_id',new.id,'payment_from',old.payment_status,'payment_to',new.payment_status,
      'payout_from',old.payout_status,'payout_to',new.payout_status,'sumup_transaction_id',new.sumup_transaction_id
    ));
  end if;
  return new;
end;
$$;
drop trigger if exists marketplace_transaction_audit on public.marketplace_transactions;
create trigger marketplace_transaction_audit before update on public.marketplace_transactions for each row execute function private.marketplace_audit_transaction_change();

create or replace function private.marketplace_audit_listing_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.marketplace_audit_log(listing_id, actor_id, action, details)
    values (new.id, auth.uid(), 'status_changed', jsonb_build_object('from',old.status,'to',new.status));
  elsif old.title is distinct from new.title or old.asking_price is distinct from new.asking_price then
    insert into public.marketplace_audit_log(listing_id, actor_id, action, details)
    values (new.id, auth.uid(), 'listing_edited', jsonb_build_object('price_from',old.asking_price,'price_to',new.asking_price));
  end if;
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists marketplace_listing_audit on public.marketplace_listings;
create trigger marketplace_listing_audit before update on public.marketplace_listings for each row execute function private.marketplace_audit_listing_change();

comment on table public.marketplace_transactions is 'Marketplace money ledger: gross funds collected, configured facilitation fee, and seller payable are distinct amounts. Fee and tax treatment require business/accounting configuration.';

-- Called only by the trusted payment Edge Function after it has fetched and
-- verified the checkout directly from SumUp. Locking makes webhook/poll retries
-- idempotent and stops two buyers completing the same listing.
create or replace function public.complete_marketplace_transaction(p_transaction_id uuid, p_sumup_transaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tx public.marketplace_transactions%rowtype; v_listing public.marketplace_listings%rowtype;
begin
  select * into v_tx from public.marketplace_transactions where id=p_transaction_id for update;
  if not found then raise exception 'Marketplace transaction not found'; end if;
  if v_tx.payment_status='completed' then return jsonb_build_object('ok',true,'already_completed',true); end if;
  if v_tx.payment_status<>'pending' then raise exception 'Transaction is not pending'; end if;
  select * into v_listing from public.marketplace_listings where id=v_tx.listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer available'; end if;
  update public.marketplace_transactions set payment_status='completed', payout_status='due', sumup_transaction_id=p_sumup_transaction_id, completed_at=now() where id=p_transaction_id;
  update public.marketplace_listings set status='sold' where id=v_tx.listing_id;
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
    values(v_tx.listing_id,v_tx.buyer_id,'sale_completed',jsonb_build_object('transaction_id',p_transaction_id,'gross_amount',v_tx.gross_amount,'commission_amount',v_tx.commission_amount,'seller_payable',v_tx.seller_payable));
  return jsonb_build_object('ok',true,'already_completed',false);
end;
$$;
revoke all on function public.complete_marketplace_transaction(uuid,text) from public, anon, authenticated;
grant execute on function public.complete_marketplace_transaction(uuid,text) to service_role;

create or replace function public.reserve_marketplace_transaction(p_listing_id uuid, p_buyer_id uuid)
returns public.marketplace_transactions language plpgsql security definer set search_path = public as $$
declare v_listing public.marketplace_listings%rowtype; v_tx public.marketplace_transactions%rowtype;
begin
  select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Listing is no longer available'; end if;
  if v_listing.seller_id=p_buyer_id then raise exception 'You cannot buy your own listing'; end if;
  -- SumUp hosted sessions expire; release abandoned reservations older than an
  -- hour before starting another checkout.
  update public.marketplace_transactions set payment_status='cancelled'
    where listing_id=p_listing_id and payment_status='pending' and created_at < now()-interval '1 hour';
  if exists(select 1 from public.marketplace_transactions where listing_id=p_listing_id and payment_status in ('pending','completed')) then
    raise exception 'This listing already has an active checkout';
  end if;
  insert into public.marketplace_transactions(listing_id,buyer_id,seller_id,gross_amount,commission_rate_bps)
    values(p_listing_id,p_buyer_id,v_listing.seller_id,v_listing.asking_price,2000) returning * into v_tx;
  return v_tx;
end;
$$;
revoke all on function public.reserve_marketplace_transaction(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_marketplace_transaction(uuid,uuid) to service_role;

revoke all on function private.marketplace_audit_transaction_change() from public, anon, authenticated;
revoke all on function private.marketplace_audit_listing_change() from public, anon, authenticated;
-- Do not widen any existing application policies or modify unrelated data.
