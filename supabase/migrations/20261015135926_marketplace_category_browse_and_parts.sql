-- Support meaningful marketplace filters and standalone parts while keeping
-- vehicle listings behind the existing server-side serial verification flow.
alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_category_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_category_check
  check (category in ('bicycle','ebike','escooter','parts'));

alter table public.marketplace_listings
  add column if not exists subcategory text;
alter table public.marketplace_listings
  add column if not exists ai_inspection jsonb;
alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_ai_inspection_object_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_ai_inspection_object_check
  check (ai_inspection is null or jsonb_typeof(ai_inspection) = 'object');
alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_subcategory_check;
alter table public.marketplace_listings
  add constraint marketplace_listings_subcategory_check
  check (
    subcategory is null
    or (category = 'bicycle' and subcategory in ('commuter','hardtail_mtb','road','other'))
  );

grant select (subcategory) on public.marketplace_listings to anon, authenticated;
grant select (ai_inspection) on public.marketplace_listings to anon, authenticated;

-- Vehicle listings still require a completed Bike Index lookup and retain its
-- timestamp/hash audit row. Bicycle subtype is stored with the public listing.
create or replace function public.create_marketplace_listing_checked(
  p_listing jsonb,
  p_serial_number text,
  p_serial_photo_path text,
  p_check_status text,
  p_checked_at timestamptz,
  p_response_sha256 text,
  p_match_count integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_listing_id uuid; v_category text; v_subcategory text;
begin
  if p_check_status not in ('clear','review_required') then raise exception 'Invalid serial lookup status'; end if;
  if p_check_status='clear' and p_match_count<>0 then raise exception 'Clear check cannot contain stolen matches'; end if;
  if p_check_status='review_required' and p_match_count<1 then raise exception 'Review check requires a potential match'; end if;
  if p_response_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Bike Index response hash'; end if;
  v_listing_id := (p_listing->>'id')::uuid;
  v_category := p_listing->>'category';
  v_subcategory := nullif(p_listing->>'subcategory','');
  if v_category not in ('bicycle','ebike','escooter') then raise exception 'Invalid vehicle category'; end if;
  if (v_category='bicycle' and (v_subcategory is null or v_subcategory not in ('commuter','hardtail_mtb','road','other')))
     or (v_category<>'bicycle' and v_subcategory is not null) then raise exception 'Invalid bicycle subcategory'; end if;
  if jsonb_typeof(p_listing->'ai_inspection') <> 'object'
     or p_listing->'ai_inspection'->>'hasVisualData' <> 'true'
     or p_listing->'ai_inspection'->>'usedFallback' <> 'false'
     or nullif(trim(p_listing->'ai_inspection'->>'make'),'') is null
     or nullif(trim(p_listing->'ai_inspection'->>'model'),'') is null then raise exception 'A live AI photo identification is required'; end if;
  insert into public.marketplace_listings(id,seller_id,title,category,subcategory,make_model,ai_inspection,condition,description,asking_price,images,status)
    values(v_listing_id,(p_listing->>'seller_id')::uuid,p_listing->>'title',v_category,v_subcategory,p_listing->>'make_model',p_listing->'ai_inspection',
      p_listing->>'condition',coalesce(p_listing->>'description',''),(p_listing->>'asking_price')::numeric,
      coalesce(array(select jsonb_array_elements_text(p_listing->'images')),'{}'),
      case when p_check_status='review_required' then 'pending_review' else 'pending_approval' end);
  insert into public.marketplace_serial_checks(listing_id,seller_id,frame_serial_number,serial_number_photo_path,check_status,checked_at,response_sha256,matched_stolen_records)
    values(v_listing_id,(p_listing->>'seller_id')::uuid,btrim(p_serial_number),p_serial_photo_path,p_check_status,p_checked_at,p_response_sha256,p_match_count);
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
    values(v_listing_id,(p_listing->>'seller_id')::uuid,'serial_lookup_completed',jsonb_build_object('check_status',p_check_status,'checked_at',p_checked_at,'response_sha256',p_response_sha256,'matched_stolen_records',p_match_count));
  return v_listing_id;
end;
$$;
revoke all on function public.create_marketplace_listing_checked(jsonb,text,text,text,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.create_marketplace_listing_checked(jsonb,text,text,text,timestamptz,text,integer) to service_role;

-- Standalone parts do not have a frame serial to check. Their server-side path
-- still requires an email-verified seller, owned uploaded photos, and staff
-- approval before the listing can be published.
create or replace function public.create_marketplace_parts_listing(p_listing jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_listing_id uuid; v_seller uuid; v_price numeric;
begin
  v_listing_id := (p_listing->>'id')::uuid;
  v_seller := (p_listing->>'seller_id')::uuid;
  v_price := (p_listing->>'asking_price')::numeric;
  if coalesce(p_listing->>'category','') <> 'parts' then raise exception 'Parts listing required'; end if;
  if char_length(trim(coalesce(p_listing->>'title',''))) not between 4 and 120 then raise exception 'Invalid part title'; end if;
  if char_length(trim(coalesce(p_listing->>'make_model',''))) < 2 then raise exception 'Describe the part or compatibility'; end if;
  if char_length(coalesce(p_listing->>'description','')) > 2000 then raise exception 'Part description is too long'; end if;
  if v_price is null or v_price <= 0 or v_price > 50000 then raise exception 'Invalid asking price'; end if;
  if coalesce(jsonb_typeof(p_listing->'images'),'') <> 'array' then raise exception 'Invalid part photos'; end if;
  if jsonb_array_length(p_listing->'images') not between 1 and 5 then raise exception 'Invalid part photos'; end if;
  insert into public.marketplace_listings(id,seller_id,title,category,subcategory,make_model,condition,description,asking_price,images,status)
    values(v_listing_id,v_seller,trim(p_listing->>'title'),'parts',null,trim(p_listing->>'make_model'),
      p_listing->>'condition',trim(coalesce(p_listing->>'description','')),round(v_price,2),
      coalesce(array(select jsonb_array_elements_text(p_listing->'images')),'{}'),'pending_approval');
  insert into public.marketplace_audit_log(listing_id,actor_id,action,details)
    values(v_listing_id,v_seller,'parts_listing_submitted',jsonb_build_object('moderation_status','pending_approval'));
  return v_listing_id;
end;
$$;
revoke all on function public.create_marketplace_parts_listing(jsonb) from public,anon,authenticated;
grant execute on function public.create_marketplace_parts_listing(jsonb) to service_role;
