-- Public-safe, quote-led campaign scope. Private costs stay out of this table.
alter table public.promotions add column if not exists campaign_brief jsonb;
alter table public.promotions add constraint promotions_quote_brief_check check (
  campaign_brief is null or coalesce((
    jsonb_typeof(campaign_brief) = 'object'
    and campaign_brief->>'version' = '1'
    and campaign_brief->'requiresQuote' = 'true'::jsonb
    and campaign_brief->>'objective' in ('workshop','stock','retention','growth')
    and jsonb_typeof(campaign_brief->'uptakeLimit') = 'number'
    and (campaign_brief->>'uptakeLimit')::numeric > 0
    and mod((campaign_brief->>'uptakeLimit')::numeric, 1) = 0
    and coalesce(discount_percentage, 0) = 0 and coalesce(discount_amount, 0) = 0
    and (campaign_brief - array['version','objective','serviceId','productId','segmentId','audienceDescription','audience','requiresQuote','uptakeLimit','successMetric','approvedAt']) = '{}'::jsonb
  ), false)
);

-- A generic promotion editor must not broaden a reviewed brief. Regenerate it
-- through the planner when dates, scope or terms need to change.
create or replace function public.preserve_promotion_brief() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.campaign_brief is not null and (
    new.campaign_brief is distinct from old.campaign_brief or
    new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or
    new.eligible_categories is distinct from old.eligible_categories or
    new.terms_and_conditions is distinct from old.terms_and_conditions
  ) then raise exception 'Regenerate and review this quote-led campaign to change dates, scope or terms.';
  end if;
  return new;
end;
$$;
create trigger preserve_promotion_brief before update on public.promotions
for each row execute function public.preserve_promotion_brief();

-- Publication is a staff action, including API calls outside the staff UI.
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.can_manage_promotions() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('staff','admin'));
$$;
revoke all on function private.can_manage_promotions() from public;
grant execute on function private.can_manage_promotions() to authenticated;
alter table public.promotions enable row level security;
create policy "Promotions public read" on public.promotions for select using (true);
alter policy "Allow all on promotions" on public.promotions to authenticated
using ((select private.can_manage_promotions())) with check ((select private.can_manage_promotions()));
alter policy "Allow all on promotions" on public.promotions rename to "Promotions staff manage";
