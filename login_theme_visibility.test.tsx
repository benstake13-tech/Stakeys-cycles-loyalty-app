import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({seasonalTheme:'none'}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>state}));
vi.mock('./src/components/ThemeToggle',()=>({ThemeToggle:()=>null}));
import { LoginScreen } from './src/components/LoginScreen';
afterEach(cleanup);
describe('login background photography',()=>{
 it.each(['customer','staff'] as const)('hides all workshop backdrops while the %s theme is enabled and restores them when disabled',audience=>{
  state.seasonalTheme='halloween';const view=render(<LoginScreen audience={audience}/>);
  expect(view.container.querySelectorAll('img[src*="hero_workshop"]').length).toBe(0);
  expect(view.container.querySelector('main')?.style.background).toBe('transparent');
  state.seasonalTheme='none';view.rerender(<LoginScreen audience={audience}/>);
  expect(view.container.querySelectorAll('img[src*="hero_workshop"]').length).toBe(2);
 });
});
