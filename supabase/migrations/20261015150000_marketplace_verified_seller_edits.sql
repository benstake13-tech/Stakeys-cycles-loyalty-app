-- Keep customer listing writes behind marketplace-listings. Only verified
-- sellers may upload files, and seller edits always return to staff review.

create schema if not exists private;
create or replace function private.marketplace_email_is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.marketplace_email_is_verified() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.marketplace_email_is_verified() to authenticated;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_category_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_category_check
  check (category in ('bicycle','ebike','escooter','parts','accessories'));

-- Listing inserts remain service-role-only. Direct photo uploads are limited
-- to a verified user's own UUID/listing-UUID folder.
drop policy if exists marketplace_images_owner_insert on storage.objects;
create policy marketplace_images_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.marketplace_email_is_verified()
);

drop policy if exists marketplace_images_owner_update on storage.objects;
create policy marketplace_images_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.marketplace_email_is_verified()
)
with check (
  bucket_id = 'marketplace-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and private.marketplace_email_is_verified()
);

-- Standalone parts and accessories use the same moderation path; they do not
-- require a vehicle serial or AI photo assessment.
create or replace function public.create_marketplace_nonvehicle_listing(p_listing jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_listing->>'category' not in ('parts','accessories') then
    raise exception 'Invalid non-vehicle marketplace category';
  end if;
  if nullif(trim(p_listing->>'seller_id'),'') is null then raise exception 'Seller is required'; end if;
  v_id := (p_listing->>'id')::uuid;
  insert into public.marketplace_listings (
    id,seller_id,title,category,subcategory,make_model,condition,
    description,asking_price,images,ai_inspection,status
  ) values (
    v_id,(p_listing->>'seller_id')::uuid,trim(p_listing->>'title'),
    p_listing->>'category',null,trim(p_listing->>'make_model'),
    p_listing->>'condition',coalesce(p_listing->>'description',''),
    (p_listing->>'asking_price')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_listing->'images','[]'::jsonb))),
    null,'pending_approval'
  );
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
  values(v_id,(p_listing->>'seller_id')::uuid,'listing_submitted',jsonb_build_object('category',p_listing->>'category'));
  return v_id;
end;
$$;
revoke all on function public.create_marketplace_nonvehicle_listing(jsonb) from public, anon, authenticated;
grant execute on function public.create_marketplace_nonvehicle_listing(jsonb) to service_role;

-- The Edge Function verifies the caller and Bike Index result before invoking
-- this service-role-only atomic edit. Every seller edit returns to review.
create or replace function public.update_marketplace_listing_checked(
  p_listing jsonb,p_seller_id uuid,p_serial_number text,p_serial_photo_path text,
  p_check_status text,p_checked_at timestamptz,p_response_sha256 text,p_match_count integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p_listing->>'id')::uuid;
  v_category text := p_listing->>'category';
  v_subcategory text := nullif(p_listing->>'subcategory','');
  v_status text;
begin
  if v_category not in ('bicycle','ebike','escooter','parts','accessories') then raise exception 'Invalid marketplace category'; end if;
  if (v_category='bicycle' and (v_subcategory is null or v_subcategory not in ('commuter','hardtail_mtb','road','other')))
     or (v_category<>'bicycle' and v_subcategory is not null) then raise exception 'Invalid marketplace subcategory'; end if;
  if v_category in ('parts','accessories') then
    if nullif(p_serial_number,'') is not null or nullif(p_serial_photo_path,'') is not null then raise exception 'Non-vehicle listings cannot contain frame serial details'; end if;
    v_status := 'pending_approval';
  else
    if p_check_status not in ('clear','review_required') then raise exception 'Invalid serial lookup status'; end if;
    if p_check_status='clear' and p_match_count<>0 then raise exception 'Clear check cannot contain stolen matches'; end if;
    if p_check_status='review_required' and p_match_count<1 then raise exception 'Review check requires a possible match'; end if;
    if p_response_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Bike Index response hash'; end if;
    if nullif(p_serial_number,'') is null or nullif(p_serial_photo_path,'') is null then raise exception 'Serial number and photo are required'; end if;
    v_status := case when p_check_status='review_required' then 'pending_review' else 'pending_approval' end;
  end if;

  update public.marketplace_listings
  set title=trim(p_listing->>'title'),category=v_category,subcategory=v_subcategory,
      make_model=trim(p_listing->>'make_model'),condition=p_listing->>'condition',
      description=coalesce(p_listing->>'description',''),asking_price=(p_listing->>'asking_price')::numeric,
      images=array(select jsonb_array_elements_text(coalesce(p_listing->'images','[]'::jsonb))),
      ai_inspection=case when v_category in ('parts','accessories') then null else p_listing->'ai_inspection' end,
      status=v_status
  where id=v_id and seller_id=p_seller_id and status not in ('sold','cancelled');
  if not found then raise exception 'Listing not found, no longer editable, or not owned by seller'; end if;

  if v_category in ('parts','accessories') then
    delete from public.marketplace_serial_checks where listing_id=v_id and seller_id=p_seller_id;
  else
    insert into public.marketplace_serial_checks (
      listing_id,seller_id,frame_serial_number,serial_number_photo_path,
      check_status,checked_at,response_sha256,matched_stolen_records
    ) values (
      v_id,p_seller_id,p_serial_number,p_serial_photo_path,p_check_status,
      p_checked_at,p_response_sha256,p_match_count
    ) on conflict (listing_id) do update set
      seller_id=excluded.seller_id,frame_serial_number=excluded.frame_serial_number,
      serial_number_photo_path=excluded.serial_number_photo_path,check_status=excluded.check_status,
      checked_at=excluded.checked_at,response_sha256=excluded.response_sha256,
      matched_stolen_records=excluded.matched_stolen_records;
  end if;
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
  values(v_id,p_seller_id,'listing_edited',jsonb_build_object('status_after_edit',v_status));
  return v_id;
end;
$$;
revoke all on function public.update_marketplace_listing_checked(jsonb,uuid,text,text,text,timestamptz,text,integer) from public, anon, authenticated;
grant execute on function public.update_marketplace_listing_checked(jsonb,uuid,text,text,text,timestamptz,text,integer) to service_role;

-- Bind conversations to the seller on the listing, not an arbitrary account.
drop policy if exists marketplace_conversations_buyer_start on public.marketplace_conversations;
create policy marketplace_conversations_buyer_start on public.marketplace_conversations
for insert to authenticated
with check (
  buyer_id=(select auth.uid())
  and exists (
    select 1 from public.marketplace_listings l
    where l.id=marketplace_conversations.listing_id
      and l.seller_id=marketplace_conversations.seller_id
      and l.seller_id<>(select auth.uid())
      and l.status='active'
  )
);
