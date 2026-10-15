import { describe, expect, it } from 'vitest';
import { exactStockReference, compareStockPart } from './src/utils/stockComparison';
describe('evidence-led saved stock comparison',()=>{
 const bike={make:'Trek',model:'Marlin 7',year:'2023',type:'cycle'};
 it('requires exact identity, year and category rather than a brand or fuzzy model guess',()=>{
  expect(exactStockReference(bike)).toBeTruthy();
  expect(exactStockReference({...bike,year:undefined})).toBeUndefined();
  expect(exactStockReference({...bike,model:'Marlin'})).toBeUndefined();
  expect(exactStockReference({...bike,year:'2024'})).toBeUndefined();
  expect(exactStockReference({...bike,type:'ebike'})).toBeUndefined();
 });
 it('flags different readable codes as possible non-stock without claiming an upgrade or verified OEM data',()=>{
  const result=compareStockPart({componentName:'Rear derailleur',model:'RD-M8100',verification:'photo-supported'},exactStockReference(bike));
  expect(result.stockComparison).toBe('possible-non-stock');
  expect(result.stockComparisonNote).toContain('does not establish an upgrade');
  expect(result.stockReference?.year).toBe('2023');
 });
 it('keeps a code match provisional and unreadable parts unverified',()=>{
  const reference=exactStockReference(bike);
  expect(compareStockPart({componentName:'Rear derailleur',model:'RD-M5120',verification:'photo-supported'},reference).stockComparison).toBe('reference-match-unverified');
  expect(compareStockPart({componentName:'Rear derailleur',model:'Deore',verification:'photo-supported'},reference).stockComparison).toBe('not-verified');
  expect(compareStockPart({componentName:'Rear derailleur',model:'RD-M8100',verification:'needs-verification'},reference).stockComparison).toBe('not-verified');
 });
});
