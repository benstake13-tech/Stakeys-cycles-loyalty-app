import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
const shop=vi.hoisted(()=>({currentUser:{uid:'admin',displayName:'Ben Admin',membershipNumber:'STAFF',email:'admin@example.com',role:'admin',stamps:0,tickets:0,points:0,bikes:[],avatarColor:JSON.stringify({clothing:'wizard'})},bookings:[],updateCustomerAvatar:vi.fn(async()=>{})}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>shop}));
vi.mock('./src/components/WeatherForecast',()=>({WeatherForecast:()=>null}));
vi.mock('./src/components/weather/WeatherForecast',()=>({WeatherForecast:()=>null}));
import {CustomerPortal} from './src/components/CustomerPortal';
import {AvatarEditorModal} from './src/components/AvatarEditorModal';
describe('customer avatar editor ownership',()=>{
 it('discards the previous account’s wardrobe history on an account switch',async()=>{
  const view=render(<CustomerPortal/>);fireEvent.click(screen.getByRole('button',{name:'Edit your avatar'}));
  fireEvent.click(screen.getByRole('button',{name:'Clothing'}));
  fireEvent.click(screen.getByRole('button',{name:'Workshop Chef'}));
  shop.currentUser={...shop.currentUser,uid:'customer',displayName:'Ben Customer',email:'benstake13@gmail.com',role:'customer',membershipNumber:'153',avatarColor:JSON.stringify({clothing:'hoodie'})};
  view.rerender(<CustomerPortal/>);
  fireEvent.click(screen.getByRole('button',{name:'Clothing'}));
  expect(screen.getByRole('button',{name:'Workshop Chef'}).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'Apply Avatar'}));
  await waitFor(()=>expect(shop.updateCustomerAvatar).toHaveBeenCalledTimes(1));
  const [config,uid]=shop.updateCustomerAvatar.mock.calls[0] as unknown as [string,string];
  expect(JSON.parse(config).clothing).toBe('hoodie');expect(uid).toBe('customer');
 });
 it('shows save failures in the editor and prevents duplicate pending saves',async()=>{
  let reject!:(e:Error)=>void;const onSave=vi.fn(()=>new Promise<void>((_resolve,fail)=>{reject=fail;}));
  render(<AvatarEditorModal name="Ben" onClose={vi.fn()} onSave={onSave}/>);
  fireEvent.click(screen.getByRole('button',{name:'Apply Avatar'}));
  const save=screen.getByRole('button',{name:'Saving avatar…'}) as HTMLButtonElement;
  expect(save.disabled).toBe(true);fireEvent.click(save);expect(onSave).toHaveBeenCalledTimes(1);
  reject(new Error('Could not save your avatar.'));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/Could not save/));
  expect((screen.getByRole('button',{name:'Apply Avatar'}) as HTMLButtonElement).disabled).toBe(false);
 });
});
