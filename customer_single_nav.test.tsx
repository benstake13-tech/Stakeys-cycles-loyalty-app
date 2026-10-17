import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./src/config/surface', async importOriginal => ({
  ...await importOriginal<typeof import('./src/config/surface')>(),
  isCustomerSurface: true,
}));
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({
  currentUser: { uid: 'rider', displayName: 'Rider', role: 'customer', bikes: [], stamps: 0, points: 0 },
  bookings: [], theme: 'dark', scratchCard: null,
}) }));
vi.mock('./src/components/MarketplacePanel', () => ({ MarketplacePanel: () => null }));
vi.mock('jsbarcode', () => ({ default: vi.fn() }));

import { CustomerPortal } from './src/components/CustomerPortal';
import { CustomerDesktopNavigation } from './src/components/customer/CustomerDesktopNavigation';

describe('customer surface navigation', () => {
  it('renders one persistent bar and keeps the feature directory reachable', () => {
    render(<><CustomerPortal navigationRequest={{ section: 'more', nonce: 1 }} /><CustomerDesktopNavigation active="more" onSelect={() => {}} /></>);
    expect(screen.getAllByRole('navigation', { name: /Customer (app|primary) navigation/ })).toHaveLength(1);
    expect(screen.getByTestId('customer-tile-marketplace')).toBeTruthy();
    expect(screen.getByTestId('customer-tile-wallet')).toBeTruthy();
  });
});
