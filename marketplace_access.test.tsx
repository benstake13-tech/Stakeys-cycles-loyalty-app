import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({native:false,user:null as any,error:null as any,select:vi.fn(),eq:vi.fn(),invoke:vi.fn(),milestone:vi.fn(),mutationError:null as any,status:'active',updated:null as any,bulkFilter:null as any,bulkFilters:[] as any[]}));
vi.mock('./src/utils/milestoneAnimations',()=>({announceMilestone:state.milestone}));
vi.mock('./src/components/AiBikeIdentifier',()=>({AiBikeIdentifier:(props:any)=>props.isOpen?<button type="button" onClick={()=>props.onIdentified({make:'Trek',model:'FX 3',year:2024,type:'cycle',confidence:.92,coverage:84,hasVisualData:true,usedFallback:false,mainSpecs:[{componentName:'Brakes',currentPart:'Shimano hydraulic disc'}],obviousProblems:[],faults:[],photoRequests:[],notVisible:[]})}>Use AI results for listing</button>:null}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native}}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>({currentUser:state.user})}));
vi.mock('react-hot-toast',()=>({default:{error:vi.fn(),success:vi.fn()}}));
vi.mock('./src/lib/supabase',()=>({supabase:{from:(table:string)=>{
 const mutation:any={eq:async()=>{if(!state.mutationError) state.status=state.updated.status;return {error:state.mutationError};},in:(...args:any[])=>{state.bulkFilter=args;state.bulkFilters.push(args);if(!state.mutationError&&state.updated?.status==='cancelled')state.status='cancelled';return mutation;},select:()=>mutation,then:(resolve:any)=>resolve({data:state.mutationError?null:[{id:'listing-1'}],error:state.mutationError})};
 const query:any={update:(values:any)=>{state.updated=values;return mutation;},select:(columns:string)=>{state.select(columns);return query;},order:()=>query,limit:()=>query,eq:(...args:any[])=>{state.eq(...args);return query;},or:()=>query,in:(...args:any[])=>{if(state.updated)state.bulkFilter=args;return query;},then:(resolve:any)=>resolve({data:table==='marketplace_transactions'?[]:[{id:'listing-1',title:'Local bike',make_model:'Trek FX',category:'bicycle',subcategory:'commuter',condition:'good',asking_price:200,status:state.status,images:[]}],error:state.error})};return query;
},storage:{from:()=>({createSignedUrls:vi.fn()})},functions:{invoke:state.invoke}}}));
import { MarketplacePanel } from './src/components/MarketplacePanel';
beforeEach(()=>{cleanup();vi.clearAllMocks();state.native=false;state.user=null;state.error=null;state.mutationError=null;state.status='active';state.updated=null;state.bulkFilter=null;state.bulkFilters=[];window.history.replaceState({},'','/');});
describe('marketplace public and installed app access',()=>{
 it('lets visitors browse approved listings without a login screen or exposed seller id',async()=>{
  render(<MarketplacePanel/>);
  expect(await screen.findByText('Local bike')).toBeTruthy();
  expect(state.select.mock.calls[0][0]).not.toContain('seller_id');
  expect(state.eq).toHaveBeenCalledWith('status','active');
  fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  expect(screen.getByText('Browse here. Buy and sell in the app.')).toBeTruthy();
  expect(screen.queryByTestId('marketplace-listing-form')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Use the app to message seller'}));
  expect(state.invoke).not.toHaveBeenCalled();
 });
 it('groups marketplace browsing by bicycle, e-bike and scooter categories',async()=>{
  render(<MarketplacePanel/>);
  expect(await screen.findByText('Local bike')).toBeTruthy();
  const categoryNav=screen.getByRole('navigation',{name:'Filter marketplace by vehicle category'});
  expect(categoryNav).toBeTruthy();
  expect(screen.getByRole('button',{name:/Commuter/})).toBeTruthy();
  expect(screen.getByRole('button',{name:/Hardtail MTB/})).toBeTruthy();
  expect(screen.getByRole('button',{name:/E-bikes/})).toBeTruthy();
  expect(screen.getByRole('button',{name:/E-scooters/})).toBeTruthy();
  expect(screen.getByRole('button',{name:/Parts/})).toBeTruthy();
  expect(screen.getByRole('button',{name:/Accessories/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Hardtail MTB/}));
  expect(screen.getByText('No hardtail mtb to show')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Commuter/}));
  expect(screen.getByText('Local bike')).toBeTruthy();
 });
 it('searches real listings by title, make or model',async()=>{
  render(<MarketplacePanel/>);
  expect(await screen.findByText('Local bike')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search marketplace listings'),{target:{value:'not listed'}});
  expect(screen.getByText('No all listings to show')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search marketplace listings'),{target:{value:'Trek'}});
  expect(screen.getByText('Local bike')).toBeTruthy();
 });
 it('opens a photo-led listing detail view with clear seller-supplied data labels',async()=>{
  render(<MarketplacePanel/>);
  fireEvent.click(await screen.findByRole('button',{name:'View details for Local bike'}));
  const dialog=screen.getByRole('dialog',{name:'Local bike'});
  expect(dialog).toBeTruthy();
  expect(screen.getByText('Listing detail · seller supplied')).toBeTruthy();
  expect(screen.getByText(/not an independent condition inspection or a BikeRegister\/HPI certificate/i)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Close listing details'}));
  expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('does not expose browser listing forms through an existing web session',async()=>{
  state.user={uid:'seller-1'};render(<MarketplacePanel/>);
  await screen.findByText('Local bike');
  fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  expect(screen.queryByTestId('marketplace-listing-form')).toBeNull();
 });
 it('keeps listing creation available inside the signed-in APK',async()=>{
  state.native=true;state.user={uid:'seller-1'};render(<MarketplacePanel/>);
  await screen.findByText('Local bike');fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  expect(screen.getByTestId('marketplace-listing-form')).toBeTruthy();
  expect((screen.getByLabelText(/Frame serial number/) as HTMLInputElement).required).toBe(true);
  expect((screen.getByLabelText(/Clear frame-number photo/) as HTMLInputElement).required).toBe(true);
 });
 it('offers staff-reviewed parts listings without bypassing vehicle serial checks',async()=>{
  state.native=true;state.user={uid:'seller-1'};render(<MarketplacePanel/>);
  await screen.findByText('Local bike');fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  fireEvent.change(screen.getByLabelText('Type'),{target:{value:'parts'}});
  expect(screen.queryByLabelText(/Frame serial number/)).toBeNull();
  expect(screen.queryByLabelText(/Clear frame-number photo/)).toBeNull();
  expect(screen.getByRole('button',{name:'Submit part for review'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Type'),{target:{value:'bicycle'}});
  expect((screen.getByLabelText(/Frame serial number/) as HTMLInputElement).required).toBe(true);
 });
 it('offers accessories without requesting a vehicle serial or serial photo',async()=>{
  state.native=true;state.user={uid:'seller-1'};render(<MarketplacePanel/>);
  await screen.findByText('Local bike');fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  fireEvent.change(screen.getByLabelText('Type'),{target:{value:'accessories'}});
  expect(screen.queryByLabelText(/Frame serial number/)).toBeNull();
  expect(screen.getByRole('button',{name:'Submit accessory for review'})).toBeTruthy();
 });
 it('requires the guided AI identifier and fills the listing from its result',async()=>{
  state.native=true;state.user={uid:'seller-1'};render(<MarketplacePanel/>);
  await screen.findByText('Local bike');fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  fireEvent.click(screen.getByRole('button',{name:'Identify bike with AI'}));
  fireEvent.click(screen.getByRole('button',{name:'Use AI results for listing'}));
  const makeModel=screen.getByLabelText(/Make and model/) as HTMLInputElement;
  expect(makeModel.value).toBe('Trek FX 3');
  expect(makeModel.readOnly).toBe(false);
  fireEvent.change(makeModel,{target:{value:'Trek FX 3 (seller corrected)'}});
  expect(makeModel.value).toBe('Trek FX 3 (seller corrected)');
  expect(screen.getByText(/1 component records · 84% spec coverage · 92% identity confidence/)).toBeTruthy();
 });
 it('uses distinct approval and sale overlays only after successful moderation',async()=>{
  state.user={uid:'staff-1'};state.status='pending_approval';render(<MarketplacePanel staff/>);
  fireEvent.click(await screen.findByRole('button',{name:'Approve listing'}));
  await waitFor(()=>expect(state.milestone).toHaveBeenCalledWith(expect.objectContaining({kind:'listing',title:'Listing approved',scope:'staff-1'})));
  fireEvent.click(await screen.findByRole('button',{name:'Mark sold'}));
  await waitFor(()=>expect(state.milestone).toHaveBeenCalledWith(expect.objectContaining({kind:'sale',title:'Sale recorded'})));
 });
 it('does not celebrate failed writes',async()=>{
  state.user={uid:'staff-1'};state.status='pending_approval';state.mutationError={message:'denied'};render(<MarketplacePanel staff/>);
  fireEvent.click(await screen.findByRole('button',{name:'Approve listing'}));
  await waitFor(()=>expect(state.milestone).not.toHaveBeenCalled());
 });
 it('archives only open listings after confirmation, retains history, and offers restore',async()=>{
  state.user={uid:'staff-1',role:'staff'};const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);render(<MarketplacePanel staff/>);
  fireEvent.click(await screen.findByRole('button',{name:'Archive open listings (1)'}));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Sold listings and payment/payout history will stay untouched.'));
  await waitFor(()=>expect(state.updated).toEqual({status:'cancelled'}));
  expect(state.bulkFilters).toContainEqual(['status',['pending_approval','pending_review','active']]);
  const restoreButtons=await screen.findAllByRole('button',{name:'Restore for review'});expect(restoreButtons.length).toBeGreaterThan(0);fireEvent.click(restoreButtons[0]);
  await waitFor(()=>expect(state.updated).toEqual({status:'pending_approval'}));confirm.mockRestore();
 });
 it('does not archive listings if the confirmation is declined',async()=>{
  state.user={uid:'staff-1',role:'staff'};const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);render(<MarketplacePanel staff/>);
  fireEvent.click(await screen.findByRole('button',{name:'Archive open listings (1)'}));
  expect(confirm).toHaveBeenCalled();expect(state.updated).toBeNull();confirm.mockRestore();
 });
 it('lets signed-in app customers start a seller conversation before agreeing a price',async()=>{
  state.native=true;state.user={uid:'customer-1'};render(<MarketplacePanel/>);
  expect(await screen.findByRole('button',{name:'Message seller and agree sale'})).toBeTruthy();expect(state.invoke).not.toHaveBeenCalled();
 });
 it('reports backend failures rather than claiming the marketplace has no listings',async()=>{
  state.error={message:'network'};render(<MarketplacePanel/>);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No approved listings yet')).toBeNull();
 });
});
