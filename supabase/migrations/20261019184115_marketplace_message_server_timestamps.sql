create or replace function public.guard_marketplace_contact() returns trigger language plpgsql security definer set search_path='' as $$
declare buyer uuid; seller uuid;
begin
 -- Auction settlement is server-only and must retain its sale records.
 if current_setting('role',true)='service_role' and tg_table_name<>'marketplace_messages' then return new; end if;
 if tg_table_name='marketplace_messages' then new.created_at:=clock_timestamp(); end if;
 if tg_table_name='marketplace_conversations' then buyer:=new.buyer_id; seller:=new.seller_id;
 else select buyer_id,seller_id into buyer,seller from public.marketplace_conversations where id=new.conversation_id; end if;
 if public.marketplace_pair_blocked(buyer,seller) then raise exception 'Messaging is unavailable between these accounts' using errcode='42501'; end if;
 return new;
end; $$;
