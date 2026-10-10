import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  products: [] as any[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'staff-1', displayName: 'Ben', role: 'staff' },
    users: [],
    discountCodes: [],
    sales: [],
    createSaleQuote: vi.fn(),
    updateSaleQuote: vi.fn(),
    approveSale: vi.fn(),
    declineSale: vi.fn(),
    processSale: vi.fn(),
    redeemServiceVoucher: vi.fn(),
    resolveScannedMember: vi.fn(),
  }),
}));

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => ({ products: hoisted.products, priceList: [] }),
  updateWebsiteContent: vi.fn(),
}));

import { CounterSaleTab } from './src/components/CounterSaleTab';

beforeEach(() => {
  hoisted.products = [];
});

describe('till catalogue', () => {
  it('shows guidance when there is nothing to sell', () => {
    render(<CounterSaleTab />);
    expect(screen.getByText(/No items yet/i)).toBeTruthy();
  });

  it('renders a catalogue row for every item on the shelf', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 5 },
      { id: 'prod-b', name: 'Shimano front brake', price: 10, category: 'Second hand parts', image: '', stock: 2 },
    ];
    render(<CounterSaleTab />);
    expect(screen.getByText('Carrera titan')).toBeTruthy();
    expect(screen.getByText('Shimano front brake')).toBeTruthy();
    expect(screen.getByTestId('catalogue-stock-prod-a')).toBeTruthy();
  });

  it('adds a catalogue item to the basket as an editable line', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 5 },
    ];
    render(<CounterSaleTab />);
    fireEvent.click(screen.getByTestId('catalogue-stock-prod-a'));
    expect(screen.getByLabelText('Description for Carrera titan')).toBeTruthy();
    expect((screen.getByLabelText('Unit price for Carrera titan') as HTMLInputElement).value).toBe('150');
  });

  it('lets staff edit a basket line price and quantity directly', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 5 },
    ];
    render(<CounterSaleTab />);
    fireEvent.click(screen.getByTestId('catalogue-stock-prod-a'));

    const price = screen.getByLabelText('Unit price for Carrera titan') as HTMLInputElement;
    fireEvent.change(price, { target: { value: '120' } });
    expect(price.value).toBe('120');

    const qty = screen.getByLabelText('Quantity for Carrera titan') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '3' } });
    expect(qty.value).toBe('3');
    // Subtotal reflects the edited line: 3 × £120.
    expect(screen.getAllByText('£360.00').length).toBeGreaterThan(0);
  });

  it('caps a stock-backed line so the till never oversells the shelf', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 2 },
    ];
    render(<CounterSaleTab />);
    fireEvent.click(screen.getByTestId('catalogue-stock-prod-a'));
    const qty = screen.getByLabelText('Quantity for Carrera titan') as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '9' } });
    expect(qty.value).toBe('2');
  });

  it('filters the catalogue by search text', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 5 },
      { id: 'prod-b', name: 'Shimano front brake', price: 10, category: 'Second hand parts', image: '', stock: 2 },
    ];
    render(<CounterSaleTab />);
    fireEvent.change(screen.getByTestId('till-catalogue-search'), { target: { value: 'brake' } });
    expect(screen.queryByText('Carrera titan')).toBeNull();
    expect(screen.getByText('Shimano front brake')).toBeTruthy();
  });
});
