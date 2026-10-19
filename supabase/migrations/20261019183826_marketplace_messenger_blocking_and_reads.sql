create table public.marketplace_user_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index marketplace_blocks_reverse_idx on public.marketplace_user_blocks(blocked_id,blocker_id);
alter table public.marketplace_user_blocks enable row level security;
revoke all on public.marketplace_user_blocks from public,anon,authenticated;
grant select on public.marketplace_user_blocks to authenticated;
create policy marketplace_blocks_owner_read on public.marketplace_user_blocks for select to authenticated using(blocker_id=(select auth.uid()));

create table public.marketplace_chat_reads (
 conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null,
 primary key(conversation_id,user_id)
);
alter table public.marketplace_chat_reads enable row level security;
revoke all on public.marketplace_chat_reads from public,anon,authenticated;
grant select on public.marketplace_chat_reads to authenticated;
create policy marketplace_reads_participants on public.marketplace_chat_reads for select to authenticated using(exists(select 1 from public.marketplace_conversations c where c.id=conversation_id and (select auth.uid()) in(c.buyer_id,c.seller_id)));
create index marketplace_messages_page_idx on public.marketplace_messages(conversation_id,created_at desc,id desc);

create function public.marketplace_pair_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.marketplace_user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
revoke all on function public.marketplace_pair_blocked(uuid,uuid) from public,anon,authenticated;

create function public.guard_marketplace_contact() returns trigger language plpgsql security definer set search_path='' as $$
declare buyer uuid; seller uuid;
begin
 -- Auction settlement is server-only and must retain its sale records.
 if current_setting('role',true)='service_role' and tg_table_name<>'marketplace_messages' then return new; end if;
 if tg_table_name='marketplace_conversations' then buyer:=new.buyer_id; seller:=new.seller_id;
 else select buyer_id,seller_id into buyer,seller from public.marketplace_conversations where id=new.conversation_id; end if;
 if public.marketplace_pair_blocked(buyer,seller) then raise exception 'Messaging is unavailable between these accounts' using errcode='42501'; end if;
 return new;
end; $$;
revoke all on function public.guard_marketplace_contact() from public,anon,authenticated;
create trigger marketplace_block_conversation before insert on public.marketplace_conversations for each row execute function public.guard_marketplace_contact();
create trigger marketplace_block_message before insert on public.marketplace_messages for each row execute function public.guard_marketplace_contact();
create trigger marketplace_block_deal before insert or update on public.marketplace_deal_terms for each row execute function public.guard_marketplace_contact();

create function public.set_marketplace_user_block(p_conversation_id uuid,p_blocked boolean) returns void language plpgsql security definer set search_path='' as $$
declare c public.marketplace_conversations%rowtype; other_id uuid;
begin
 select * into c from public.marketplace_conversations where id=p_conversation_id;
 if auth.uid() is null or not found or auth.uid() not in(c.buyer_id,c.seller_id) then raise exception 'Conversation not found' using errcode='42501'; end if;
 other_id:=case when auth.uid()=c.buyer_id then c.seller_id else c.buyer_id end;
 if p_blocked then insert into public.marketplace_user_blocks(blocker_id,blocked_id) values(auth.uid(),other_id) on conflict do nothing;
 else delete from public.marketplace_user_blocks where blocker_id=auth.uid() and blocked_id=other_id; end if;
 -- Notify both participants through conversations they may already read.
 update public.marketplace_conversations set updated_at=clock_timestamp() where (buyer_id=auth.uid() and seller_id=other_id) or (buyer_id=other_id and seller_id=auth.uid());
end; $$;

create function public.marketplace_messenger_state(p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.marketplace_conversations%rowtype; other_id uuid;
begin
 select * into c from public.marketplace_conversations where id=p_conversation_id;
 if auth.uid() is null or not found or auth.uid() not in(c.buyer_id,c.seller_id) then raise exception 'Conversation not found' using errcode='42501'; end if;
 other_id:=case when auth.uid()=c.buyer_id then c.seller_id else c.buyer_id end;
 return jsonb_build_object('blocked_by_me',exists(select 1 from public.marketplace_user_blocks where blocker_id=auth.uid() and blocked_id=other_id),'messaging_available',not public.marketplace_pair_blocked(auth.uid(),other_id),'other_read_at',(select last_read_at from public.marketplace_chat_reads where conversation_id=c.id and user_id=other_id));
end; $$;

create function public.mark_marketplace_chat_read(p_conversation_id uuid,p_message_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare stamp timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.marketplace_conversations where id=p_conversation_id and auth.uid() in(buyer_id,seller_id)) then raise exception 'Conversation not found' using errcode='42501'; end if;
 select created_at into stamp from public.marketplace_messages where id=p_message_id and conversation_id=p_conversation_id;
 if stamp is null then return; end if;
 insert into public.marketplace_chat_reads(conversation_id,user_id,last_read_at) values(p_conversation_id,auth.uid(),stamp)
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(public.marketplace_chat_reads.last_read_at,excluded.last_read_at);
end; $$;

create function public.marketplace_messenger_summary() returns table(conversation_id uuid,other_name text,last_message text,last_message_at timestamptz,unread_count bigint) language sql stable security definer set search_path='' as $$
 select c.id,coalesce(nullif(trim(p.display_name),''),'Marketplace member'),m.body,m.created_at,
 (select count(*) from public.marketplace_messages u where u.conversation_id=c.id and u.sender_id<>auth.uid() and (r.last_read_at is null or u.created_at>r.last_read_at))
 from public.marketplace_conversations c
 left join public.profiles p on p.id=case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end
 left join public.marketplace_chat_reads r on r.conversation_id=c.id and r.user_id=auth.uid()
 left join lateral(select body,created_at from public.marketplace_messages where conversation_id=c.id order by created_at desc,id desc limit 1)m on true
 where auth.uid() in(c.buyer_id,c.seller_id);
$$;

create function public.marketplace_chat_page(p_conversation_id uuid,p_before_created_at timestamptz default null,p_before_id uuid default null) returns setof public.marketplace_messages language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.marketplace_conversations where id=p_conversation_id and auth.uid() in(buyer_id,seller_id)) then raise exception 'Conversation not found' using errcode='42501'; end if;
 return query select * from public.marketplace_messages where conversation_id=p_conversation_id and (p_before_created_at is null or (created_at,id)<(p_before_created_at,p_before_id)) order by created_at desc,id desc limit 50;
end; $$;

revoke all on function public.set_marketplace_user_block(uuid,boolean), public.marketplace_messenger_state(uuid),public.mark_marketplace_chat_read(uuid,uuid),public.marketplace_messenger_summary(),public.marketplace_chat_page(uuid,timestamptz,uuid) from public,anon;
grant execute on function public.set_marketplace_user_block(uuid,boolean), public.marketplace_messenger_state(uuid),public.mark_marketplace_chat_read(uuid,uuid),public.marketplace_messenger_summary(),public.marketplace_chat_page(uuid,timestamptz,uuid) to authenticated;
alter publication supabase_realtime add table public.marketplace_chat_reads;
