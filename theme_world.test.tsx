import React from 'react';
import { describe,it,expect,afterEach } from 'vitest';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {WORLD_CATALOG,worldFor} from './src/components/theme/worldCatalog';
import {HOLIDAY_THEME_IDS} from './src/utils/holidayCalendar';
import {ThemeWorld,ThemeMotionControl} from './src/components/theme/ThemeWorld';
afterEach(()=>{cleanup();localStorage.clear();});
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
});
