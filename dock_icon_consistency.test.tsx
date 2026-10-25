import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StaffDockIcon } from './src/components/staff/StaffDockIcons';
afterEach(cleanup);
describe('staff dock icon consistency',()=>{
  it.each(['home','sync','till','workshop','stock','sales','more'] as const)('renders %s with the same readable vector system',id=>{
    const {container}=render(<StaffDockIcon id={id}/>);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('.glass-dock-art')).toBeNull();
  });
});
