import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({native:false,user:null as any,error:null as any,select:vi.fn(),eq:vi.fn(),invoke:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native}}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>({currentUser:state.user})}));
vi.mock('react-hot-toast',()=>({default:{error:vi.fn(),success:vi.fn()}}));
vi.mock('./src/lib/supabase',()=>({supabase:{from:()=>{
 const query:any={select:(columns:string)=>{state.select(columns);return query;},order:()=>query,eq:(...args:any[])=>{state.eq(...args);return query;},or:()=>query,in:()=>query,then:(resolve:any)=>resolve({data:[{id:'listing-1',title:'Local bike',make_model:'Trek FX',category:'bicycle',condition:'good',asking_price:200,status:'active',images:[]}],error:state.error})};return query;
},storage:{from:()=>({createSignedUrls:vi.fn()})},functions:{invoke:state.invoke}}}));
import { MarketplacePanel } from './src/components/MarketplacePanel';
beforeEach(()=>{cleanup();vi.clearAllMocks();state.native=false;state.user=null;state.error=null;window.history.replaceState({},'','/');});
describe('marketplace public and installed app access',()=>{
 it('lets visitors browse approved listings without a login screen or exposed seller id',async()=>{
  render(<MarketplacePanel/>);
  expect(await screen.findByText('Local bike')).toBeTruthy();
  expect(state.select.mock.calls[0][0]).not.toContain('seller_id');
  expect(state.eq).toHaveBeenCalledWith('status','active');
  fireEvent.click(screen.getByRole('button',{name:'List your ride'}));
  expect(screen.getByText('Browse here. Buy and sell in the app.')).toBeTruthy();
  expect(screen.queryByTestId('marketplace-listing-form')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Use the app to buy'}));
  expect(state.invoke).not.toHaveBeenCalled();
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
 });
 it('reports backend failures rather than claiming the marketplace has no listings',async()=>{
  state.error={message:'network'};render(<MarketplacePanel/>);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No approved listings yet')).toBeNull();
 });
});
