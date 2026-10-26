import React from 'react';
import {render,screen,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
vi.mock('./src/utils/oauthService',()=>({OAUTH_PROVIDERS:{google:{label:'Google Business Profile',clientIdEnv:'VITE_GOOGLE_CLIENT_ID'},meta:{label:'Meta'}},isProviderConfigured:()=>true,getStoredToken:()=>({refreshToken:'refresh',expiresAt:0}),isTokenExpired:()=>true,disconnectProvider:vi.fn(),startOAuthPopup:vi.fn()}));
vi.mock('./src/utils/businessInsights',()=>({refreshServerManaged:async()=>{},isServerManaged:()=>false,fetchInsights:async()=>({provider:'google',connected:true,live:true,windowLabel:'Last 28 days',accountLabel:'Stakeys',metrics:[{label:'Website Clicks',value:'42'},{label:'Calls',value:'8'}]})}));
import {GoogleBusinessTab} from './src/components/GoogleBusinessTab';
it('shows Google performance in the dedicated app screen and refreshes saved connections',async()=>{
 render(<GoogleBusinessTab/>);await waitFor(()=>expect(screen.getByText('Website Clicks')).toBeTruthy());expect(screen.getByText('42')).toBeTruthy();expect(screen.queryByText('Meta')).toBeNull();expect(screen.getByText(/call-button clicks/i)).toBeTruthy();
});
