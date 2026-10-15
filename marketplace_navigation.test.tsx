import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';
vi.mock('./src/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({error:null,data:null}) }) }) }) }, getSupabaseClient: () => ({}), AUTH_LINK_ON_LOAD:false }));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({currentUser:null,theme:'dark',promotions:[],discountCodes:[],recordDiscountUsage:vi.fn()}) }));
vi.mock('./src/context/WebsiteContentStore', () => ({useWebsiteContent: () => DEFAULT_WEBSITE_CONTENT}));
vi.mock('./src/components/MarketplacePanel', () => ({MarketplacePanel: () => <section aria-label="Local marketplace">Approved marketplace listings</section>}));
vi.mock('./src/api/visionService', () => ({isBikeVisionConfigured:()=>false,diagnoseFault:vi.fn()}));
import { WebsiteReplica } from './src/components/WebsiteReplica';
beforeEach(()=>{cleanup();localStorage.clear();window.history.replaceState({},'','/');});
describe('public marketplace navigation',()=>{
 it('opens marketplace from the public menu and keeps the shop and sell pages',()=>{
  render(<WebsiteReplica context="public" onBookService={vi.fn()}/>);
  const links=screen.getAllByRole('button',{name:'Marketplace'});
  fireEvent.click(links[0]);
  expect(screen.getByRole('region',{name:'Local marketplace'})).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button',{name:/^Shop/})[0]);
  expect(screen.getAllByText(/Sell your bike/i).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button',{name:/Shop/}).length).toBeGreaterThan(0);
 });
 it('restores shareable marketplace links instead of silently showing the homepage',()=>{
  window.history.replaceState({},'','/?page=marketplace');
  render(<WebsiteReplica context="public" onBookService={vi.fn()}/>);
  expect(screen.getByRole('region',{name:'Local marketplace'})).toBeTruthy();
 });
});
