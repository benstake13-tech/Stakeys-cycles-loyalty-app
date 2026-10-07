import { describe, it, expect } from 'vitest';
import {
  buildFinancialLedger,
  summarizeLedger,
  financialLedgerCsv,
  financialSummaryCsv,
  workshopPaymentLabel,
  isPaidWorkshopStatus,
  inRange,
  toIso,
} from './src/utils/financials';

const sale = (over: Record<string, unknown> = {}) => ({
  id: 'sale-1',
  saleNumber: 'SALE-2026-0001',
  customerName: 'Ada Rider',
  items: [{ name: 'Inner tube', qty: 1, price: 10 }],
  createdAt: '2026-10-05T10:00:00.000Z',
  status: 'completed',
  grandTotal: 60,
  vatAmount: 10,
  paymentMethod: 'card',
  ...over,
});

const booking = (over: Record<string, unknown> = {}, invoiceOver: Record<string, unknown> = {}) => ({
  id: 'bk-1',
  customerName: 'Grace Hopper',
  serviceTitle: 'Full Service',
  vehicleModel: 'Trek FX 2',
  status: 'completed',
  preferredDate: '2026-10-06',
  invoice: {
    invoiceNumber: 'INV-2026-0001',
    completedAt: '2026-10-06T12:00:00.000Z',
    grandTotal: 120,
    vatAmount: 20,
    paymentStatus: 'paid_card',
    ...invoiceOver,
  },
  ...over,
});

const order = (over: Record<string, unknown> = {}) => ({
  id: 'abcdef123456',
  customer_name: 'Alan Turing',
  items: [{ name: 'Bell', qty: 1, price: 24 }],
  total: 24,
  created_at: '2026-10-07T09:00:00.000Z',
  ...over,
});

const range = { start: '2026-10-01', end: '2026-10-31' };

describe('financial ledger', () => {
  it('tags a paid workshop invoice as paid and splits net/VAT', () => {
    const rows = buildFinancialLedger({ bookings: [booking()], ...range });
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('workshop');
    expect(rows[0].paymentState).toBe('paid');
    expect(rows[0].total).toBe(120);
    expect(rows[0].net).toBe(100);
    expect(rows[0].vat).toBe(20);
  });

  it('tags an unpaid workshop invoice as unpaid', () => {
    const rows = buildFinancialLedger({
      bookings: [booking({}, { paymentStatus: 'unpaid' })],
      ...range,
    });
    expect(rows[0].paymentState).toBe('unpaid');
  });

  it('tags a till sale by its payment method (on account = unpaid)', () => {
    const paid = buildFinancialLedger({ sales: [sale()], ...range });
    expect(paid[0].paymentState).toBe('paid');
    const onAccount = buildFinancialLedger({
      sales: [sale({ paymentMethod: 'unpaid' })],
      ...range,
    });
    expect(onAccount[0].paymentState).toBe('unpaid');
  });

  it('ignores quotes, declined and unsigned work', () => {
    const rows = buildFinancialLedger({
      sales: [sale({ status: 'quote' }), sale({ id: 'sale-2', status: 'declined' })],
      bookings: [booking({ status: 'in_progress' }), booking({ id: 'bk-2', invoice: undefined })],
      ...range,
    });
    expect(rows).toHaveLength(0);
  });

  it('excludes rows outside the date range', () => {
    const rows = buildFinancialLedger({
      sales: [sale({ createdAt: '2026-09-30T10:00:00.000Z' })],
      ...range,
    });
    expect(rows).toHaveLength(0);
  });

  it('treats a placed click & collect order as paid', () => {
    const rows = buildFinancialLedger({ orders: [order()], ...range });
    expect(rows[0].paymentState).toBe('paid');
    expect(rows[0].detail).toContain('click & collect');
  });

  it('derives VAT from a stored rate when the row has no VAT amount', () => {
    const rows = buildFinancialLedger({
      bookings: [booking({}, { vatAmount: undefined, grandTotal: 120 })],
      ...range,
    });
    // No stored vatAmount and no rate on the invoice means no VAT is assumed.
    expect(rows[0].vat).toBe(0);
    expect(rows[0].net).toBe(120);
  });
});

describe('financial summary', () => {
  it('aggregates paid, unpaid, VAT and a per-channel breakdown', () => {
    const rows = buildFinancialLedger({
      sales: [sale(), sale({ id: 'sale-2', paymentMethod: 'unpaid', grandTotal: 30, vatAmount: 5 })],
      bookings: [booking()],
      orders: [order()],
      ...range,
    });
    const s = summarizeLedger(rows);
    expect(s.gross).toBe(234);
    expect(s.net).toBe(199);
    expect(s.vat).toBe(35);
    expect(s.paid).toBe(204);
    expect(s.netPaid).toBe(174);
    expect(s.unpaid).toBe(30);
    expect(s.unpaidCount).toBe(1);
    expect(s.count).toBe(4);

    expect(s.byChannel.workshop.gross).toBe(120);
    expect(s.byChannel.workshop.paid).toBe(120);
    expect(s.byChannel.till.gross).toBe(90);
    expect(s.byChannel.till.unpaid).toBe(30);
    expect(s.byChannel.online.paid).toBe(24);
  });

  it('returns zeroed channels for an empty ledger', () => {
    const s = summarizeLedger([]);
    expect(s.gross).toBe(0);
    expect(s.byChannel.till.count).toBe(0);
    expect(s.byChannel.workshop.unpaid).toBe(0);
  });
});

describe('payment labels & helpers', () => {
  it('labels each workshop payment status', () => {
    expect(workshopPaymentLabel('paid_card')).toBe('Paid · Card');
    expect(workshopPaymentLabel('paid_cash')).toBe('Paid · Cash');
    expect(workshopPaymentLabel('paid_online')).toBe('Paid · Online');
    expect(workshopPaymentLabel('unpaid')).toBe('Unpaid');
    expect(isPaidWorkshopStatus('paid_online')).toBe(true);
    expect(isPaidWorkshopStatus('unpaid')).toBe(false);
  });

  it('handles date helpers', () => {
    expect(inRange('2026-10-06T12:00:00.000Z', '2026-10-01', '2026-10-31')).toBe(true);
    expect(inRange('2026-11-01', '2026-10-01', '2026-10-31')).toBe(false);
    expect(toIso({ seconds: 0 })).toContain('1970-01-01');
  });
});

describe('CSV export', () => {
  it('exports a ledger with VAT and payment columns', () => {
    const rows = buildFinancialLedger({ sales: [sale()], ...range });
    const csv = financialLedgerCsv(rows);
    const header = csv.split('\n')[0];
    expect(header).toContain('Net');
    expect(header).toContain('VAT');
    expect(header).toContain('Payment');
    expect(csv).toContain('SALE-2026-0001');
  });

  it('exports a tax summary with totals and channel rows', () => {
    const rows = buildFinancialLedger({ sales: [sale()], bookings: [booking()], ...range });
    const csv = financialSummaryCsv(summarizeLedger(rows));
    expect(csv).toContain('Gross income,180.00');
    expect(csv).toContain('VAT,30.00');
    expect(csv).toContain('workshop,120.00,100.00,20.00');
  });

  it('quotes cells containing commas', () => {
    const rows = buildFinancialLedger({
      sales: [sale({ customerName: 'Smith, John' })],
      ...range,
    });
    expect(financialLedgerCsv(rows)).toContain('"Smith, John"');
  });
});
