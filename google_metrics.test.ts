import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './api/business/[action].js';
const response = (data:any, status=200) => ({ok:status===200,status,json:async()=>data});
async function request(path:string,params:any={}) {
 const res:any={statusCode:200,status(n:number){this.statusCode=n;return this;},json(d:any){this.body=d;return this;}};
 await handler({method:'POST',query:{action:'insights'},body:{provider:'google',accessToken:'owner-token',path,params}},res);return res;
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('Google profile performance',()=>{
 it('uses exactly 28 completed UTC days and returns all available profile action metrics',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
 let url='';vi.stubGlobal('fetch',vi.fn(async(u:string)=>{url=String(u);return response({multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[
 {dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{value:'3'},{value:'2'}]}},
 {dailyMetric:'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',timeSeries:{datedValues:[{value:'12'}]}},
 {dailyMetric:'BUSINESS_BOOKINGS',timeSeries:{datedValues:[{value:'0'}]}},
 {dailyMetric:'MESSAGING_CLICKS',timeSeries:{datedValues:[{value:'4'}]}}
 ]}]});}));
 const r=await request('performance',{location:'locations/123'});const u=new URL(url);
 expect(u.searchParams.get('dailyRange.startDate.day')).toBe('28');
 expect(u.searchParams.get('dailyRange.startDate.month')).toBe('9');
 expect(u.searchParams.get('dailyRange.endDate.day')).toBe('25');
 expect(u.searchParams.getAll('dailyMetrics')).toContain('MESSAGING_CLICKS');
 expect(r.body.metrics).toMatchObject({calls:5,bookings:0,messagingClicks:4,searchMobile:12});
 expect(r.body.metrics.profileViews).toBeNull(); // other impression series were not returned
 expect(r.body.period).toEqual({start:'2026-09-28',end:'2026-10-25'});
 });
 it('rejects malformed location paths without contacting Google',async()=>{
 const f=vi.fn();vi.stubGlobal('fetch',f);const r=await request('performance',{location:'../../accounts'});
 expect(r.statusCode).toBe(400);expect(f).not.toHaveBeenCalled();
 });
 it('does not hide Google location permission errors',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(u:string)=>String(u).includes('accountmanagement')?response({accounts:[{name:'accounts/1'}]}):response({error:{message:'Permission denied'}},403)));
 const r=await request('accounts');expect(r.statusCode).toBe(403);expect(r.body.error.message).toBe('Permission denied');
 });
});
it('discovers locations on later account and location pages',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(u:string)=>{
 const url=new URL(u);const next=url.searchParams.get('pageToken');
 if(url.hostname.includes('accountmanagement'))return response(next?{accounts:[{name:'accounts/2'}]}:{accounts:[{name:'accounts/1'}],nextPageToken:'accounts-next'});
 if(url.pathname.includes('accounts/1'))return response({locations:[]});
 return response(next?{locations:[{name:'locations/2',title:'Stakeys'}]}:{locations:[{name:'locations/1',title:'Other shop'}],nextPageToken:'locations-next'});
 }));
 const r=await request('accounts');expect(r.body.locations.map((x:any)=>x.title)).toEqual(['Other shop','Stakeys']);
});
