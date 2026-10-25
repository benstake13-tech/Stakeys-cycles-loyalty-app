import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {WebsiteDock} from './src/components/WebsiteDock';
afterEach(cleanup);
it('provides all eight labelled glass destinations and opens membership',()=>{
 const navigate=vi.fn(),member=vi.fn();
 const {container}=render(<WebsiteDock activePage="home" onNavigate={navigate} onMember={member}/>);
 for(const name of ['Home','Marketplace','Sell','Gallery','FAQs','Location','Join the Team','Member ID / Join Us']) expect(screen.getByRole('button',{name})).toBeTruthy();
 expect(container.querySelectorAll('svg').length).toBe(9);
 expect(container.querySelector('.stakeys-glass-dock-icon')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Location'}));expect(navigate).toHaveBeenCalledWith('visit');
 fireEvent.click(screen.getByRole('button',{name:'Member ID / Join Us'}));expect(member).toHaveBeenCalledOnce();
});
