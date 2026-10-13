-- Sole-trader expense ledger. Apply this migration before using Tax & Accounts.
create table if not exists public.tax_expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null,
  supplier text not null,
  description text not null default '',
  category text not null,
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  business_use_percent numeric(5,2) not null default 100 check (business_use_percent between 0 and 100),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0 and vat_amount <= gross_amount),
  evidence_reference text not null default '',
  claim_status text not null default 'review' check (claim_status in ('review','approved','excluded')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tax_expenses_spent_on_idx on public.tax_expenses(spent_on);
alter table public.tax_expenses enable row level security;
-- Staff roles are stored in profiles. Customers must not access tax records.
drop policy if exists tax_expenses_staff_read on public.tax_expenses;
create policy tax_expenses_staff_read on public.tax_expenses for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin')));
drop policy if exists tax_expenses_staff_insert on public.tax_expenses;
create policy tax_expenses_staff_insert on public.tax_expenses for insert to authenticated
with check (created_by=auth.uid() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin')));
drop policy if exists tax_expenses_staff_update on public.tax_expenses;
create policy tax_expenses_staff_update on public.tax_expenses for update to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin')))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin')));
-- Never delete financial records from the app: exclude with reason for auditability.
