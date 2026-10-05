import { ShopPromotion } from '../types/bikeShop';

export function evaluatePromotionsExpiry(promos: ShopPromotion[]): ShopPromotion[] {
  const now = new Date();
  return promos.map((p) => ({
    ...p,
    status: p.endDate && new Date(p.endDate) < now ? 'expired' : p.status,
  }));
}
