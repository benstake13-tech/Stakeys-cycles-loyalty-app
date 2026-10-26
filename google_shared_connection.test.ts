import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './api/business/[action].js';
let row:any, role:string, calls:string[];
const response=(data:any,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
async function req(method='GET',body:any={},token='staff-session'){
 const res:any={statusCode:200,headers:{},setHeader(k:string,v:string){this.headers[k]=v;},status(n:number){this.statusCode=n;return this;},json(v:any){this.body=v;return this;}};
 await handler({method,headers:token?{authorization:`Bearer ${token}`}:{},query:{action:'google-shared'},body},res);return res;
}
beforeEach(()=>{
 role='staff';calls=[];row={id:'primary',refresh_token:'PRIVATE_GOOGLE_REFRESH',location_name:'locations/1',locations:[{name:'locations/1',title:'Stakeys'}],snapshot:{metrics:{calls:8,websiteClicks:42},hasData:true,period:{start:'2026-09-28',end:'2026-10-25'}},updated_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),last_error:null,needs_reconnect:false};
 vi.stubEnv('ADMIN_EMAILS','owner@example.com');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','PRIVATE_SERVICE');vi.stubEnv('VITE_GOOGLE_CLIENT_ID','CLIENT');vi.stubEnv('GOOGLE_CLIENT_SECRET','PRIVATE_SECRET');
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any={})=>{
 const u=String(url);calls.push(u);
 if(u.includes('/auth/v1/user'))return response({id:'u1',email:'owner@example.com'});
 if(u.includes('/profiles?'))return response([{role}]);
 if(u.includes('/google_business_connection')){
  if(init.method==='DELETE'){row=null;return response(null,204);}
  if(init.method==='POST'||init.method==='PATCH'){row={...row,...JSON.parse(init.body)};return response([row]);}
  return response(row?[row]:[]);
 }
 if(u==='https://oauth2.googleapis.com/token')return response({error:'temporarily_unavailable'},503);
 throw Error('Unexpected URL '+u);
 }));
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('shared Google Business connection',()=>{
 it('requires a verified staff session before loading credentials or figures',async()=>{
  const r=await req('GET',{},'');expect(r.statusCode).toBe(401);expect(calls).toEqual([]);
 });
 it('rejects customers even with a valid session',async()=>{
  role='customer';const r=await req();expect(r.statusCode).toBe(403);expect(calls.some(u=>u.includes('google_business_connection'))).toBe(false);
 });
 it('allows staff to read fresh cached metrics without any browser Google token and never returns secrets',async()=>{
  const r=await req();expect(r.statusCode).toBe(200);expect(r.body.metrics.websiteClicks).toBe(42);expect(r.body.connected).toBe(true);expect(r.body.canManage).toBe(false);expect(JSON.stringify(r.body)).not.toContain('PRIVATE');expect(calls.some(u=>u.includes('googleapis'))).toBe(false);expect(r.headers['Cache-Control']).toContain('no-store');
 });
 it('only allows admins to connect or remove the shared account',async()=>{
  expect((await req('POST',{refreshToken:'x'})).statusCode).toBe(403);expect((await req('DELETE')).statusCode).toBe(403);
 });
 it('keeps the last successful metrics visible when Google refresh is temporarily unavailable',async()=>{
  row.last_attempt_at='2020-01-01T00:00:00Z';row.updated_at='2020-01-01T00:00:00Z';
  const r=await req();expect(r.statusCode).toBe(200);expect(r.body.metrics.calls).toBe(8);expect(r.body.stale).toBe(true);expect(r.body.updatedAt).toBe('2020-01-01T00:00:00Z');expect(row.refresh_token).toBe('PRIVATE_GOOGLE_REFRESH');expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
 });
 it('requires a new offline consent if no refresh token is supplied',async()=>{
  role='admin';const r=await req('POST',{});expect(r.statusCode).toBe(400);expect(r.body.error).toMatch(/refresh|offline/i);
 });
});
it('does not allow an old in-flight refresh to overwrite a newly selected location',async()=>{
 role='admin';row={...row,connection_version:'v1',locations:[{name:'locations/1'},{name:'locations/2'}],last_attempt_at:'2020-01-01T00:00:00Z'};
 let release!:()=>void,entered!:()=>void;const started=new Promise<void>(r=>entered=r);const paused=new Promise<void>(r=>release=r);
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any={})=>{
  const u=String(url);
  if(u.includes('/auth/v1/user'))return response({id:'u1',email:'owner@example.com'});
  if(u.includes('/profiles?'))return response([{role}]);
  if(u.includes('/google_business_connection')){
   if(init.method==='PATCH'){
    const version=new URL(u).searchParams.get('connection_version')?.replace(/^eq\./,'');
    if(version&&version!==row.connection_version)return response([]);
    row={...row,...JSON.parse(init.body)};return response([row]);
   }
   return response([row]);
  }
  if(u.includes('oauth2.googleapis'))return response({access_token:'GOOGLE_ACCESS',scope:'https://www.googleapis.com/auth/business.manage'});
  if(u.includes('locations/1:')){entered();await paused;return response({multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[{dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{value:'111'}]}}]}]});}
  if(u.includes('locations/2:'))return response({multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[{dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{value:'2'}]}}]}]});
  throw Error('Unexpected URL '+u);
 }));
 const old=req();await started;await req('POST',{location:'locations/2'});release();await old;
 expect(row.location_name).toBe('locations/2');expect(row.snapshot.metrics.calls).toBe(2);
});

it('does not let an unlisted administrator change the owner Google connection',async()=>{
 role='admin';vi.stubEnv('ADMIN_EMAILS','another@example.com');
 expect((await req('POST',{refreshToken:'token'})).statusCode).toBe(403);
 expect((await req()).body.canManage).toBe(false);
});
it('stores a validated owner offline connection even while the Google account API is disabled, without returning credentials',async()=>{
 role='admin';const original=fetch;
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any={})=>{
  const u=String(url);
  if(u==='https://oauth2.googleapis.com/token')return response({access_token:'PRIVATE_ACCESS',scope:'https://www.googleapis.com/auth/business.manage'});
  if(u.includes('mybusinessaccountmanagement.googleapis.com'))return response({error:{message:'My Business Account Management API is disabled in this project.'}},403);
  return original(url,init);
 }));
 const r=await req('POST',{refreshToken:'PRIVATE_OWNER_OFFLINE'});expect(r.statusCode).toBe(200);expect(r.body.connected).toBe(true);expect(r.body.message).toContain('API is disabled');expect(row.refresh_token).toBe('PRIVATE_OWNER_OFFLINE');expect(r.body.metrics).toBeNull();expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
});
it('retains the previous report but asks the owner to reconnect when Google revokes offline access',async()=>{
 row.last_attempt_at='2020-01-01T00:00:00Z';const original=fetch;
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any={})=>String(url)==='https://oauth2.googleapis.com/token'?response({error:'invalid_grant'},400):original(url,init)));
 const r=await req();expect(r.body.needsReconnect).toBe(true);expect(r.body.metrics.calls).toBe(8);expect(r.body.message).toMatch(/reconnect/);expect(row.refresh_token).toBe('PRIVATE_GOOGLE_REFRESH');
});
it('stores a zero-quota approval diagnosis without exposing raw Google metadata',async()=>{
 row.location_name=null;row.last_attempt_at='2020-01-01T00:00:00Z';const original=fetch;
 vi.stubGlobal('fetch',vi.fn(async(url:any,init:any={})=>{
  if(String(url)==='https://oauth2.googleapis.com/token')return response({access_token:'PRIVATE_ACCESS'});
  if(String(url).includes('mybusinessaccountmanagement.googleapis.com'))return response({error:{message:'Quota exceeded',details:[{metadata:{quota_limit_value:'0',access_token:'PRIVATE_EXTRA'}}]}},429);
  return original(url,init);
 }));
 const r=await req();expect(r.body.issue.code).toBe('GOOGLE_ACCESS_NOT_APPROVED');expect(row.last_issue.quotaLimit).toBe(0);expect(r.body.metrics.calls).toBe(8);expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
});
