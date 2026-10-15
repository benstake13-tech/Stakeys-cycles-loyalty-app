import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='public/theme-assets/';
const manifest=JSON.parse(readFileSync(root+'asset-manifest.json','utf8'));
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
describe('offline seasonal production assets',()=>{
 it('packages exactly the assets and renderer recorded in the integrity manifest',()=>{
  expect(sha(readFileSync('tools/seasonal/scene.js'))).toBe(manifest.rendererSourceSha256);
  for(const file of manifest.files){const bytes=readFileSync(root+file.name);expect(bytes.length,file.name).toBe(file.bytes);expect(sha(bytes),file.name).toBe(file.sha256);}
 });
 it('keeps rigged GLBs self-contained and records commercial redistribution licences',()=>{
  for(const file of manifest.files.filter((f:{name:string})=>f.name.endsWith('.glb'))){
   expect(['CC0-1.0','CC-BY-4.0']).toContain(file.license);expect(file.source).toBeTruthy();
   const bytes=readFileSync(root+file.name);expect(bytes.toString('utf8',0,4)).toBe('glTF');
   const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
   for(const data of [...json.buffers||[],...json.images||[]])expect(!data.uri||data.uri.startsWith('data:'),file.name+' external resource').toBe(true);
   if(file.name!=='witch-cottage.glb'){expect(json.skins?.length,file.name+' rig').toBeGreaterThan(0);expect(json.animations?.length,file.name+' animation').toBeGreaterThan(0);}
  }
 });
});
