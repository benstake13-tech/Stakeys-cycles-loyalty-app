import { describe, it, expect } from 'vitest';
import {
  addLine,
  updateLine,
  setLinePrice,
  setLineQty,
  setLineCategory,
  removeLine,
  basketSubtotal,
  buildCatalogue,
  searchCatalogue,
  catalogueLine,
  maxQtyForLine,
} from './src/utils/posCart';
import type { SaleLineItem } from './src/types/bikeShop';
import type { WebPriceItem, WebProduct } from './src/types/websiteContent';

const line = (over: Partial<SaleLineItem> = {}): SaleLineItem => ({
  id: 'l1',
  description: 'Labour',
  category: 'Labour',
  quantity: 1,
  unitPrice: 30,
  ...over,
});

describe('posCart basket maths', () => {
  it('appends a new line when nothing matches', () => {
    const out = addLine([], { description: 'Tube', category: 'Part', quantity: 1, unitPrice: 6 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBeTruthy();
  });

  it('merges a repeated line onto the same description + price', () => {
    const first = addLine([], { description: 'Tube', category: 'Part', quantity: 1, unitPrice: 6 }, 'id-x');
    const second = addLine(first, { description: 'Tube', category: 'Part', quantity: 1, unitPrice: 6 }, 'id-y');
    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(2);
  });

  it('does not merge lines with a different price', () => {
    const first = addLine([], { description: 'Service', category: 'Labour', quantity: 1, unitPrice: 40 }, 'a');
    const second = addLine(first, { description: 'Service', category: 'Labour', quantity: 1, unitPrice: 30 }, 'b');
    expect(second).toHaveLength(2);
  });

  it('edits price, category and description in place', () => {
    let lines = [line()];
    lines = setLinePrice(lines, 'l1', 42.5);
    lines = setLineCategory(lines, 'l1', 'Part');
    lines = updateLine(lines, 'l1', { description: 'New' });
    expect(lines[0]).toMatchObject({ unitPrice: 42.5, category: 'Part', description: 'New' });
  });

  it('clamps a negative price to zero and rounds', () => {
    expect(setLinePrice([line()], 'l1', -5)[0].unitPrice).toBe(0);
    expect(setLinePrice([line()], 'l1', 12.345)[0].unitPrice).toBe(12.35);
  });

  it('removes a line when its quantity hits zero', () => {
    expect(setLineQty([line()], 'l1', 0)).toHaveLength(0);
  });

  it('computes the subtotal across lines', () => {
    const lines = [line({ quantity: 2, unitPrice: 30 }), line({ id: 'l2', quantity: 1, unitPrice: 6 })];
    expect(basketSubtotal(lines)).toBe(66);
  });

  it('caps a stock-backed line to what is left on the shelf', () => {
    const products = [{ id: 'p1', stock: 3 } as WebProduct];
    const lines = [line({ productId: 'p1', quantity: 1 })];
    // The line may hold the full shelf minus what other lines already take.
    expect(maxQtyForLine(lines, products, lines[0])).toBe(3);
    expect(setLineQty(lines, 'l1', 99, products)[0].quantity).toBe(3);
    // A second line sharing the product reduces what this one may hold.
    const twoLines = [line({ productId: 'p1', quantity: 1 }), line({ id: 'l2', productId: 'p1', quantity: 2 })];
    expect(maxQtyForLine(twoLines, products, twoLines[0])).toBe(1);
  });

  it('does not cap a non-stock line', () => {
    expect(setLineQty([line()], 'l1', 99)[0].quantity).toBe(99);
  });

  it('removeLine drops exactly one line', () => {
    const lines = [line(), line({ id: 'l2' })];
    expect(removeLine(lines, 'l1').map((l) => l.id)).toEqual(['l2']);
  });
});

describe('posCart catalogue', () => {
  const priceList: WebPriceItem[] = [
    { id: 'p1', scope: 'bike', group: 'Service Packages', item: 'Full Service', price: '£60', unitPrice: 60, desc: '' },
    { id: 'p2', scope: 'bike', group: 'Service Packages', item: 'Wheel True', price: '£15 – £40', desc: '' },
  ];
  const products: WebProduct[] = [
    { id: 's1', name: 'Carrera Titan', price: 150, category: 'Mens Bikes', image: '', stock: 2 },
  ];

  it('lists jobs (priced and not) and stock together', () => {
    const rows = buildCatalogue(priceList, products, []);
    expect(rows).toHaveLength(3);
    const full = rows.find((r) => r.label === 'Full Service')!;
    expect(full.price).toBe(60);
    const wheel = rows.find((r) => r.label === 'Wheel True')!;
    expect(wheel.price).toBeUndefined();
    const stock = rows.find((r) => r.label === 'Carrera Titan')!;
    expect(stock).toMatchObject({ kind: 'stock', productId: 's1', disabled: false });
  });

  it('marks a stock row sold out when the shelf is empty', () => {
    const rows = buildCatalogue([], [{ ...products[0], stock: 0 }], []);
    expect(rows[0].disabled).toBe(true);
  });

  it('searches by label or category, case-insensitively', () => {
    const rows = buildCatalogue(priceList, products, []);
    expect(searchCatalogue(rows, 'wheel').map((r) => r.label)).toEqual(['Wheel True']);
    expect(searchCatalogue(rows, 'mens')).toHaveLength(1);
    expect(searchCatalogue(rows, '')).toHaveLength(3);
  });

  it('turns a row into a basket line, defaulting the category by kind', () => {
    expect(catalogueLine({ id: 'job-p1', label: 'Full Service', category: 'Service', price: 60, priceLabel: '£60', kind: 'job' })).toMatchObject({
      description: 'Full Service',
      category: 'Labour',
      unitPrice: 60,
      quantity: 1,
    });
    expect(catalogueLine({ id: 'stock-s1', label: 'Carrera', category: 'Mens Bikes', price: 150, priceLabel: '£150', kind: 'stock', productId: 's1' })).toMatchObject({
      category: 'Part',
      productId: 's1',
    });
  });
});
