import {afterEach,expect,it,vi} from 'vitest';
vi.mock('./src/lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'STAFF_SESSION'}}})}}}));
import {fetchSharedGoogleInsights} from './src/utils/sharedGoogleMetrics';
afterEach(()=>vi.unstubAllGlobals());
it('never treats a background refresh with an old location as a shop setting change',async()=>{
 const f=vi.fn(async(_url,init:any)=>({ok:true,json:async()=>({connected:true,canManage:true,locationName:'locations/new',connectionVersion:'new',hasData:true,metrics:{calls:8}})}));vi.stubGlobal('fetch',f);
 const report=await fetchSharedGoogleInsights('locations/old');expect(report?.locationName).toBe('locations/new');expect(f.mock.calls.length).toBe(1);expect(f.mock.calls[0][1].method).toBe('GET');
});
