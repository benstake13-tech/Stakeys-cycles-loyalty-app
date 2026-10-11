import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'u1', displayName: 'Ada Rider', email: 'ada@x.com', role: 'customer', membershipNumber: 'STK-1' },
  }),
}));

import { SellYourBikeForm, SELL_ANGLES } from './src/components/TradeInRequestForm';
import { StaffOfferPricesTab } from './src/components/StaffOfferPricesTab';
import { StaffTradeInsTab } from './src/components/StaffTradeInsTab';
import {
  getOfferPrices,
  upsertOfferPrice,
  deleteOfferPrice,
  resetOfferPrices,
} from './src/context/OfferPriceBook';
import { getTradeInRequests, deleteTradeInRequest, submitTradeInRequest } from './src/context/TradeInStore';

const selectPhoto = (input: HTMLElement) => {
  const file = new File(['fake-bytes'], 'bike.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  cleanup();
  localStorage.clear();
  resetOfferPrices();
  for (const r of getTradeInRequests()) deleteTradeInRequest(r.id);
});

describe('SellYourBikeForm — seven angle capture', () => {
  it('renders exactly seven guided angle slots', () => {
    render(<SellYourBikeForm />);
    expect(SELL_ANGLES).toHaveLength(7);
    for (const angle of SELL_ANGLES) {
      expect(screen.getByTestId(`sell-angle-${angle.id}`)).toBeTruthy();
    }
  });

  it('shows the Sell Your Bike heading', () => {
    render(<SellYourBikeForm />);
    expect(screen.getByText(/Sell Your Bike/i)).toBeTruthy();
  });

  it('requires a brand and model before submitting', () => {
    render(<SellYourBikeForm />);
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.queryByTestId('tradein-success')).toBeNull();
  });

  it('captures a sell lead with brand and model', () => {
    render(<SellYourBikeForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Giant'), { target: { value: 'Giant' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Escape 3'), { target: { value: 'Escape 3' } });
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.getByTestId('tradein-success')).toBeTruthy();
    const leads = getTradeInRequests();
    expect(leads).toHaveLength(1);
    expect(leads[0].brand).toBe('Giant');
    expect(leads[0].model).toBe('Escape 3');
  });

  it('accepts a photo into the first angle slot', async () => {
    render(<SellYourBikeForm />);
    fireEvent.click(screen.getByTestId('sell-angle-drive-side').querySelector('button')!);
    selectPhoto(screen.getByTestId('sell-photo-input'));
    await waitFor(() => {
      expect(screen.getByAltText('Drive side')).toBeTruthy();
    }, { timeout: 4000 });
  });
});

describe('OfferPriceBook store', () => {
  it('seeds sensible defaults', () => {
    const prices = getOfferPrices();
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.some((p) => p.brand === 'Trek')).toBe(true);
  });

  it('adds, edits and deletes a price', () => {
    const created = upsertOfferPrice({ brand: 'Raleigh', model: 'Pioneer', category: 'cycle', basePrice: 60 });
    expect(getOfferPrices().some((p) => p.id === created.id)).toBe(true);

    upsertOfferPrice({ id: created.id, brand: 'Raleigh', model: 'Pioneer', category: 'cycle', basePrice: 75 });
    expect(getOfferPrices().find((p) => p.id === created.id)?.basePrice).toBe(75);

    deleteOfferPrice(created.id);
    expect(getOfferPrices().some((p) => p.id === created.id)).toBe(false);
  });

  it('resets to the seeded defaults', () => {
    upsertOfferPrice({ brand: 'Test', model: 'X', category: 'cycle', basePrice: 10 });
    resetOfferPrices();
    expect(getOfferPrices().some((p) => p.brand === 'Test')).toBe(false);
  });
});

describe('StaffOfferPricesTab', () => {
  it('lists the seeded brands and adds a new price from the UI', () => {
    render(<StaffOfferPricesTab />);
    expect(screen.getByTestId('staff-offer-prices')).toBeTruthy();
    expect(screen.getByText(/Trek/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Add price/i));
    fireEvent.change(screen.getByPlaceholderText('e.g. Trek'), { target: { value: 'Raleigh' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Marlin 5'), { target: { value: 'Pioneer' } });
    fireEvent.change(screen.getByPlaceholderText('180'), { target: { value: '65' } });
    fireEvent.click(screen.getByText(/Add to price book/i));

    expect(getOfferPrices().some((p) => p.brand === 'Raleigh' && p.basePrice === 65)).toBe(true);
  });
});

describe('StaffTradeInsTab — sell-your-bike lead detail', () => {
  it('shows the customer photos, the AI offer and a final-offer input', () => {
    submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Trek',
      model: 'Marlin 5',
      condition: 'good',
      photos: [
        { angle: 'drive-side', label: 'Drive side', dataUrl: 'data:image/jpeg;base64,AAA' },
        { angle: 'front', label: 'Front-on', dataUrl: 'data:image/jpeg;base64,BBB' },
      ],
      offerEstimate: 230,
      offerRationale: ['Matched Trek Marlin 5 in the price book.'],
    });
    render(<StaffTradeInsTab />);
    expect(screen.getByAltText('Drive side')).toBeTruthy();
    expect(screen.getByText(/AI offer estimate/i)).toBeTruthy();
    expect(screen.getByText('£230')).toBeTruthy();
    expect(screen.getByTestId(/final-offer-/)).toBeTruthy();
  });

  it('saves a final offer entered by staff', () => {
    const lead = submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Trek',
      model: 'Marlin 5',
      condition: 'good',
    });
    render(<StaffTradeInsTab />);
    const input = screen.getByLabelText(/Final offer/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '210' } });
    fireEvent.click(screen.getByText('Save'));
    expect(getTradeInRequests().find((r) => r.id === lead.id)?.finalOffer).toBe(210);
  });
});
