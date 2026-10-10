import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep the wishlist / trade-in stores offline.
vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

// Member with an almost-full stamp card so the reward nudge banner renders.
vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: {
      uid: 'me-1',
      displayName: 'Ada Rider',
      membershipNumber: 'STK-777',
      role: 'customer',
      email: 'ada@example.com',
      stamps: 9,
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
    updateCustomerBikeIdentity: vi.fn(),
    scratchCard: null,
    theme: 'dark',
  }),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./src/components/weather/WeatherForecast', () => ({ WeatherForecast: () => null }));
vi.mock('jsbarcode', () => ({ default: vi.fn() }));

import { CustomerPortal } from './src/components/CustomerPortal';

beforeEach(() => cleanup());

describe('CustomerPortal new sections', () => {
  it('exposes the new launcher tiles', () => {
    render(<CustomerPortal />);
    const launcher = screen.getByTestId('customer-section-launcher');
    for (const id of ['wallet', 'care', 'symptom', 'guides', 'tradein', 'wishlist']) {
      expect(within(launcher).queryByTestId(`customer-tile-${id}`)).toBeTruthy();
    }
  });

  it('surfaces the "almost there" reward nudge for a near-complete card', () => {
    render(<CustomerPortal />);
    expect(screen.getByTestId('reward-nudges')).toBeTruthy();
    expect(screen.getByText(/Only 1 stamp to your £40 reward/i)).toBeTruthy();
  });

  it('opens the Watchlist section from its tile', () => {
    render(<CustomerPortal />);
    fireEvent.click(screen.getByTestId('customer-tile-wishlist'));
    expect(screen.getByTestId('wishlist-panel')).toBeTruthy();
  });

  it('opens the How-To Guides section from its tile', () => {
    render(<CustomerPortal />);
    fireEvent.click(screen.getByTestId('customer-tile-guides'));
    expect(screen.getByTestId('care-guides')).toBeTruthy();
  });

  it('opens the Trade-In section from its tile', () => {
    render(<CustomerPortal />);
    fireEvent.click(screen.getByTestId('customer-tile-tradein'));
    expect(screen.getByTestId('tradein-form')).toBeTruthy();
  });
});
