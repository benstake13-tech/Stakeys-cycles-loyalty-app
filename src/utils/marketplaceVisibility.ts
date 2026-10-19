export const SOLD_DISPLAY_MS=48*60*60*1000;
export function isPublicMarketplaceListing(listing:{status:string;sold_at?:string|null},now=Date.now()):boolean {
 return listing.status==='active'||(listing.status==='sold'&&Boolean(listing.sold_at)&&Date.parse(listing.sold_at!) + SOLD_DISPLAY_MS>now);
}
