import React from 'react';
import { describe,it,expect,afterEach,beforeEach,vi } from 'vitest';
import {render,fireEvent,cleanup,screen,act} from '@testing-library/react';
const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./src/lib/supabase', () => ({ supabase: { rpc: backend.rpc } }));
import {WORLD_CATALOG,worldFor} from './src/components/theme/worldCatalog';
import {HOLIDAY_THEME_IDS} from './src/utils/holidayCalendar';
import {ThemeWorld,ThemeMotionControl} from './src/components/theme/ThemeWorld';
afterEach(()=>{cleanup();localStorage.clear();});
beforeEach(()=>backend.rpc.mockReset());
describe('seasonal worlds',()=>{
 it('covers every calendar holiday and leaves unknown themes empty',()=>{
  expect(Object.keys(WORLD_CATALOG).sort()).toEqual([...HOLIDAY_THEME_IDS].sort());
  expect(worldFor('none')).toBeNull();expect(worldFor('missing')).toBeNull();
  for(const id of HOLIDAY_THEME_IDS)expect(worldFor(id)?.label).toBeTruthy();
 });
 it('renders bounded effects and synchronizes device motion preferences',()=>{
  const view=render(<><ThemeWorld theme="christmas" preview/><ThemeMotionControl/></>);
  expect(view.container.querySelectorAll('.theme-particles i').length).toBe(16);
  fireEvent.click(view.getByText('Full effects'));
  expect(view.container.querySelectorAll('.theme-particles i').length).toBe(32);
  fireEvent.click(view.getByText('Still image'));
  expect(view.container.querySelector('.theme-world')?.getAttribute('data-motion')).toBe('still');
 });
 it('keeps remembrance scenes free of celebration particles',()=>{
  const view=render(<ThemeWorld theme="remembranceday"/>);
  expect(view.container.querySelector('.theme-particles')).toBeNull();
 });
 it('tracks the 75-tap Easter hunt and reveals the awarded code',async()=>{
  let taps=0;
  backend.rpc.mockImplementation(async(name:string)=>{
   if(name==='get_easter_hunt_progress')return {data:[{tap_count:0,completed:false,discount_code:null}],error:null};
   taps++;
   return {data:[{tap_count:taps,completed:taps===75,discount_code:taps===75?'EASTER-12AB34CD':null}],error:null};
  });
  render(<ThemeWorld theme="easter" huntEnabled huntUserId="customer-1"/>);
  fireEvent.click(screen.getByRole('button',{name:'Explore Easter seasonal scene'}));
  await screen.findByText('0/75');
  for(let i=0;i<75;i++){
   await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/Tap the bunny/}));await Promise.resolve();});
  }
  expect(screen.getAllByText('EASTER-12AB34CD')).toHaveLength(2);
  expect(screen.getByText(/1 stamp, 50 points, 2 prize draw entries/)).toBeTruthy();
  expect(screen.getByRole('dialog',{name:'Happy Easter!'})).toBeTruthy();
  expect(screen.getByText('£5 off',{exact:true})).toBeTruthy();
  expect(backend.rpc).toHaveBeenCalledTimes(76);
 });
});
