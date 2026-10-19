import {expect,it} from 'vitest';
import {isPublicMarketplaceListing,SOLD_DISPLAY_MS} from './src/utils/marketplaceVisibility';
it('keeps sold adverts for exactly 48 hours, then hides them without deleting history',()=>{
 const sold=Date.parse('2026-10-19T12:00:00Z');const row={status:'sold',sold_at:new Date(sold).toISOString()};
 expect(isPublicMarketplaceListing(row,sold+SOLD_DISPLAY_MS-1)).toBe(true);
 expect(isPublicMarketplaceListing(row,sold+SOLD_DISPLAY_MS)).toBe(false);
 expect(isPublicMarketplaceListing(row,sold+SOLD_DISPLAY_MS+1)).toBe(false);
 expect(isPublicMarketplaceListing({status:'sold'})).toBe(false);
 expect(isPublicMarketplaceListing({status:'sold',sold_at:'invalid'})).toBe(false);
 expect(isPublicMarketplaceListing({status:'active'},sold)).toBe(true);
 expect(isPublicMarketplaceListing({status:'pending_approval'},sold)).toBe(false);
});
