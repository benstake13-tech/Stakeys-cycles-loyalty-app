import type { SaleLineItem } from '../types/bikeShop';
import type { WebPriceItem, WebProduct } from '../types/websiteContent';
import { roundMoney } from './discountService';
import { billableUnitPrice } from './websitePrices';
import { tillStockRows } from './tillStock';

/**
 * Pure basket maths for the till (POS).
 *
 * The till is a full terminal: a searchable catalogue built from the
 * staff-editable website price list plus shop stock, and a basket where every
 * line's price, quantity, description and category is individually editable.
 * Keeping those mutations here (rather than inline in the component) means they
 * are deterministic and unit-testable, mirroring `tillCalculator`/`tillStock`.
 */

export type SaleCategory = SaleLineItem['category'];

let lineSeq = 0;
/** Stable, unique-enough id for a new basket line. */
export function newLineId(): string {
  return `line-${Date.now().toString(36)}-${lineSeq++}`;
}

export function lineTotal(line: Pick<SaleLineItem, 'quantity' | 'unitPrice'>): number {
  return roundMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

export function basketSubtotal(lines: SaleLineItem[]): number {
  return roundMoney(lines.reduce((sum, l) => sum + lineTotal(l), 0));
}

/**
 * Append a line, merging into an existing line with the same description and
 * unit price (so two taps on the same catalogue item bump the quantity rather
 * than stacking duplicate rows).
 */
export function addLine(lines: SaleLineItem[], item: Omit<SaleLineItem, 'id'>, id = newLineId()): SaleLineItem[] {
  const existing = lines.find((l) => l.description === item.description && l.unitPrice === item.unitPrice);
  if (existing) {
    return lines.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...lines, { ...item, id }];
}

/** Apply a partial edit to one line. Never changes the line's id. */
export function updateLine(lines: SaleLineItem[], id: string, patch: Partial<Omit<SaleLineItem, 'id'>>): SaleLineItem[] {
  return lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

export function setLinePrice(lines: SaleLineItem[], id: string, unitPrice: number): SaleLineItem[] {
  const safe = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  return updateLine(lines, id, { unitPrice: roundMoney(safe) });
}

export function setLineCategory(lines: SaleLineItem[], id: string, category: SaleCategory): SaleLineItem[] {
  return updateLine(lines, id, { category });
}

export function setLineDescription(lines: SaleLineItem[], id: string, description: string): SaleLineItem[] {
  return updateLine(lines, id, { description });
}

/** The most units a stock-backed line may hold, given the rest of the basket. */
export function maxQtyForLine(lines: SaleLineItem[], products: WebProduct[], line: SaleLineItem): number {
  if (!line.productId) return Number.POSITIVE_INFINITY;
  const product = products.find((p) => p.id === line.productId);
  if (!product) return Number.POSITIVE_INFINITY;
  const others = lines
    .filter((o) => o.id !== line.id && o.productId === line.productId)
    .reduce((sum, o) => sum + o.quantity, 0);
  return Math.max(0, product.stock - others);
}

/**
 * Set a line's quantity. Zero removes the line; stock-backed lines are capped to
 * what is left on the shelf so the till can never oversell the storefront.
 */
export function setLineQty(lines: SaleLineItem[], id: string, qty: number, products: WebProduct[] = []): SaleLineItem[] {
  const target = lines.find((l) => l.id === id);
  if (!target) return lines;
  const requested = Math.max(0, Math.floor(Number(qty) || 0));
  const capped = target.productId ? Math.min(requested, maxQtyForLine(lines, products, target)) : requested;
  return lines
    .map((l) => (l.id === id ? { ...l, quantity: capped } : l))
    .filter((l) => l.quantity > 0);
}

export function removeLine(lines: SaleLineItem[], id: string): SaleLineItem[] {
  return lines.filter((l) => l.id !== id);
}

/** One searchable row in the till catalogue — a price-list job or a stock item. */
export interface CatalogueRow {
  id: string;
  label: string;
  category: string;
  /** Billable unit price; undefined when the job has no clean numeric price. */
  price?: number;
  /** Human display price (the price-list string, or a formatted stock price). */
  priceLabel: string;
  kind: 'job' | 'stock';
  productId?: string;
  disabled?: boolean;
  hint?: string;
}

/**
 * Build the catalogue from the staff-editable website price list (bike +
 * scooter jobs) plus live shop stock. Order follows the price list's own groups,
 * then the shelf order, so staff find things where they expect them.
 */
export function buildCatalogue(
  priceList: WebPriceItem[],
  products: WebProduct[],
  lines: SaleLineItem[]
): CatalogueRow[] {
  const jobs: CatalogueRow[] = priceList.map((item) => {
    const price = billableUnitPrice(item);
    return {
      id: `job-${item.id}`,
      label: item.item,
      category: item.group || (item.scope === 'bike' ? 'Bicycle' : 'E-Scooter'),
      price,
      priceLabel: item.price,
      kind: 'job',
    };
  });
  const stock: CatalogueRow[] = tillStockRows(products, lines).map(({ product, label, remaining, soldOut }) => ({
    id: `stock-${product.id}`,
    label,
    category: product.category,
    price: product.price,
    priceLabel: `£${product.price.toFixed(2)}`,
    kind: 'stock',
    productId: product.id,
    disabled: soldOut,
    hint: soldOut ? 'Out of stock' : `${remaining} of ${product.stock} available`,
  }));
  return [...jobs, ...stock];
}

/** Case-insensitive match on label or category; blank query returns everything. */
export function searchCatalogue(rows: CatalogueRow[], query: string): CatalogueRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
}

/** Turn a catalogue row into a basket line, ready to be priced/edited. */
export function catalogueLine(row: CatalogueRow): Omit<SaleLineItem, 'id'> {
  return {
    description: row.label,
    category: row.kind === 'stock' ? 'Part' : 'Labour',
    quantity: 1,
    unitPrice: row.price ?? 0,
    productId: row.productId,
  };
}
