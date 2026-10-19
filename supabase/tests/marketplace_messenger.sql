-- Integration test: synthetic accounts/listings/messages, always rolled back.
begin;
do $$
declare buyer uuid:=gen_random_uuid(); seller uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); l1 uuid:=gen_random_uuid();l2 uuid:=gen_random_uuid();
begin
 perform set_config('test.buyer',buyer::text,true);perform set_config('test.seller',seller::text,true);perform set_config('test.outsider',outsider::text,true);perform set_config('test.listing',l1::text,true);perform set_config('test.listing2',l2::text,true);
 insert into auth.users(id,email,raw_user_meta_data) values(buyer,buyer||'@example.test','{}'),(seller,seller||'@example.test','{}'),(outsider,outsider||'@example.test','{}');
 insert into public.marketplace_listings(id,seller_id,title,make_model,category,condition,asking_price,status) values(l1,seller,'Messenger verification part','Test part','parts','good',10,'active'),(l2,seller,'Second messenger verification part','Test part','parts','good',12,'active');
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.buyer'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.buyer'),'role','authenticated')::text,true);
select set_config('test.chat',public.start_marketplace_conversation(current_setting('test.listing')::uuid)::text,true);
with m as(insert into public.marketplace_messages(conversation_id,sender_id,body,created_at) values(current_setting('test.chat')::uuid,auth.uid(),'Buyer question','2099-01-01') returning id,created_at)
select set_config('test.message',(select id::text from m),true);
do $$begin if exists(select 1 from public.marketplace_messages where conversation_id=current_setting('test.chat')::uuid and created_at>now()+interval '1 minute') then raise exception 'FAIL: client-controlled timestamp';end if;end;$$;
select public.propose_marketplace_price(current_setting('test.chat')::uuid,8);
select set_config('request.jwt.claim.sub',current_setting('test.seller'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.seller'),'role','authenticated')::text,true);
do $$begin if (select unread_count from public.marketplace_messenger_summary() where conversation_id=current_setting('test.chat')::uuid)<>1 then raise exception 'FAIL unread';end if;end;$$;
select public.mark_marketplace_chat_read(current_setting('test.chat')::uuid,current_setting('test.message')::uuid);
do $$begin if (select unread_count from public.marketplace_messenger_summary() where conversation_id=current_setting('test.chat')::uuid)<>0 then raise exception 'FAIL read receipt';end if;end;$$;
insert into public.marketplace_messages(conversation_id,sender_id,body) values(current_setting('test.chat')::uuid,auth.uid(),'Seller reply');
select public.accept_marketplace_price(current_setting('test.chat')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.buyer'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.buyer'),'role','authenticated')::text,true);
do $$begin if (public.marketplace_messenger_state(current_setting('test.chat')::uuid)->>'other_read_at') is null then raise exception 'FAIL counterpart receipt';end if;if (select count(*) from public.marketplace_chat_page(current_setting('test.chat')::uuid))<>2 then raise exception 'FAIL two-way history';end if;end;$$;
select public.set_marketplace_user_block(current_setting('test.chat')::uuid,true);
do $$begin
 if not (public.marketplace_messenger_state(current_setting('test.chat')::uuid)->>'blocked_by_me')::boolean then raise exception 'FAIL own block state';end if;
 begin insert into public.marketplace_messages(conversation_id,sender_id,body) values(current_setting('test.chat')::uuid,auth.uid(),'Blocked message');raise exception 'FAIL block sender';exception when insufficient_privilege then null;end;
 begin perform public.propose_marketplace_price(current_setting('test.chat')::uuid,9);raise exception 'FAIL blocked offer';exception when insufficient_privilege then null;end;
 begin perform public.start_marketplace_conversation(current_setting('test.listing2')::uuid);raise exception 'FAIL cross-listing bypass';exception when insufficient_privilege then null;end;
 begin perform public.start_marketplace_conversation(current_setting('test.listing')::uuid);raise exception 'FAIL reopen bypass';exception when insufficient_privilege then null;end;
 if (select count(*) from public.marketplace_chat_page(current_setting('test.chat')::uuid))<>2 then raise exception 'FAIL history lost after block';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.seller'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.seller'),'role','authenticated')::text,true);
do $$begin
 if (public.marketplace_messenger_state(current_setting('test.chat')::uuid)->>'messaging_available')::boolean then raise exception 'FAIL reciprocal block';end if;
 if (public.marketplace_messenger_state(current_setting('test.chat')::uuid)->>'blocked_by_me')::boolean then raise exception 'FAIL incorrect block owner';end if;
 begin insert into public.marketplace_messages(conversation_id,sender_id,body) values(current_setting('test.chat')::uuid,auth.uid(),'Harassment attempt');raise exception 'FAIL blocked recipient send';exception when insufficient_privilege then null;end;
 begin perform public.set_marketplace_handover_location(current_setting('test.chat')::uuid,'manual','Public cafe');raise exception 'FAIL blocked handover';exception when insufficient_privilege then null;end;
end;$$;
select public.set_marketplace_user_block(current_setting('test.chat')::uuid,true);
select set_config('request.jwt.claim.sub',current_setting('test.buyer'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.buyer'),'role','authenticated')::text,true);
select public.set_marketplace_user_block(current_setting('test.chat')::uuid,false);
do $$begin if (public.marketplace_messenger_state(current_setting('test.chat')::uuid)->>'messaging_available')::boolean then raise exception 'FAIL removed someone else block';end if;if exists(select 1 from public.marketplace_user_blocks) then raise exception 'FAIL block owner privacy';end if;end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.seller'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.seller'),'role','authenticated')::text,true);
select public.set_marketplace_user_block(current_setting('test.chat')::uuid,false);
insert into public.marketplace_messages(conversation_id,sender_id,body) select current_setting('test.chat')::uuid,auth.uid(),'History message '||n from generate_series(1,350)n;
do $$declare first_ids uuid[];next_ids uuid[];cut_time timestamptz;cut_id uuid;begin
 select array_agg(id) into first_ids from public.marketplace_chat_page(current_setting('test.chat')::uuid);
 select created_at,id into cut_time,cut_id from public.marketplace_chat_page(current_setting('test.chat')::uuid) order by created_at,id limit 1;
 select array_agg(id) into next_ids from public.marketplace_chat_page(current_setting('test.chat')::uuid,cut_time,cut_id);
 if cardinality(first_ids)<>50 or cardinality(next_ids)<>50 or first_ids&&next_ids then raise exception 'FAIL history pagination';end if;
end;$$;
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.outsider'),'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
do $$begin
 if exists(select 1 from public.marketplace_messages where conversation_id=current_setting('test.chat')::uuid) then raise exception 'FAIL private message leak';end if;
 if exists(select 1 from public.marketplace_chat_reads) then raise exception 'FAIL private receipt leak';end if;
 if exists(select 1 from public.marketplace_messenger_summary()) then raise exception 'FAIL private inbox leak';end if;
 begin perform public.marketplace_messenger_state(current_setting('test.chat')::uuid);raise exception 'FAIL outsider state';exception when insufficient_privilege then null;end;
 begin perform public.marketplace_chat_page(current_setting('test.chat')::uuid);raise exception 'FAIL outsider history';exception when insufficient_privilege then null;end;
 begin perform public.set_marketplace_user_block(current_setting('test.chat')::uuid,true);raise exception 'FAIL outsider block';exception when insufficient_privilege then null;end;
 begin perform public.mark_marketplace_chat_read(current_setting('test.chat')::uuid,current_setting('test.message')::uuid);raise exception 'FAIL outsider receipt';exception when insufficient_privilege then null;end;
 begin perform public.marketplace_pair_blocked(current_setting('test.buyer')::uuid,current_setting('test.seller')::uuid);raise exception 'FAIL private helper';exception when insufficient_privilege then null;end;
 begin insert into public.marketplace_user_blocks(blocker_id,blocked_id) values(auth.uid(),current_setting('test.buyer')::uuid);raise exception 'FAIL direct block bypass';exception when insufficient_privilege then null;end;
end;$$;
set local role anon;
do $$begin
 begin perform public.marketplace_messenger_summary();raise exception 'FAIL anonymous inbox';exception when insufficient_privilege then null;end;
 begin perform public.marketplace_chat_page(current_setting('test.chat')::uuid);raise exception 'FAIL anonymous thread';exception when insufficient_privilege then null;end;
end;$$;
select 'PASS: two-way messages, unread/read receipts, server timestamps, pair-wide blocks, independent unblocking, private history pagination and outsider/anonymous restrictions; all fixtures rolled back' as verification;
rollback;
