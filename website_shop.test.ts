import { describe, it, expect } from 'vitest';
import {
  ORDER_PROGRESS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  FULFILMENT_LABELS,
  WEBSITE_SETUP_SQL,
  asFulfilment,
  asOrderStatus,
  nextOrderStatus,
} from './src/shared/data/websiteCatalog';
import {
  formatMoney,
  isMissingTable,
  orderItemCount,
  summariseOrderItems,
} from './src/shared/api/websiteService';
import { EXPECTED_SCHEMA } from './src/shared/utils/schemaSync';
import type { ShopOrder } from './src/shared/data/websiteCatalog';

const order = (items: ShopOrder['items']): ShopOrder => ({
  id: 'ord-1',
  customerName: 'Sam Rider',
  customerPhone: '07000000000',
  customerEmail: 'sam@example.com',
  fulfilment: 'collection',
  address: '',
  postcode: '',
  notes: '',
  subtotal: 0,
  status: 'pending',
  paymentMethod: 'payment_link',
  paymentReference: '',
  createdAt: '',
  items,
});

describe('website order lifecycle', () => {
  it('advances through the fulfilment stages in order', () => {
    expect(nextOrderStatus('pending')).toBe('confirmed');
    expect(nextOrderStatus('confirmed')).toBe('paid');
    expect(nextOrderStatus('paid')).toBe('ready');
    expect(nextOrderStatus('ready')).toBe('completed');
  });

  it('stops at the final stage and treats cancellation as terminal', () => {
    expect(nextOrderStatus('completed')).toBeNull();
    expect(nextOrderStatus('cancelled')).toBeNull();
  });

  it('never advances into a cancelled state by accident', () => {
    expect(ORDER_PROGRESS).not.toContain('cancelled');
    expect(ORDER_STATUSES).toContain('cancelled');
  });

  it('labels every status the database can hold', () => {
    ORDER_STATUSES.forEach((s) => expect(ORDER_STATUS_LABELS[s]).toBeTruthy());
  });
});

describe('website value coercion', () => {
  it('falls back to collection for unknown fulfilment values', () => {
    expect(asFulfilment('delivery')).toBe('delivery');
    expect(asFulfilment('postage')).toBe('postage');
    expect(asFulfilment('nonsense')).toBe('collection');
    expect(asFulfilment(null)).toBe('collection');
  });

  it('falls back to pending for unknown order statuses', () => {
    expect(asOrderStatus('ready')).toBe('ready');
    expect(asOrderStatus('whoops')).toBe('pending');
    expect(asOrderStatus(null)).toBe('pending');
  });

  it('labels every fulfilment method for staff and customers', () => {
    (['collection', 'delivery', 'postage'] as const).forEach((f) =>
      expect(FULFILMENT_LABELS[f]).toBeTruthy()
    );
  });
});

describe('order helpers', () => {
  it('sums item quantities across lines', () => {
    const o = order([
      { id: 'a', orderId: 'ord-1', productId: 'p1', name: 'Tyres', unitPrice: 20, quantity: 2 },
      { id: 'b', orderId: 'ord-1', productId: 'p2', name: 'Bell', unitPrice: 5, quantity: 1 },
    ]);
    expect(orderItemCount(o)).toBe(3);
    expect(summariseOrderItems(o)).toBe('2× Tyres, 1× Bell');
  });

  it('describes an order with no recorded lines without crashing', () => {
    expect(summariseOrderItems(order([]))).toBe('No items recorded');
    expect(orderItemCount(order([]))).toBe(0);
  });

  it('formats money as GBP, dropping pence on whole pounds', () => {
    expect(formatMoney(25)).toBe('£25');
    expect(formatMoney(25.5)).toBe('£25.50');
  });
});

describe('missing-table detection', () => {
  it('recognises the ways Supabase reports an absent table', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ message: 'Could not find the table in the schema cache' })).toBe(true);
    expect(isMissingTable({ message: 'relation "orders" does not exist' })).toBe(true);
  });

  it('treats real errors and no error as present', () => {
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable({ message: 'permission denied' })).toBe(false);
  });
});

describe('website setup SQL', () => {
  it('creates every table and bucket the website relies on', () => {
    ['products', 'orders', 'order_items', 'gallery_items'].forEach((t) =>
      expect(WEBSITE_SETUP_SQL).toContain(`public.${t}`)
    );
    expect(WEBSITE_SETUP_SQL).toContain("'product-images'");
    expect(WEBSITE_SETUP_SQL).toContain("'gallery'");
  });

  it('is idempotent so it can be re-run safely', () => {
    expect(WEBSITE_SETUP_SQL).toContain('create table if not exists');
    expect(WEBSITE_SETUP_SQL).toContain('drop policy if exists');
  });
});

describe('staff schema sync covers the website tables', () => {
  it('lists the website tables so the Fix Schema button provisions them', () => {
    const names = EXPECTED_SCHEMA.map((t) => t.name);
    ['products', 'orders', 'order_items', 'gallery_items'].forEach((t) =>
      expect(names).toContain(t)
    );
  });
});
