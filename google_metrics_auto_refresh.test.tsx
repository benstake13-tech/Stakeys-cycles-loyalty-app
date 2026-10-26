import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({report:null as any,load:vi.fn(),link:vi.fn(),remove:vi.fn()}));
vi.mock('./src/utils/oauthService',()=>({OAUTH_PROVIDERS:{google:{label:'Google Business Profile',clientIdEnv:'VITE_GOOGLE_CLIENT_ID'},meta:{label:'Meta'}},isProviderConfigured:()=>true,getStoredToken:()=>null,isTokenExpired:()=>true,disconnectProvider:vi.fn(),startOAuthPopup:vi.fn()}));
vi.mock('./src/utils/businessInsights',()=>({fetchInsights:vi.fn(),refreshServerManaged:async()=>{},isServerManaged:()=>false}));
vi.mock('./src/utils/sharedGoogleMetrics',()=>({fetchSharedGoogleInsights:h.load,linkSharedGoogle:h.link,disconnectSharedGoogle:h.remove}));
import {BusinessPerformanceTab} from './src/components/BusinessPerformanceTab';
beforeEach(()=>{vi.useFakeTimers();h.load.mockReset();h.report={provider:'google',connected:true,live:true,shared:true,canManage:false,accountLabel:'Stakeys',windowLabel:'Last 28 complete days',updatedAt:'2026-10-26T10:00:00Z',metrics:[{label:'Website Clicks',value:'42'}]};h.load.mockImplementation(async()=>h.report);});
afterEach(()=>{cleanup();vi.useRealTimers();});
const flush=()=>act(async()=>{await Promise.resolve();await Promise.resolve();});
it('loads shared Google metrics directly without any browser Google connection and refreshes automatically',async()=>{
 render(<BusinessPerformanceTab googleOnly/>);await flush();expect(screen.getByText('42')).toBeTruthy();expect(screen.getByText(/updated/i)).toBeTruthy();
 h.report={...h.report,metrics:[{label:'Website Clicks',value:'49'}]};await act(async()=>{await vi.advanceTimersByTimeAsync(5*60*1000)});expect(screen.getByText('49')).toBeTruthy();expect(screen.queryByText('Authorise with Google')).toBeNull();
});
it('retains successful figures during refresh failure and retries on returning online',async()=>{
 render(<BusinessPerformanceTab googleOnly/>);await flush();h.load.mockRejectedValueOnce(new Error('Network unavailable'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(5*60*1000)});expect(screen.getByText('42')).toBeTruthy();expect(screen.getByText(/Network unavailable/)).toBeTruthy();
 h.report={...h.report,metrics:[{label:'Website Clicks',value:'50'}]};fireEvent(window,new Event('online'));await flush();expect(screen.getByText('50')).toBeTruthy();
});
it('does not keep polling after the view closes',async()=>{
 const v=render(<BusinessPerformanceTab googleOnly/>);await flush();const count=h.load.mock.calls.length;v.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(10*60*1000)});expect(h.load.mock.calls.length).toBe(count);
});
it('clears saved figures when the shared account is disconnected from another device',async()=>{
 h.report={...h.report,connectionId:'account-a',locationName:'locations/1'};render(<BusinessPerformanceTab googleOnly/>);await flush();expect(screen.getByText('42')).toBeTruthy();
 h.report={provider:'google',connected:false,live:false,shared:false,canManage:false,windowLabel:'Last 28 days',metrics:[],message:'Ask the administrator to connect Google.'};
 fireEvent(window,new Event('online'));await flush();expect(screen.queryByText('42')).toBeNull();
});
it('does not retain a previous account or location when the new report is empty',async()=>{
 h.report={...h.report,connectionId:'account-a',locationName:'locations/1'};render(<BusinessPerformanceTab googleOnly/>);await flush();
 h.report={...h.report,connectionId:'account-b',locationName:'locations/2',metrics:[],live:false,message:'Google has not returned data yet.'};
 fireEvent(window,new Event('online'));await flush();expect(screen.queryByText('42')).toBeNull();
});
