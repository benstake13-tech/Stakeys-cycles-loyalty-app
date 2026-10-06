import React from 'react';
import { render, screen } from '@testing-library/react';
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
  useWebsiteContent: () => ({ products: hoisted.products }),
  updateWebsiteContent: vi.fn(),
}));

import { CounterSaleTab } from './src/components/CounterSaleTab';

beforeEach(() => {
  hoisted.products = [];
});

describe('till stock buttons', () => {
  it('shows no shop-stock buttons when the shelf is empty', () => {
    render(<CounterSaleTab />);
    expect(screen.getByText(/No products set up yet/i)).toBeTruthy();
  });

  it('renders a till button for every item on the shelf', () => {
    hoisted.products = [
      { id: 'prod-a', name: 'Carrera titan', price: 150, category: 'Mens Bikes', image: '', stock: 5 },
      { id: 'prod-b', name: 'Shimano front brake', price: 10, category: 'Second hand parts', image: '', stock: 2 },
    ];
    render(<CounterSaleTab />);
    expect(screen.getByText('Carrera titan')).toBeTruthy();
    expect(screen.getByText('Shimano front brake')).toBeTruthy();
    expect(screen.getByText('Shop stock (2)')).toBeTruthy();
  });
});
