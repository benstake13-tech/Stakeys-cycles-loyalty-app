import React from 'react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const state=vi.hoisted(()=>({status:'new',fail:false,update:vi.fn()}));
vi.mock('./src/lib/supabase',()=>({supabase:{from:()=>{
 const q:any={select:()=>q,order:()=>q,limit:async()=>({data:[{id:'offer',donor_name:'Alex Rider',email:'alex@example.test',phone:'',postcode:'M1',bike_details:'Hybrid bicycle',condition:'needs_repairs',notes:'Brake adjustment needed',status:state.status,created_at:'2026-10-19T12:00:00Z'}],error:null}),update:(value:any)=>{state.update(value);return {eq:()=>({select:async()=>{if(state.fail)return {error:{message:'offline'}};state.status=value.status;return {data:[{id:'offer'}],error:null};}})};}};return q;
}}}));
import {BikeDonationInbox} from './src/components/BikeDonationInbox';
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();state.status='new';state.fail=false;});
it('lets staff follow a saved donor offer through refurbishment',async()=>{render(<BikeDonationInbox/>);await screen.findByText('Hybrid bicycle');expect(screen.getByText(/Alex Rider · alex@example.test/)).toBeTruthy();fireEvent.change(screen.getByRole('combobox'),{target:{value:'refurbishing'}});await waitFor(()=>expect(state.update).toHaveBeenCalledWith({status:'refurbishing'}));await waitFor(()=>expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('refurbishing'));});
it('does not show a failed status change as saved',async()=>{state.fail=true;render(<BikeDonationInbox/>);await screen.findByText('Hybrid bicycle');fireEvent.change(screen.getByRole('combobox'),{target:{value:'donated'}});await screen.findByRole('alert');expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('new');});
