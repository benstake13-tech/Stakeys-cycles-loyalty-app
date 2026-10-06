import { describe, it, expect } from 'vitest';
import { stockLabel, qtyInBasket, tillStockRows, canAddStockProduct } from './src/utils/tillStock';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';
import type { SaleLineItem } from './src/types/bikeShop';
import type { WebProduct } from './src/types/websiteContent';

function product(over: Partial<WebProduct> & { id: string }): WebProduct {
  return {
    name: 'Inner Tube',
    price: 6.5,
    category: 'Second hand parts',
    image: '',
    stock: 3,
    ...over,
  } as WebProduct;
}

function line(over: Partial<SaleLineItem> & { id: string }): SaleLineItem {
  return {
    description: 'Inner Tube',
    category: 'Part',
    quantity: 1,
    unitPrice: 6.5,
    ...over,
  } as SaleLineItem;
}

describe('shop stock starts empty', () => {
  it('ships no seeded products so the shop only shows real shelf stock', () => {
    expect(DEFAULT_WEBSITE_CONTENT.products).toEqual([]);
  });
});

describe('till mirrors the live storefront shelf', () => {
  it('builds exactly one till button per live stock product', () => {
    const products = [
      product({ id: 'prod-a', name: 'Carrera titan' }),
      product({ id: 'prod-b', name: 'Shimano brake', stock: 1 }),
    ];
    const rows = tillStockRows(products, []);
    expect(rows).toHaveLength(products.length);
    expect(rows.map((r) => r.product.id)).toEqual(['prod-a', 'prod-b']);
    expect(rows.map((r) => r.label)).toEqual(['Carrera titan', 'Shimano brake']);
  });

  it('reflects a product added at the till without any extra wiring', () => {
    const before = tillStockRows([product({ id: 'prod-a' })], []);
    expect(before.map((r) => r.product.id)).toEqual(['prod-a']);

    const after = tillStockRows(
      [product({ id: 'prod-a' }), product({ id: 'prod-c', name: 'New Arrival' })],
      []
    );
    expect(after.map((r) => r.product.id)).toEqual(['prod-a', 'prod-c']);
    expect(after.find((r) => r.product.id === 'prod-c')!.label).toBe('New Arrival');
  });

  it('caps the remaining count by what is already in the basket', () => {
    const products = [product({ id: 'prod-a', stock: 5 })];
    const lines = [
      line({ id: 'l1', productId: 'prod-a', quantity: 2 }),
      line({ id: 'l2', productId: 'prod-a', quantity: 1 }),
    ];
    const [row] = tillStockRows(products, lines);
    expect(row.inBasket).toBe(3);
    expect(row.remaining).toBe(2);
    expect(row.soldOut).toBe(false);
    expect(canAddStockProduct(products, lines, 'prod-a')).toBe(true);
  });

  it('marks a product sold out once the basket meets the shelf count', () => {
    const products = [product({ id: 'prod-a', stock: 2 })];
    const lines = [line({ id: 'l1', productId: 'prod-a', quantity: 2 })];
    const [row] = tillStockRows(products, lines);
    expect(row.remaining).toBe(0);
    expect(row.soldOut).toBe(true);
    expect(canAddStockProduct(products, lines, 'prod-a')).toBe(false);
  });

  it('keeps a half-filled product usable with a fallback label', () => {
    expect(stockLabel({ name: '' })).toBe('Untitled item');
    expect(stockLabel({ name: '   ' })).toBe('Untitled item');
    expect(stockLabel({ name: 'Bell' })).toBe('Bell');
  });

  it('counts basket quantity per product only', () => {
    const lines = [
      line({ id: 'l1', productId: 'prod-a', quantity: 2 }),
      line({ id: 'l2', productId: 'prod-b', quantity: 4 }),
      line({ id: 'l3', productId: undefined, quantity: 9 }),
    ];
    expect(qtyInBasket(lines, 'prod-a')).toBe(2);
    expect(qtyInBasket(lines, 'prod-b')).toBe(4);
    expect(qtyInBasket(lines, 'prod-missing')).toBe(0);
  });
});
