import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SaleTransaction } from './src/types/bikeShop';

const hoisted = vi.hoisted(() => ({
  sales: [] as unknown[],
  bookings: [] as unknown[],
  orders: [] as unknown[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ sales: hoisted.sales, bookings: hoisted.bookings }),
}));

vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: hoisted.orders, error: null }),
        }),
      }),
    }),
  },
}));

import { FinancialReportingTab } from './src/components/FinancialReportingTab';

const sale = (over: Partial<SaleTransaction> = {}): SaleTransaction =>
  ({
    id: 'sale-1',
    saleNumber: 'SALE-2026-0001',
    customerName: 'Ada Rider',
    items: [{ name: 'Inner tube', quantity: 1, unitPrice: 10, total: 10, category: 'Parts' }],
    createdAt: new Date('2026-10-05T10:00:00.000Z'),
    status: 'completed',
    grandTotal: 60,
    vatAmount: 10,
    paymentMethod: 'card',
    ...over,
  } as SaleTransaction);

beforeEach(() => {
  hoisted.sales = [];
  hoisted.bookings = [];
  hoisted.orders = [];
});

describe('FinancialReportingTab — branded, informative, anonymised print document', () => {
  it('renders a branded print letterhead with the business details', () => {
    render(<FinancialReportingTab />);
    const blocks = document.querySelectorAll('.print-only');
    expect(blocks.length).toBeGreaterThan(0);
    const text = Array.from(blocks).map((b) => b.textContent).join(' ');
    expect(text).toContain("Stakey's Cycles");
    expect(text).toContain('Salford, Greater Manchester M6 6QS');
    expect(text).toContain('Financial Report');
    expect(text).toContain('GB 892 1049 82');
  });

  it('explains the basis of preparation so the paper report stands alone', () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    const notes = Array.from(document.querySelectorAll('.print-only'))
      .map((b) => b.textContent)
      .join(' ');
    expect(notes).toContain('Notes & basis of preparation');
    expect(notes).toContain('Quotes, declined and unsigned work are excluded');
    expect(notes).toContain('anonymised');
  });

  it('shows the customer column on screen but marks it print-hidden', () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    // On-screen ledger still shows who paid…
    expect(screen.getAllByText('Ada Rider').length).toBeGreaterThan(0);
    // …but every personal-data cell carries the no-print class.
    const cells = screen.getAllByText('Ada Rider');
    cells.forEach((cell) => expect(cell.className).toContain('no-print'));
  });

  it('keeps the customer header out of the printed document', () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    const customerHeader = screen.getByText('Customer');
    expect(customerHeader.className).toContain('no-print');
  });

  it('summarises takings by payment method', () => {
    hoisted.sales = [
      sale({ id: 's1', saleNumber: 'SALE-1', paymentMethod: 'card' }),
      sale({ id: 's2', saleNumber: 'SALE-2', paymentMethod: 'cash' }),
    ];
    render(<FinancialReportingTab />);
    expect(screen.getByText('Takings by payment method')).toBeTruthy();
  });
});
