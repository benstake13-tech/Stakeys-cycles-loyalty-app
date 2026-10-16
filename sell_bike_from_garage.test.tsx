import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

const garageBike = {
  id: 'bike-1',
  category: 'cycle',
  categoryLabel: 'Road Bike',
  brand: 'Trek',
  model: 'Domane AL 2',
  year: '2020',
  colour: 'Matte Black',
  addedAt: new Date().toISOString(),
  healthStatus: 'healthy',
};

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: {
      uid: 'me-1',
      displayName: 'Ada Rider',
      membershipNumber: 'STK-777',
      role: 'customer',
      email: 'ada@example.com',
      stamps: 2,
      tickets: 0,
      points: 10,
      bikes: [garageBike],
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
vi.mock('./src/api/visionService', () => ({
  isBikeVisionConfigured: () => true,
  diagnoseFault: vi.fn(),
}));

import { CustomerPortal } from './src/components/CustomerPortal';

beforeEach(() => cleanup());

describe('Sell a bike from the garage', () => {
  it('offers a "Sell this bike" action on each garage bike', () => {
    render(<CustomerPortal />);
    expect(screen.getByTestId('sell-bike-bike-1')).toBeTruthy();
    expect(screen.getByText(/Sell this bike/i)).toBeTruthy();
  });

  it('opens the sell form pre-filled with the garage bike details', async () => {
    render(<CustomerPortal />);
    fireEvent.click(screen.getByTestId('sell-bike-bike-1'));

    await waitFor(() => expect(screen.getByTestId('tradein-form')).toBeTruthy());
    expect(screen.getByTestId('sell-prefill-banner')).toBeTruthy();

    const brand = screen.getByPlaceholderText('e.g. Giant') as HTMLInputElement;
    const model = screen.getByPlaceholderText('e.g. Escape 3') as HTMLInputElement;
    expect(brand.value).toBe('Trek');
    expect(model.value).toBe('Domane AL 2');
  });

  it('still opens a blank form from the launcher tile', async () => {
    render(<CustomerPortal />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByTestId('customer-tile-tradein'));
    await waitFor(() => expect(screen.getByTestId('tradein-form')).toBeTruthy());
    const brand = screen.getByPlaceholderText('e.g. Giant') as HTMLInputElement;
    expect(brand.value).toBe('');
    expect(screen.queryByTestId('sell-prefill-banner')).toBeNull();
  });
});
