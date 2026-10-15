-- Do not allow direct client inserts to bypass the server-side serial lookup.
drop policy if exists marketplace_seller_create on public.marketplace_listings;
revoke insert on public.marketplace_listings from anon, authenticated;
revoke insert (id,seller_id,title,category,make_model,condition,description,asking_price,images,status) on public.marketplace_listings from authenticated;
alter table public.marketplace_listings drop constraint if exists marketplace_listings_status_check;
alter table public.marketplace_listings add constraint marketplace_listings_status_check
  check (status in ('pending_approval','pending_review','active','sold','cancelled','rejected'));

create table if not exists public.marketplace_serial_checks (
  listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete restrict,
  frame_serial_number text not null,
  serial_number_photo_path text not null,
  check_status text not null check (check_status in ('clear','review_required')),
  checked_at timestamptz not null,
  response_sha256 text not null check (response_sha256 ~ '^[0-9a-f]{64}$'),
  matched_stolen_records integer not null default 0 check (matched_stolen_records >= 0),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_serial_checks_seller_idx on public.marketplace_serial_checks(seller_id,created_at desc);
alter table public.marketplace_serial_checks enable row level security;
revoke all on public.marketplace_serial_checks from public, anon, authenticated;
grant select on public.marketplace_serial_checks to authenticated;
create policy marketplace_serial_checks_owner_read on public.marketplace_serial_checks
  for select to authenticated using (seller_id=auth.uid());
create policy marketplace_serial_checks_staff_read on public.marketplace_serial_checks
  for select to authenticated using (exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role in ('staff','admin')));
grant all on public.marketplace_serial_checks to service_role;

create table if not exists public.marketplace_stolen_listing_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  listing_title text not null,
  make_model text not null,
  serial_sha256 text not null check (serial_sha256 ~ '^[0-9a-f]{64}$'),
  bike_index_response_sha256 text not null check (bike_index_response_sha256 ~ '^[0-9a-f]{64}$'),
  matching_stolen_records integer not null check (matching_stolen_records > 0),
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists marketplace_stolen_listing_flags_status_idx on public.marketplace_stolen_listing_flags(status,created_at desc);
alter table public.marketplace_stolen_listing_flags enable row level security;
revoke all on public.marketplace_stolen_listing_flags from public, anon, authenticated;
grant select,update on public.marketplace_stolen_listing_flags to authenticated;
create policy marketplace_stolen_flags_staff_read on public.marketplace_stolen_listing_flags
  for select to authenticated using (exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role in ('staff','admin')));
create policy marketplace_stolen_flags_admin_update on public.marketplace_stolen_listing_flags
  for update to authenticated using (exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role='admin'))
  with check (exists(select 1 from public.profiles p where p.id::text=auth.uid()::text and p.role='admin'));
grant all on public.marketplace_stolen_listing_flags to service_role;

create or replace function public.create_marketplace_listing_checked(
  p_listing jsonb,
  p_serial_number text,
  p_serial_photo_path text,
  p_check_status text,
  p_checked_at timestamptz,
  p_response_sha256 text,
  p_match_count integer
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_listing_id uuid;
begin
  if p_check_status not in ('clear','review_required') then raise exception 'Invalid serial lookup status'; end if;
  if p_check_status='clear' and p_match_count<>0 then raise exception 'Clear check cannot contain stolen matches'; end if;
  if p_check_status='review_required' and p_match_count<1 then raise exception 'Review check requires a potential match'; end if;
  if p_response_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Bike Index response hash'; end if;
  v_listing_id := (p_listing->>'id')::uuid;
  insert into public.marketplace_listings(id,seller_id,title,category,make_model,condition,description,asking_price,images,status)
    values(v_listing_id,(p_listing->>'seller_id')::uuid,p_listing->>'title',p_listing->>'category',p_listing->>'make_model',
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
