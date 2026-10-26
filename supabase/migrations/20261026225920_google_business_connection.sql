-- Server-only Google OAuth refresh token and last successful report.
-- Staff access is verified in /api/business/google-shared, never via client SQL.
create table if not exists public.google_business_connection (
  id text primary key check (id = 'primary'),
  refresh_token text not null,
  connection_version uuid not null default gen_random_uuid(),
  location_name text,
  locations jsonb not null default '[]'::jsonb,
  snapshot jsonb,
  updated_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  needs_reconnect boolean not null default false
);
alter table public.google_business_connection enable row level security;
revoke all on public.google_business_connection from public, anon, authenticated;
grant select, insert, update, delete on public.google_business_connection to service_role;
