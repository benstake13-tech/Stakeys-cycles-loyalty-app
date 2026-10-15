import { beforeEach, describe, expect, it, vi } from 'vitest';
const io=vi.hoisted(()=>({upload:vi.fn(),url:'https://example.supabase.co/storage/v1/object/public/shop-gallery/website/test.jpg'}));
vi.mock('./src/lib/supabase',()=>({supabase:{storage:{from:()=>({upload:io.upload,getPublicUrl:()=>({data:{publicUrl:io.url}})})}}}));
import { uploadWebsiteImage } from './src/api/websiteImageUpload';
beforeEach(()=>{io.upload.mockReset();io.upload.mockResolvedValue({error:null});});
describe('durable website image uploads',()=>{
 it('stores bytes once, verifies public delivery and returns a URL instead of embedded image data',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('image',{headers:{'content-type':'image/jpeg'}}));
  const file=new File(['image'],'workshop.jpg',{type:'image/jpeg'});
  expect(await uploadWebsiteImage(file,fetcher)).toBe(io.url);
  expect(io.upload.mock.calls[0][1]).toBe(file);
  expect(io.upload.mock.calls[0][2].upsert).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('does not report success for blocked uploads or unreadable public images',async()=>{
  const file=new File(['x'],'a.png',{type:'image/png'});
  io.upload.mockResolvedValueOnce({error:{message:'Permission denied'}});
  await expect(uploadWebsiteImage(file,vi.fn())).rejects.toThrow('Permission denied');
  await expect(uploadWebsiteImage(file,vi.fn().mockResolvedValue(new Response('no',{status:403})))).rejects.toThrow('not publicly available');
 });
 it('rejects unsupported or oversized files before any upload',async()=>{
  await expect(uploadWebsiteImage(new File(['x'],'a.svg',{type:'image/svg+xml'}))).rejects.toThrow('JPEG');
  await expect(uploadWebsiteImage(new File([new Uint8Array(8*1024*1024+1)],'big.jpg',{type:'image/jpeg'}))).rejects.toThrow('8 MB');
  expect(io.upload).not.toHaveBeenCalled();
 });
});
