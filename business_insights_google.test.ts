import {afterEach,expect,it,vi} from 'vitest';
vi.mock('./src/utils/oauthService',()=>({getValidAccessToken:async()=> 'token'}));
import {fetchGoogleInsights} from './src/utils/businessInsights';
afterEach(()=>vi.unstubAllGlobals());
const json=(data:any,ok=true)=>({ok,json:async()=>data});
it('requires selection for multiple businesses and reads the selected location',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url,init:any)=>{
 const b=JSON.parse(init.body);
 if(b.path==='accounts')return json({accounts:[{name:'accounts/1'}],locations:[{name:'locations/1',title:'Other shop'},{name:'locations/2',title:'Stakeys'}]});
 return json({metrics:{websiteClicks:42,calls:8,messagingClicks:0},hasData:true,period:{start:'2026-09-28',end:'2026-10-25'}});
 }));
 expect((await fetchGoogleInsights()).metrics).toEqual([]);
 const result=await fetchGoogleInsights('locations/2');expect(result.accountLabel).toBe('Stakeys');
 const m=Object.fromEntries(result.metrics.map(x=>[x.label,x.value]));expect(m['Website Clicks']).toBe('42');expect(m['Calls']).toBe('8');expect(m['Messaging Clicks']).toBe('0');expect(m['Profile Views']).toBe('—');
});
it('shows the real permission failure instead of pretending the location has no activity',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url,init:any)=>JSON.parse(init.body).path==='accounts'?json({locations:[{name:'locations/1'}]}):json({error:{message:'API access not enabled'}},false)));
 const result=await fetchGoogleInsights();expect(result.live).toBe(false);expect(result.message).toContain('API access not enabled');expect(result.metrics).toEqual([]);
});
