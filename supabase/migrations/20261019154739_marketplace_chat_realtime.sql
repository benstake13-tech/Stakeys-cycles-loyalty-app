-- Enable participant-protected Postgres Changes without widening table access.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    raise exception 'Realtime publication is missing';
  end if;
  foreach t in array array['marketplace_conversations','marketplace_messages','marketplace_deal_terms'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
