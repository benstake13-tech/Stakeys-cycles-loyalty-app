-- Safe, whitelisted Google diagnostics; credentials remain server-only.
alter table public.google_business_connection add column if not exists last_issue jsonb;
