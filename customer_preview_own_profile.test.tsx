import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock useShop so CustomerPortal renders the signed-in member's own data with no
// live network. The member switcher must never appear.
vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: {
      uid: 'me-1',
      displayName: 'Ada Rider',
      membershipNumber: 'STK-777',
      role: 'customer',
      email: 'ada@example.com',
      stamps: 4,
      tickets: 2,
      points: 120,
      bikes: [],
      avatarColor: '',
    },
    bookings: [],
    addCustomerBike: vi.fn(),
    removeCustomerBike: vi.fn(),
    repairCustomerGarage: vi.fn(),
    saveBikeScrapedSpecs: vi.fn(),
    updateCustomerAvatar: vi.fn(),
    theme: 'dark',
  }),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./src/components/WeatherForecast', () => ({ WeatherForecast: () => null }));
vi.mock('./src/components/weather/WeatherForecast', () => ({ WeatherForecast: () => null }));

import { CustomerPortal } from './src/components/CustomerPortal';

beforeEach(() => cleanup());

describe('Customer Preview', () => {
  it('renders only the signed-in member and offers no member switcher', () => {
    render(<CustomerPortal />);
    // Shows the signed-in member's own data (name appears in the hero + pass)...
    expect(screen.getAllByText(/Ada Rider/).length).toBeGreaterThan(0);
    // ...and no way to preview or switch to another account.
    expect(screen.queryByText(/preview as/i)).toBeNull();
    expect(screen.queryByText(/switch member/i)).toBeNull();
    expect(screen.queryByText(/select member/i)).toBeNull();
  });
});
