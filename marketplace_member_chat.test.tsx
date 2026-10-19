import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as any, empty: false, failSend: false, blocked:false, peerBlocked:false, preview:null as string|null, unread:0, oldHistory:false, insert: vi.fn(), rpc: vi.fn(), subscriptions: [] as any[], removeChannel: vi.fn() }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ currentUser: state.user }) }));
vi.mock('./src/components/LoginScreen', () => ({ LoginScreen: () => <div>Member sign in form</div> }));
vi.mock('./src/components/AiBikeIdentifier', () => ({ AiBikeIdentifier: () => null }));
vi.mock('./src/lib/supabase', () => ({ supabase: { channel: (name:string) => { const channel:any={on:(_event:string,filter:any,callback:any)=>{state.subscriptions.push({name,filter,callback});return channel;},subscribe:()=>channel};return channel; }, removeChannel: state.removeChannel, rpc: state.rpc, from: (table: string) => {
  const rows = table === 'marketplace_listings' ? (state.empty ? [] : [{ id:'bike',seller_id:'seller',title:'Local bike',make_model:'Trek FX',category:'bicycle',condition:'good',asking_price:200,images:[],status:'active' }])
    : table === 'marketplace_conversations' ? [{ id:'chat',listing_id:'bike',buyer_id:'buyer',seller_id:'seller',listing:{ title:'Local bike',make_model:'Trek FX',asking_price:200 } }]
    : table === 'marketplace_messages' ? [...(state.oldHistory?Array.from({length:299},(_,i)=>({id:'history-'+i,conversation_id:'chat',sender_id:'buyer',body:'Recent message '+i,created_at:'2026-10-17T11:00:00Z'})):[]),{ id:'m1',conversation_id:'chat',sender_id:'seller',body:'Would £180 work for you?',created_at:'2026-10-17T12:00:00Z' }] : [];
  const query: any = { select: () => query, eq: () => query, or: () => query, in: () => query, order: () => query, limit: () => query,
    maybeSingle: async () => ({ data: table === 'marketplace_deal_terms' ? { proposed_price:180,proposed_by:'seller',agreed_price:null } : null,error:null }),
    insert: async (value: any) => { state.insert(value); return {error:state.failSend?{message:'offline'}:null}; },
    then: (resolve: any) => resolve({data:rows,error:null}) }; return query;
}, storage: { from: () => ({ createSignedUrls: async () => ({data:[]}) }) } } }));
import { MarketplacePanel } from './src/components/MarketplacePanel';
beforeEach(() => { cleanup(); vi.clearAllMocks(); state.user=null; state.empty=false; state.failSend=false; state.subscriptions=[];state.blocked=false;state.peerBlocked=false;state.preview=null;state.unread=0;state.oldHistory=false;
state.rpc.mockImplementation(async(name:string,args:any)=>{
 if(name==='marketplace_messenger_state')return {data:{blocked_by_me:state.blocked,messaging_available:!state.blocked&&!state.peerBlocked,other_read_at:null},error:null};
 if(name==='marketplace_messenger_summary')return {data:[{conversation_id:'chat',other_name:'Local Rider',last_message:state.preview,last_message_at:null,unread_count:state.unread}],error:null};
 if(name==='set_marketplace_user_block'){state.blocked=args.p_blocked;return {data:null,error:null};}
 if(name==='marketplace_chat_page')return {data:[{id:'old-message',conversation_id:'chat',sender_id:'seller',body:'Earlier conversation',created_at:'2026-01-01T12:00:00Z'}],error:null};
 return {data:null,error:null};
}); });
describe('website marketplace members', () => {
  it('shows the complete public structure when there are no listings', async () => {
    state.empty=true;render(<MarketplacePanel/>);
    expect(await screen.findByText('No approved listings yet')).toBeTruthy();
    expect(screen.getByRole('navigation',{name:'Filter marketplace by vehicle category'})).toBeTruthy();
    const nav=screen.getByRole('navigation',{name:'Marketplace workspace'});
    fireEvent.click(within(nav).getByRole('button',{name:'Auctions'}));
    expect(screen.getByText('No auctions yet')).toBeTruthy();
    fireEvent.click(within(nav).getByRole('button',{name:'Messages'}));
    expect(screen.getByText('Your private negotiation space')).toBeTruthy();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('lets a website buyer chat while a seller offer is awaiting a response', async () => {
    state.user={uid:'buyer'}; render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('navigation',{name:'Marketplace workspace'}).querySelector('button[aria-current]')!);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    await screen.findByText('Would £180 work for you?');
    const input=screen.getByRole('textbox',{name:'Private message'}) as HTMLInputElement;
    expect(input.disabled).toBe(false);
    fireEvent.change(input,{target:{value:'Could you do £170 if I collect tomorrow?'}});
    fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith({conversation_id:'chat',sender_id:'buyer',body:'Could you do £170 if I collect tomorrow?'}));
    await waitFor(() => expect(input.value).toBe(''));
  });
  it('gives staff their own private inbox alongside marketplace management', async () => {
    state.user={uid:'buyer',role:'staff'}; render(<MarketplacePanel staff/>);
    expect(screen.getByRole('navigation',{name:'Staff marketplace workspace'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'My marketplace chats'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    expect(await screen.findByText('Would £180 work for you?')).toBeTruthy();
    expect(screen.queryByText('Marketplace sales & payout ledger')).toBeNull();
  });

  it('subscribes to only the selected thread and removes channels on sign-out', async () => {
    state.user={uid:'buyer'};const page=render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    await screen.findByText('Would £180 work for you?');
    expect(state.subscriptions.some(row=>row.filter.table==='marketplace_messages'&&row.filter.filter==='conversation_id=eq.chat')).toBe(true);
    const removes=state.removeChannel.mock.calls.length;
    state.user=null;page.rerender(<MarketplacePanel/>);
    await waitFor(()=>expect(state.removeChannel.mock.calls.length).toBeGreaterThan(removes));
  });

  it('keeps a failed message draft and clears private content after account changes', async () => {
    state.user={uid:'buyer'}; state.failSend=true; const page=render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    await screen.findByText('Would £180 work for you?');
    const input=screen.getByRole('textbox',{name:'Private message'}) as HTMLInputElement;
    fireEvent.change(input,{target:{value:'My counter offer'}}); fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await waitFor(() => expect(state.insert).toHaveBeenCalled());
    await waitFor(() => expect(input.disabled).toBe(false)); expect(input.value).toBe('My counter offer');
    state.user={uid:'unrelated-account'};page.rerender(<MarketplacePanel/>);
    expect(screen.queryByText('Would £180 work for you?')).toBeNull();
  });
  it('blocks a member across chats, keeps the history and lets the owner unblock',async()=>{
    state.user={uid:'buyer'};render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    await screen.findByText('Would £180 work for you?');
    fireEvent.click(screen.getByRole('button',{name:'Block member'}));
    fireEvent.click(screen.getByRole('button',{name:'Confirm block'}));
    await waitFor(()=>expect(state.rpc).toHaveBeenCalledWith('set_marketplace_user_block',{p_conversation_id:'chat',p_blocked:true}));
    await screen.findByRole('button',{name:'Unblock member'});
    expect((screen.getByRole('textbox',{name:'Private message'}) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Would £180 work for you?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Unblock member'}));
    await waitFor(()=>expect((screen.getByRole('textbox',{name:'Private message'}) as HTMLInputElement).disabled).toBe(false));
  });
  it('does not allow a recipient block to be bypassed by removing your own block',async()=>{
    state.user={uid:'buyer'};state.blocked=true;state.peerBlocked=true;render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    fireEvent.click(await screen.findByRole('button',{name:'Unblock member'}));
    await screen.findByRole('button',{name:'Block member'});
    expect((screen.getByRole('textbox',{name:'Private message'}) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Messaging is unavailable for this conversation.')).toBeTruthy();
  });
  it('searches names and listings and displays last-message previews',async()=>{
    state.user={uid:'buyer'};state.preview='Collection tomorrow?';render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    expect(await screen.findByText('Collection tomorrow?')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox',{name:'Search conversations'}),{target:{value:'not-found'}});
    expect(screen.queryByRole('button',{name:/Local bike.*You are buying/})).toBeNull();
    fireEvent.change(screen.getByRole('textbox',{name:'Search conversations'}),{target:{value:'Local Rider'}});
    expect(screen.getByRole('button',{name:/Local bike.*You are buying/})).toBeTruthy();
  });
  it('loads older history without dropping the latest messages',async()=>{
    state.user={uid:'buyer'};state.oldHistory=true;render(<MarketplacePanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    fireEvent.click(await screen.findByRole('button',{name:/Local bike.*You are buying/}));
    fireEvent.click(await screen.findByRole('button',{name:'Load older messages'}));
    expect(await screen.findByText('Earlier conversation')).toBeTruthy();
    expect(screen.getByText('Would £180 work for you?')).toBeTruthy();
    expect(state.rpc).toHaveBeenCalledWith('marketplace_chat_page',expect.objectContaining({p_conversation_id:'chat',p_before_created_at:'2026-10-17T11:00:00Z'}));
  });

});
