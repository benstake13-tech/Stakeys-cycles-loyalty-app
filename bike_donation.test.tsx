import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const state=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('./src/lib/supabase',()=>({supabase:{rpc:state.rpc}}));
vi.mock('./src/context/ShopContext',()=>({useShop:()=>({currentUser:null})}));
import {BikeDonationSection} from './src/components/BikeDonationSection';
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();state.rpc.mockResolvedValue({error:null});});
function fill(){fireEvent.click(screen.getByRole('button',{name:'Offer a bike to donate'}));fireEvent.change(screen.getByLabelText('Donor name'),{target:{value:'Alex Rider'}});fireEvent.change(screen.getByLabelText('Contact email'),{target:{value:'alex@example.test'}});fireEvent.change(screen.getByLabelText('Bicycle details'),{target:{value:'Adult hybrid bicycle'}});fireEvent.click(screen.getByRole('checkbox'));}
it('saves a donation to the workshop with consent and confirms only after success',async()=>{render(<BikeDonationSection/>);fill();fireEvent.submit(screen.getByRole('form',{name:'Bicycle donation offer'}));await screen.findByText('Donation offer received');expect(state.rpc).toHaveBeenCalledWith('submit_bike_donation',expect.objectContaining({p_name:'Alex Rider',p_email:'alex@example.test',p_bike:'Adult hybrid bicycle',p_consent:true}));});
it('keeps a failed donation draft and reuses its request id on retry',async()=>{state.rpc.mockResolvedValueOnce({error:{message:'offline'}});render(<BikeDonationSection/>);fill();fireEvent.submit(screen.getByRole('form',{name:'Bicycle donation offer'}));await screen.findByRole('alert');expect((screen.getByLabelText('Bicycle details') as HTMLInputElement).value).toBe('Adult hybrid bicycle');expect(screen.queryByText('Donation offer received')).toBeNull();fireEvent.submit(screen.getByRole('form',{name:'Bicycle donation offer'}));await waitFor(()=>expect(state.rpc).toHaveBeenCalledTimes(2));expect(state.rpc.mock.calls[0][1].p_id).toBe(state.rpc.mock.calls[1][1].p_id);});
