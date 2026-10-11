import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

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
    currentUser: null,
    theme: 'dark',
    promotions: [],
    discountCodes: [],
    recordDiscountUsage: vi.fn(),
  }),
}));

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => DEFAULT_WEBSITE_CONTENT,
}));

// The AI vision service pulls in @google/genai; stub the two helpers the form uses.
vi.mock('./src/api/visionService', () => ({
  isBikeVisionConfigured: () => true,
  diagnoseFault: vi.fn(),
}));

import { WebsiteReplica } from './src/components/WebsiteReplica';

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('main website — Sell Your Bike page', () => {
  it('exposes a Sell Your Bike tab in the public navigation', () => {
    render(<WebsiteReplica context="public" onBookService={vi.fn()} />);
    expect(screen.getAllByText(/Sell Your Bike/i).length).toBeGreaterThan(0);
  });

  it('opens the seven-photo sell form from the tab', () => {
    render(<WebsiteReplica context="public" onBookService={vi.fn()} />);
    const tab = screen.getAllByText(/Sell Your Bike/i)[0];
    fireEvent.click(tab);
    expect(screen.getByTestId('tradein-form')).toBeTruthy();
    expect(screen.getByTestId('sell-angle-drive-side')).toBeTruthy();
    expect(screen.getByTestId('sell-angle-serial')).toBeTruthy();
  });
});
