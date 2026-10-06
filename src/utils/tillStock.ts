import type { SaleLineItem } from '../types/bikeShop';
import type { WebProduct } from '../types/websiteContent';

/**
 * The Till mirrors the live storefront shelf: every product staff add in the
 * Staff Station becomes a one-tap button at the counter. These helpers keep the
 * mapping pure so the button-per-product behaviour is unit-testable and the
 * same rules (stock cap, in-basket count, sold-out state) hold everywhere.
 */

export interface TillStockRow {
  product: WebProduct;
  /** Never blank, so a half-filled product still gets a usable till button. */
  label: string;
  /** Units of this product already in the current basket. */
  inBasket: number;
  /** Units still sellable after the basket is accounted for. */
  remaining: number;
  soldOut: boolean;
}

export function stockLabel(product: Pick<WebProduct, 'name'>): string {
  return product.name?.trim() || 'Untitled item';
}

export function qtyInBasket(lines: SaleLineItem[], productId: string): number {
  return lines
    .filter((line) => line.productId === productId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

/** One row per live stock product, in shelf order — the Till button list. */
export function tillStockRows(products: WebProduct[], lines: SaleLineItem[]): TillStockRow[] {
  return products.map((product) => {
    const inBasket = qtyInBasket(lines, product.id);
    const remaining = product.stock - inBasket;
    return {
      product,
      label: stockLabel(product),
      inBasket,
      remaining,
      soldOut: remaining <= 0,
    };
  });
}

export function canAddStockProduct(products: WebProduct[], lines: SaleLineItem[], productId: string): boolean {
  const product = products.find((p) => p.id === productId);
  if (!product) return false;
  return product.stock - qtyInBasket(lines, productId) > 0;
}
