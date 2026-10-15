import { beforeEach,describe,it,expect,vi } from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('./src/lib/supabase',()=>({supabase:{functions:{invoke}}}));
import {generateGemini} from './src/api/geminiGateway';
const request={contents:[{role:'user',parts:[{text:'Opening hours?'}]}]};
beforeEach(()=>{invoke.mockReset();});
describe('Gemini server key diagnostics',()=>{
 it('keeps the secret out of the client request',async()=>{
  invoke.mockResolvedValue({data:{text:'Hello'},error:null});
  expect(await generateGemini(request)).toEqual({text:'Hello'});
  expect(invoke.mock.calls[0][0]).toBe('gemini-gateway');
  expect(invoke.mock.calls[0][1].body).toEqual({...request,config:{}});
 });
 it.each([
  [{error:'GEMINI_API_KEY is not configured'},503,'GEMINI_API_KEY in Supabase'],
  [{code:'KEY_REJECTED'},502,'Google rejected'],
  [{code:'RATE_LIMITED'},502,'quota'],
  [{code:'BILLING_REQUIRED'},502,'no usable prepay credits'],
  [{},404,'not deployed'],
  [{},401,'authenticate'],
 ])('explains gateway failure %j',async(body,status,message)=>{
  invoke.mockResolvedValue({data:null,error:{context:new Response(JSON.stringify(body),{status})}});
  await expect(generateGemini(request)).rejects.toThrow(message);
 });
 it('forwards cancellation instead of discarding it',async()=>{
  const controller=new AbortController();controller.abort();
  invoke.mockImplementation(async(_name,options)=>{
   expect(options.signal.aborted).toBe(true);
   return {data:null,error:new Error('aborted')};
  });
  await expect(generateGemini({...request,config:{abortSignal:controller.signal}})).rejects.toThrow('timed out');
 });
});
