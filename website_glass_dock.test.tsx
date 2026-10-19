import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {WebsiteDock} from './src/components/WebsiteDock';
afterEach(cleanup);
it('provides all eight labelled glass destinations and opens membership',()=>{
 const navigate=vi.fn(),member=vi.fn();
 const {container}=render(<WebsiteDock activePage="home" onNavigate={navigate} onMember={member}/>);
 for(const name of ['Home','Marketplace','Sell','Gallery','FAQs','Location','Join the Team','Member ID / Join Us']) expect(screen.getByRole('button',{name,exact:true})).toBeTruthy();
 expect(container.querySelectorAll('.stakeys-glass-dock-icon').length).toBe(8);
 fireEvent.click(screen.getByRole('button',{name:'Location',exact:true}));expect(navigate).toHaveBeenCalledWith('visit');
 fireEvent.click(screen.getByRole('button',{name:'Member ID / Join Us',exact:true}));expect(member).toHaveBeenCalledOnce();
});
