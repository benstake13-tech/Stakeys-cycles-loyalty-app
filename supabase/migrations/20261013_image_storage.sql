-- Apply in Supabase SQL editor before using imageStorage.ts.
-- Public images are intentionally readable by everyone, but writable only by staff/admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('stakeys-images','stakeys-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('stakeys-private','stakeys-private',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.app_images (
 id uuid primary key default gen_random_uuid(),
 bucket_name text not null check(bucket_name in ('stakeys-images','stakeys-private')),
 storage_path text not null,
 image_category text not null,
 related_entity_id uuid,
 alt_text text,
 uploaded_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(bucket_name,storage_path)
);
create index if not exists app_images_entity_idx on public.app_images(related_entity_id);
alter table public.app_images enable row level security;

-- This function trusts only a role stored in auth app_metadata (set by a privileged backend).
create or replace function public.stakeys_image_staff()
returns boolean language sql stable security invoker set search_path = ''
as $$ select coalesce(auth.jwt()->'app_metadata'->>'role','') in ('staff','admin') $$;

drop policy if exists "Stakeys public image access" on storage.objects;
drop policy if exists "Stakeys authenticated uploads" on storage.objects;
drop policy if exists "Stakeys authenticated updates" on storage.objects;
drop policy if exists "Stakeys authenticated deletes" on storage.objects;
drop policy if exists "stakeys public read" on storage.objects;
create policy "stakeys public read" on storage.objects for select to public
using(bucket_id='stakeys-images');
create policy "stakeys public staff upload" on storage.objects for insert to authenticated
with check(bucket_id='stakeys-images' and public.stakeys_image_staff());
create policy "stakeys public staff update" on storage.objects for update to authenticated
using(bucket_id='stakeys-images' and public.stakeys_image_staff())
with check(bucket_id='stakeys-images' and public.stakeys_image_staff());
create policy "stakeys public staff delete" on storage.objects for delete to authenticated
using(bucket_id='stakeys-images' and public.stakeys_image_staff());

-- Customer-private photos live strictly under <auth.uid()>/bikes/...
create policy "stakeys private own read" on storage.objects for select to authenticated
using(bucket_id='stakeys-private' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "stakeys private own upload" on storage.objects for insert to authenticated
with check(bucket_id='stakeys-private' and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='bikes');
create policy "stakeys private own delete" on storage.objects for delete to authenticated
using(bucket_id='stakeys-private' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Read Stakeys image metadata" on public.app_images;
drop policy if exists "Insert own image metadata" on public.app_images;
drop policy if exists "Update own image metadata" on public.app_images;
drop policy if exists "Delete own image metadata" on public.app_images;
create policy "stakeys metadata read" on public.app_images for select to public
using(bucket_name='stakeys-images' or (auth.uid()=uploaded_by and bucket_name='stakeys-private'));
create policy "stakeys metadata insert" on public.app_images for insert to authenticated
with check(uploaded_by=auth.uid() and
 ((bucket_name='stakeys-images' and public.stakeys_image_staff() and image_category <> 'bikes' and split_part(storage_path,'/',1)=image_category)
 or (bucket_name='stakeys-private' and image_category='bikes' and split_part(storage_path,'/',1)=auth.uid()::text and split_part(storage_path,'/',2)='bikes')));
create policy "stakeys metadata delete" on public.app_images for delete to authenticated
using(uploaded_by=auth.uid() and (bucket_name='stakeys-private' or public.stakeys_image_staff()));

-- Do not grant service-role credentials to browser or Android apps.
-- Staff access to customer photos needs a separate audited, ownership-checked backend.
