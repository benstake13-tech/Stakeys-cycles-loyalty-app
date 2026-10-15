import { describe,it,expect } from 'vitest';
import { HOLIDAY_THEME_IDS } from './src/utils/holidayCalendar';
import { worldFor } from './src/components/theme/worldCatalog';
import { CHARACTER_CATALOG,buildScene,meshData,normalMatrix,reactionPose,sceneCamera,type MeshKind } from './src/components/theme/seasonal3d';
describe('seasonal 3D scenes',()=>{
 it('assigns a real character to every supported calendar theme',()=>{
  expect(Object.keys(CHARACTER_CATALOG).sort()).toEqual([...HOLIDAY_THEME_IDS].sort());
  expect(CHARACTER_CATALOG.halloween).toEqual(['goblin','ghost']);
  expect(CHARACTER_CATALOG.christmas).toEqual(['santa','elf']);
  expect(CHARACTER_CATALOG.stpatricks[0]).toBe('leprechaun');
  expect(CHARACTER_CATALOG.valentines[0]).toBe('cupid');
 });
 it('produces finite, bounded geometry with usable normals',()=>{
  for(const kind of ['sphere','box','cylinder','cone','plane','torus','roof'] as MeshKind[]){
   const vertices=meshData(kind).vertices;
   expect(vertices.length%18).toBe(0);
   expect(vertices.length).toBeGreaterThan(0);
   for(let i=0;i<vertices.length;i+=6){
    expect(Array.from(vertices.slice(i,i+6)).every(Number.isFinite)).toBe(true);
    expect(Math.hypot(vertices[i+3],vertices[i+4],vertices[i+5])).toBeCloseTo(1,5);
   }
  }
 });
 it('keeps scene complexity and transforms bounded for every holiday',()=>{
  for(const id of HOLIDAY_THEME_IDS){
   const items=buildScene(worldFor(id)!,1.7,[{start:1,direction:-1}]);
   expect(items.length).toBeLessThan(220);
   expect(items.length).toBeGreaterThan(30);
   for(const item of items){
    expect(Array.from(item.model).every(Number.isFinite)).toBe(true);
    expect(Array.from(normalMatrix(item.model)).every(Number.isFinite)).toBe(true);
   }
  }
 });
 it('settles a poked character back to its exact standing pose',()=>{
  for(let t=0;t<3;t+=.02){const p=reactionPose(t);expect(Math.abs(p.roll)).toBeLessThan(1.4);expect(p.hop).toBeGreaterThanOrEqual(0);}
  expect(reactionPose(3)).toEqual({roll:0,hop:0,stars:0});
  expect(reactionPose(100)).toEqual({roll:0,hop:0,stars:0});
 });
 it('keeps camera projection valid in portrait and landscape',()=>{
  for(const [w,h] of [[320,960],[390,844],[800,600],[1440,900]]){
   const c=sceneCamera(w,h);
   expect(Array.from(c.viewProjection).every(Number.isFinite)).toBe(true);
   expect(c.eye.every(Number.isFinite)).toBe(true);
  }
 });
});
