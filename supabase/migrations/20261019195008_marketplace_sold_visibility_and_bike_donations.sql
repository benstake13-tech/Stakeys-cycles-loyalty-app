alter table public.marketplace_listings add column sold_at timestamptz;
grant select(sold_at) on public.marketplace_listings to anon,authenticated;
-- Preserve the original timing of existing completed adverts.
update public.marketplace_listings set sold_at=updated_at where status='sold';
create function private.marketplace_sale_timestamp() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.sold_at:=null;
 elsif old.status='sold' and new.status not in('sold','cancelled') then
  raise exception 'A completed sale cannot be reopened';
 elsif old.sold_at is not null then new.sold_at:=old.sold_at;
 elsif new.status='sold' and old.status is distinct from 'sold' then new.sold_at:=clock_timestamp();
 else new.sold_at:=null; end if;
 return new;
end; $$;
revoke all on function private.marketplace_sale_timestamp() from public,anon,authenticated;
create trigger marketplace_sale_timestamp before insert or update on public.marketplace_listings for each row execute function private.marketplace_sale_timestamp();
create index marketplace_recent_sold_idx on public.marketplace_listings(sold_at) where status='sold';
drop policy marketplace_public_browse on public.marketplace_listings;
create policy marketplace_public_browse on public.marketplace_listings for select to anon,authenticated using(status='active' or (status='sold' and sold_at>now()-interval '48 hours'));
drop policy marketplace_images_public_read on storage.objects;
create policy marketplace_images_public_read on storage.objects for select to anon,authenticated using(
 bucket_id='marketplace-images' and (
  exists(select 1 from public.marketplace_listings l where l.id::text=(storage.foldername(name))[2] and (l.status='active' or (l.status='sold' and l.sold_at>now()-interval '48 hours')))
  or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text)
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in('staff','admin'))));

create or replace function public.record_marketplace_manual_sale(p_listing_id uuid,p_buyer_name text,p_buyer_contact text,p_amount numeric,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare v_listing public.marketplace_listings%rowtype;
begin
 select * into v_listing from public.marketplace_listings where id=p_listing_id for update;
 if auth.uid() is null or not found or (v_listing.seller_id<>auth.uid() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in('staff','admin'))) then
  raise exception 'Seller or staff access required' using errcode='42501'; end if;
 if v_listing.status='sold' then return; end if;
 if char_length(btrim(coalesce(p_buyer_name,''))) not between 2 and 120
  or char_length(btrim(coalesce(p_buyer_contact,''))) not between 3 and 200
  or p_amount is null or p_amount<>round(p_amount,2) or p_amount<=0 or p_amount>50000
  or char_length(coalesce(p_note,''))>500 then raise exception 'Enter the buyer, contact details and actual sale amount'; end if;
 if v_listing.status<>'active' then raise exception 'Listing is no longer active'; end if;
 if exists(select 1 from public.marketplace_auctions where listing_id=p_listing_id)
  or exists(select 1 from public.marketplace_transactions where listing_id=p_listing_id and payment_status in('pending','completed')) then
  raise exception 'An auction or active checkout must use its own sale record'; end if;
 insert into public.marketplace_record_events(listing_id,event_type,actor_id,people,details,bike_snapshot)
 values(p_listing_id,'manual_sale_recorded',auth.uid(),
  jsonb_build_object('seller',private.marketplace_record_party(v_listing.seller_id),'buyer',jsonb_build_object('name',btrim(p_buyer_name),'contact',btrim(p_buyer_contact))),
  jsonb_build_object('amount',p_amount,'payment_status','recorded_offline_unverified','note',btrim(coalesce(p_note,''))),private.marketplace_record_bike(p_listing_id));
 update public.marketplace_listings set status='sold' where id=p_listing_id;
end; $$;
revoke all on function public.record_marketplace_manual_sale(uuid,text,text,numeric,text) from public,anon;
grant execute on function public.record_marketplace_manual_sale(uuid,text,text,numeric,text) to authenticated;

create table public.bike_donation_requests(
 id uuid primary key,user_id uuid references auth.users(id) on delete set null,
 donor_name text not null check(char_length(donor_name) between 2 and 120),
 email text not null check(char_length(email) between 3 and 254),phone text not null default '' check(char_length(phone)<=40),
 postcode text not null default '' check(char_length(postcode)<=12),
 bike_details text not null check(char_length(bike_details) between 3 and 500),
 condition text not null check(condition in('working','needs_repairs','not_sure')),
 notes text not null default '' check(char_length(notes)<=1500),
 consent_to_contact boolean not null check(consent_to_contact),
 status text not null default 'new' check(status in('new','contacted','collected','refurbishing','donated','declined')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.bike_donation_requests enable row level security;
revoke all on public.bike_donation_requests from public,anon,authenticated;
grant select on public.bike_donation_requests to authenticated;
grant update(status) on public.bike_donation_requests to authenticated;
create policy donation_staff_read on public.bike_donation_requests for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('staff','admin')));
create policy donation_staff_update on public.bike_donation_requests for update to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('staff','admin'))) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in('staff','admin')));
create index donation_recent_email_idx on public.bike_donation_requests(lower(email),created_at desc);
create function public.submit_bike_donation(p_id uuid,p_name text,p_email text,p_phone text,p_postcode text,p_bike text,p_condition text,p_notes text,p_consent boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_consent is distinct from true
  or char_length(btrim(coalesce(p_name,''))) not between 2 and 120
  or char_length(btrim(coalesce(p_email,''))) not between 3 and 254
  or btrim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or char_length(coalesce(p_phone,''))>40 or char_length(coalesce(p_postcode,''))>12
  or char_length(btrim(coalesce(p_bike,''))) not between 3 and 500
  or p_condition is null or p_condition not in('working','needs_repairs','not_sure')
  or char_length(coalesce(p_notes,''))>1500 then raise exception 'Check the donation details and contact consent'; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)),0));
 if exists(select 1 from public.bike_donation_requests where id=p_id) then return; end if;
 if (select count(*) from public.bike_donation_requests where lower(email)=lower(btrim(p_email)) and created_at>now()-interval '24 hours')>=3 then raise exception 'Please contact the workshop about further donations'; end if;
 insert into public.bike_donation_requests(id,user_id,donor_name,email,phone,postcode,bike_details,condition,notes,consent_to_contact)
 values(p_id,auth.uid(),btrim(p_name),lower(btrim(p_email)),btrim(coalesce(p_phone,'')),upper(btrim(coalesce(p_postcode,''))),btrim(p_bike),p_condition,btrim(coalesce(p_notes,'')),true);
end; $$;
revoke all on function public.submit_bike_donation(uuid,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.submit_bike_donation(uuid,text,text,text,text,text,text,text,boolean) to anon,authenticated;
