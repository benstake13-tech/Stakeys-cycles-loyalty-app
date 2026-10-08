import { ShopPromotion } from '../types/bikeShop';

export function evaluatePromotionsExpiry(promos: ShopPromotion[]): ShopPromotion[] {
  const now = new Date();
  // Return the SAME array when nothing expired. This runs on a 60s interval, so
  // rebuilding it every tick handed the context a fresh identity and re-rendered
  // every consumer of the whole tree for no change.
  let changed = false;
  const next = promos.map((p) => {
    const status = p.endDate && new Date(p.endDate) < now ? 'expired' : p.status;
    if (status === p.status) return p;
    changed = true;
    return { ...p, status };
  });
  return changed ? next : promos;
}
