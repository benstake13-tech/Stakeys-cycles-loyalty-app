import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SaleTransaction } from './src/types/bikeShop';

const hoisted = vi.hoisted(() => ({
  sales: [] as unknown[],
  bookings: [] as unknown[],
  orders: [] as unknown[],
  deleteBooking: vi.fn(async () => ({ success: true })),
  resetBookingsAndFinancials: vi.fn(async () => ({ success: true, message: 'ok' })),
  hardResetApp: vi.fn(),
  deleteCounterSaleFromDb: vi.fn(async () => true),
  deleteOrderFromDb: vi.fn(async () => true),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    sales: hoisted.sales,
    bookings: hoisted.bookings,
    deleteBooking: hoisted.deleteBooking,
    resetBookingsAndFinancials: hoisted.resetBookingsAndFinancials,
    hardResetApp: hoisted.hardResetApp,
  }),
}));

vi.mock('./src/api/backendDataService', () => ({
  deleteCounterSaleFromDb: hoisted.deleteCounterSaleFromDb,
  deleteOrderFromDb: hoisted.deleteOrderFromDb,
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
  hoisted.deleteBooking.mockClear();
  hoisted.resetBookingsAndFinancials.mockClear();
  hoisted.hardResetApp.mockClear();
  hoisted.deleteCounterSaleFromDb.mockClear();
  hoisted.deleteOrderFromDb.mockClear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
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

  it('offers branded CSV, Excel and Tax Summary PDF exports', () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    expect(screen.getByText('Export CSV')).toBeTruthy();
    expect(screen.getByText('Excel (.xlsx)')).toBeTruthy();
    expect(screen.getByText('Tax Summary PDF')).toBeTruthy();
  });
});

describe('FinancialReportingTab — per-record delete and full reset', () => {
  it('renders a Delete button on every ledger row', () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    expect(screen.getByTestId('delete-ledger-till-sale-1')).toBeTruthy();
  });

  it('deletes a till sale from the DB and drops the row', async () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    fireEvent.click(screen.getByTestId('delete-ledger-till-sale-1'));
    await waitFor(() => expect(hoisted.deleteCounterSaleFromDb).toHaveBeenCalledWith('sale-1'));
    // The row disappears from the ledger once removed.
    await waitFor(() => expect(screen.queryByTestId('delete-ledger-till-sale-1')).toBeNull());
  });

  it('deletes an online order from the DB', async () => {
    hoisted.orders = [
      { id: 'order-abc123', customer_name: 'Pat', contact: '', total: 25, items: [{ name: 'x', qty: 1, price: 25 }], created_at: new Date().toISOString() },
    ];
    render(<FinancialReportingTab />);
    fireEvent.click(await screen.findByTestId('delete-ledger-online-order-abc123'));
    await waitFor(() => expect(hoisted.deleteOrderFromDb).toHaveBeenCalledWith('order-abc123'));
  });

  it('deletes a workshop booking (and its invoice) through the context', async () => {
    hoisted.bookings = [
      {
        id: 'bk-1',
        customerName: 'Sam',
        serviceTitle: 'Full service',
        vehicleModel: 'Trek Domane',
        status: 'completed',
        preferredDate: new Date().toISOString(),
        invoice: { invoiceNumber: 'INV-1', grandTotal: 120, vatAmount: 20, paymentStatus: 'paid_card', completedAt: new Date().toISOString() },
      },
    ];
    render(<FinancialReportingTab />);
    fireEvent.click(await screen.findByTestId('delete-ledger-workshop-bk-1'));
    await waitFor(() => expect(hoisted.deleteBooking).toHaveBeenCalledWith('bk-1'));
  });

  it('leaves the record in place when the DB delete fails', async () => {
    hoisted.deleteCounterSaleFromDb.mockResolvedValueOnce(false);
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    fireEvent.click(screen.getByTestId('delete-ledger-till-sale-1'));
    await waitFor(() => expect(hoisted.deleteCounterSaleFromDb).toHaveBeenCalled());
    expect(screen.getByTestId('delete-ledger-till-sale-1')).toBeTruthy();
  });

  it('does not delete when the confirmation is cancelled', () => {
    (window.confirm as any).mockReturnValueOnce(false);
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    fireEvent.click(screen.getByTestId('delete-ledger-till-sale-1'));
    expect(hoisted.deleteCounterSaleFromDb).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-ledger-till-sale-1')).toBeTruthy();
  });

  it('resets all financials and bookings, then reloads the app', async () => {
    hoisted.sales = [sale()];
    render(<FinancialReportingTab />);
    fireEvent.click(screen.getByTestId('reset-financials-bookings'));
    await waitFor(() => expect(hoisted.resetBookingsAndFinancials).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hoisted.hardResetApp).toHaveBeenCalledTimes(1));
  });
});
