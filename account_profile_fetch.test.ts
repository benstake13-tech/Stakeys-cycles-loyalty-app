import {beforeEach,describe,it,expect,vi} from 'vitest';
const db=vi.hoisted(()=>({eq:vi.fn(),single:vi.fn()}));
vi.mock('./src/lib/supabase',()=>({getSupabaseClient:()=>({from:()=>({select:()=>({eq:db.eq})})})}));
import {fetchUserProfileFromDb} from './src/api/backendDataService';
beforeEach(()=>{vi.clearAllMocks();db.eq.mockReturnValue({maybeSingle:db.single});});
describe('authenticated avatar profile lookup',()=>{
 it('queries only the account UUID even when other contact identifiers are supplied',async()=>{
  db.single.mockResolvedValue({data:{id:'customer',avatar_color:'customer-face',role:'customer'},error:null});
  const profile=await fetchUserProfileFromDb('customer','153','benstake13@gmail.com');
  expect(db.eq).toHaveBeenCalledWith('id','customer');expect(profile?.avatarColor).toBe('customer-face');
 });
 it('does not fall back to an admin matched by email or membership when the customer row is missing',async()=>{
  db.single.mockResolvedValue({data:null,error:null});
  expect(await fetchUserProfileFromDb('customer','153','benstake13@gmail.com')).toBeNull();expect(db.eq).toHaveBeenCalledTimes(1);
 });
 it('rejects a response containing another profile ID',async()=>{
  db.single.mockResolvedValue({data:{id:'admin',avatar_color:'admin-face'},error:null});
  expect(await fetchUserProfileFromDb('customer','153')).toBeNull();
 });
});
