import React from 'react';
import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({listener:null as any,profileRead:vi.fn(),profileWrite:vi.fn(),signOut:vi.fn(),profiles:[] as any[]}));
const sdk=vi.hoisted(()=>({channel:()=>{const c:any={on:()=>c,subscribe:()=>c};return c;},removeChannel:vi.fn(),auth:{
 getSession:vi.fn(async()=>({data:{session:null}})),
 onAuthStateChange:vi.fn((cb:any)=>{state.listener=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};}),
 signInWithPassword:vi.fn(async({email}:{email:string})=>({data:{user:{id:email.startsWith('admin')?'admin':'customer',email,user_metadata:{}}},error:null})),
 signOut:state.signOut,
},from:vi.fn(()=>{
 let uid='';const query:any={select:()=>query,upsert:()=>query,update:()=>query,insert:()=>query,eq:(_key:string,value:string)=>{uid=value;return query;},maybeSingle:async()=>({data:{id:uid,email:uid==='customer'?'benstake13@gmail.com':'admin@example.com',display_name:'Ben',role:uid==='admin'?'admin':'customer',membership_number:'153',avatar_color:uid+'-face'},error:null}),then:(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve)};return query;
})}));
vi.mock('./src/lib/supabase',()=>({supabase:sdk,AUTH_LINK_ON_LOAD:false}));
vi.mock('./src/supabase',()=>({getSupabaseClient:()=>sdk,getStoredSupabaseUrl:()=>'',saveSupabaseConfig:vi.fn()}));
vi.mock('./src/api/firebaseService',()=>({generateMembershipNumber:()=> 'STK-TEST'}));
vi.mock('./src/api/backendDataService',async original=>{
 const actual=await original<typeof import('./src/api/backendDataService')>();
 const functions=Object.fromEntries(Object.keys(actual).map(key=>[key,vi.fn(async()=>[])]));
 return {...functions,subscribeToDatabaseChanges:()=>()=>{},fetchAllProfilesFromDb:async()=>state.profiles,fetchAppSettingsFromDb:async()=>null,fetchBikesByOwner:async()=>({byOwner:{}}),fetchUserProfileFromDb:state.profileRead,updateUserProfileInDb:state.profileWrite,ensureProfileRowInDb:async()=>true};
});
import {ShopProvider,useShop} from './src/context/ShopContext';
const profile=(uid:string)=>({uid,email:uid==='customer'?'benstake13@gmail.com':'admin@example.com',displayName:'Ben',role:uid==='admin'?'admin':'customer',membershipNumber:'153',avatarColor:uid+'-face',stamps:0,tickets:0,points:0,bikes:[],createdAt:new Date(0)});
beforeEach(()=>{
 localStorage.clear();state.profiles=[profile('admin'),profile('customer')];
 state.profileRead.mockReset().mockImplementation(async(uid:string)=>profile(uid));
 state.profileWrite.mockReset().mockResolvedValue(true);
 state.signOut.mockReset().mockImplementation(async()=>{state.listener?.('SIGNED_OUT',null);return {error:null};});
});
describe('real provider account isolation',()=>{
 it('rejects late admin hydration after customer login and clears the SDK session on logout',async()=>{
  const {result}=renderHook(()=>useShop(),{wrapper:({children})=><ShopProvider>{children}</ShopProvider>});
  await waitFor(()=>expect(result.current.users.length).toBe(2));
  let release!:(value:any)=>void;
  state.profileRead.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  let adminLogin!:ReturnType<typeof result.current.loginStaff>;
  act(()=>{adminLogin=result.current.loginStaff('admin@example.com','password');});
  await waitFor(()=>expect(result.current.currentUser?.uid).toBe('admin'));
  await act(async()=>{await result.current.loginWithCredentials('benstake13@gmail.com','password');});
  expect(result.current.currentUser?.avatarColor).toBe('customer-face');
  await act(async()=>{release(profile('admin'));expect((await adminLogin).success).toBe(false);});
  expect(result.current.currentUser?.uid).toBe('customer');expect(result.current.currentUser?.avatarColor).toBe('customer-face');
  await act(async()=>{result.current.logoutUser();await Promise.resolve();});
  expect(state.signOut).toHaveBeenCalledWith({scope:'local'});expect(result.current.currentUser).toBeNull();
 });
 it('keeps an old account’s pending avatar write away from the new customer',async()=>{
  const {result}=renderHook(()=>useShop(),{wrapper:({children})=><ShopProvider>{children}</ShopProvider>});
  await waitFor(()=>expect(result.current.users.length).toBe(2));
  await act(async()=>{await result.current.loginStaff('admin@example.com','password');});
  let fail!:(e:Error)=>void;
  state.profileWrite.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;}));
  let saving!:Promise<void>;
  act(()=>{saving=result.current.updateCustomerAvatar('new-admin-face','admin').catch(()=>{});});
  await act(async()=>{await result.current.loginWithCredentials('benstake13@gmail.com','password');});
  await act(async()=>{fail(new Error('save failed'));await saving;});
  expect(result.current.currentUser?.uid).toBe('customer');expect(result.current.currentUser?.avatarColor).toBe('customer-face');
  expect(state.profileWrite).toHaveBeenCalledWith('admin','153',{avatarColor:'new-admin-face'});
 });
 it('preserves a saved customer avatar when an older profile poll finishes, and rolls back a failed save',async()=>{
  const {result}=renderHook(()=>useShop(),{wrapper:({children})=><ShopProvider>{children}</ShopProvider>});
  await waitFor(()=>expect(result.current.users.length).toBe(2));
  await act(async()=>{await result.current.loginWithCredentials('benstake13@gmail.com','password');});
  let release!:(value:any)=>void;
  state.profileRead.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  let refresh!:Promise<void>;
  act(()=>{refresh=result.current.refreshDatabaseState();});
  await waitFor(()=>expect(typeof release).toBe('function'));
  await act(async()=>{await result.current.updateCustomerAvatar('new-customer-face','customer');});
  await act(async()=>{release(profile('customer'));await refresh;});
  expect(result.current.currentUser?.avatarColor).toBe('new-customer-face');
  state.profileWrite.mockResolvedValueOnce(false);
  await act(async()=>{await expect(result.current.updateCustomerAvatar('failed-face','customer')).rejects.toThrow(/Could not save/);});
  expect(result.current.currentUser?.avatarColor).toBe('new-customer-face');
  await act(async()=>{await expect(result.current.updateCustomerAvatar('admin-face','admin')).rejects.toThrow(/Account changed/);});
  expect(result.current.currentUser?.avatarColor).toBe('new-customer-face');
 });
 it('ignores a late cold-start admin session restore after an explicit customer login',async()=>{
  let release!:(value:any)=>void;
  sdk.auth.getSession.mockResolvedValueOnce({data:{session:null}}).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}) as any);
  const {result}=renderHook(()=>useShop(),{wrapper:({children})=><ShopProvider>{children}</ShopProvider>});
  await waitFor(()=>expect(result.current.users.length).toBe(2));
  await act(async()=>{await result.current.loginWithCredentials('benstake13@gmail.com','password');});
  await act(async()=>{release({data:{session:{user:{id:'admin',email:'admin@example.com'}}}});await Promise.resolve();});
  expect(result.current.currentUser?.uid).toBe('customer');expect(result.current.currentUser?.avatarColor).toBe('customer-face');
 });

});
