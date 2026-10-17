import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({seasonalTheme:'none'}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>state}));
vi.mock('./src/components/ThemeToggle',()=>({ThemeToggle:()=>null}));
import { LoginScreen } from './src/components/LoginScreen';
afterEach(cleanup);
describe('login background photography',()=>{
 it.each(['customer','staff'] as const)('keeps the workshop photo and real logo on the %s login with the seasonal shop scene',audience=>{
  state.seasonalTheme='halloween';const view=render(<LoginScreen audience={audience}/>);
  expect(view.container.querySelectorAll('img[src*="hero_workshop"]').length).toBe(2);
  expect(view.container.querySelectorAll('img[src$="logo.svg"]').length).toBe(3);
  expect(view.container.querySelector('.seasonal-theme-active')).toBeTruthy();
  state.seasonalTheme='none';view.rerender(<LoginScreen audience={audience}/>);
  expect(view.container.querySelectorAll('img[src*="hero_workshop"]').length).toBe(2);
 });
});
