-- Supabase default table grants include privileges outside row-level policies.
-- Replace inherited table grants with the exact browser/native API contract.
revoke all on public.marketplace_listings, public.marketplace_transactions, public.marketplace_audit_log from anon, authenticated;
grant select (id,title,category,make_model,condition,description,asking_price,images,status,created_at,updated_at) on public.marketplace_listings to anon;
grant select (id,seller_id,title,category,make_model,condition,description,asking_price,images,status,created_at,updated_at) on public.marketplace_listings to authenticated;
grant insert (id,seller_id,title,category,make_model,condition,description,asking_price,images,status) on public.marketplace_listings to authenticated;
grant update (status) on public.marketplace_listings to authenticated;
grant select on public.marketplace_transactions, public.marketplace_audit_log to authenticated;
grant update (payout_status,payout_reference,payout_paid_at,payout_paid_by) on public.marketplace_transactions to authenticated;

