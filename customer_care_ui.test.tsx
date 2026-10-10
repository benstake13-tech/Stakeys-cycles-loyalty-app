import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomerBike, UserProfile } from './src/types/bikeShop';

// Keep the stores offline — their Supabase writes are best-effort background work.
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

// MembershipPassCard draws a barcode to a real SVG; stub it.
vi.mock('jsbarcode', () => ({ default: vi.fn() }));

// Shop context used by TradeInRequestForm.
vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'u1', displayName: 'Ada Rider', email: 'ada@x.com', role: 'customer', membershipNumber: 'STK-1' },
  }),
}));

// Website content used by WishlistPanel.
const contentState = { products: [] as any[] };
vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => contentState,
}));

import { CareSchedulePanel } from './src/components/CareSchedulePanel';
import { CareGuides } from './src/components/CareGuides';
import { WishlistPanel } from './src/components/WishlistPanel';
import { TradeInRequestForm } from './src/components/TradeInRequestForm';
import { NotifyMeButton } from './src/components/NotifyMeButton';
import { MembershipPassCard } from './src/components/MembershipPassCard';
import { backInStockItems, addToWishlist, getWishlist, clearWishlist } from './src/context/WishlistStore';
import { getTradeInRequests, deleteTradeInRequest } from './src/context/TradeInStore';

function bike(overrides: Partial<CustomerBike> = {}): CustomerBike {
  return {
    id: 'b1',
    category: 'cycle',
    categoryLabel: 'Standard Bicycle',
    brand: 'Trek',
    model: 'Marlin 5',
    addedAt: '2026-01-01',
    lastServiceDate: '2025-11-15',
    ...overrides,
  } as CustomerBike;
}

beforeEach(() => {
  cleanup();
  clearWishlist();
  localStorage.clear();
  contentState.products = [];
});

describe('CareSchedulePanel', () => {
  it('shows a per-bike care plan with an overdue badge and books the bike', () => {
    const onBookBike = vi.fn();
    render(<CareSchedulePanel bikes={[bike()]} onBookBike={onBookBike} />);
    expect(screen.getByText('Trek Marlin 5')).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
    fireEvent.click(screen.getByText(/Book this service/i));
    expect(onBookBike).toHaveBeenCalledWith('b1');
  });

  it('invites the customer to add a bike when the garage is empty', () => {
    render(<CareSchedulePanel bikes={[]} onBookBike={vi.fn()} />);
    expect(screen.getByText(/No bikes to schedule yet/i)).toBeTruthy();
  });
});

describe('CareGuides', () => {
  it('lists guides and opens one into a step-by-step view', () => {
    render(<CareGuides />);
    expect(screen.getByTestId('care-guides')).toBeTruthy();
    fireEvent.click(screen.getByTestId('guide-card-fix-a-puncture'));
    expect(screen.getByTestId('care-guide-viewer')).toBeTruthy();
    expect(screen.getByText(/Get the wheel off/i)).toBeTruthy();
    // Back to the list.
    fireEvent.click(screen.getByText(/All guides/i));
    expect(screen.getByTestId('care-guides')).toBeTruthy();
  });

  it('routes to booking from a guide CTA', () => {
    const onGoToBooking = vi.fn();
    render(<CareGuides onGoToBooking={onGoToBooking} />);
    fireEvent.click(screen.getByTestId('guide-card-when-to-book-a-service'));
    fireEvent.click(screen.getByText(/Book a service/i));
    expect(onGoToBooking).toHaveBeenCalled();
  });
});

describe('WishlistPanel', () => {
  it('lists watched items and flags one that is back in stock', () => {
    contentState.products = [{ id: 'p1', name: 'Helmet', stock: 4, price: 30, category: 'Accessories', image: '' }];
    addToWishlist({ productId: 'p1', title: 'Helmet', stockAtWatch: 0 });
    render(<WishlistPanel />);
    expect(screen.getByText('Helmet')).toBeTruthy();
    expect(screen.getAllByText(/Back in stock/i).length).toBeGreaterThan(0);
  });

  it('removes an item from the watchlist', () => {
    addToWishlist({ productId: 'p9', title: 'Bell', stockAtWatch: 0 });
    render(<WishlistPanel />);
    fireEvent.click(screen.getByLabelText(/Remove Bell from watchlist/i));
    expect(getWishlist()).toEqual([]);
  });

  it('backInStockItems only reports items that were out of stock and returned', () => {
    addToWishlist({ productId: 'a', title: 'A', stockAtWatch: 0 });
    addToWishlist({ productId: 'b', title: 'B', stockAtWatch: 5 });
    expect(backInStockItems({ a: 3, b: 5 }).map((i) => i.productId)).toEqual(['a']);
  });
});

describe('NotifyMeButton', () => {
  it('toggles a product onto the watchlist', () => {
    render(<NotifyMeButton product={{ id: 'p1', name: 'Helmet', stock: 0, price: 30, category: 'Accessories', image: '' } as any} />);
    const btn = screen.getByTestId('notify-me-p1');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(screen.getByTestId('notify-me-p1').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Watching')).toBeTruthy();
  });
});

describe('TradeInRequestForm', () => {
  it('requires a brand and model before submitting', () => {
    render(<TradeInRequestForm />);
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.queryByTestId('tradein-success')).toBeNull();
  });

  it('captures a trade-in lead and shows the confirmation', () => {
    render(<TradeInRequestForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Giant'), { target: { value: 'Giant' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Escape 3'), { target: { value: 'Escape 3' } });
    fireEvent.submit(screen.getByTestId('tradein-form').querySelector('form')!);
    expect(screen.getByTestId('tradein-success')).toBeTruthy();
    const leads = getTradeInRequests();
    expect(leads).toHaveLength(1);
    expect(leads[0].brand).toBe('Giant');
    expect(leads[0].status).toBe('new');
  });
});

describe('MembershipPassCard wallet', () => {
  const user = {
    uid: 'u1', email: 'r@x.com', role: 'customer', displayName: 'Rider One',
    membershipNumber: 'STK-123456', stamps: 4, tickets: 2, points: 75,
  } as UserProfile;

  it('hides wallet buttons when the server reports no wallet provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ apple: { configured: false }, google: { configured: false } }) })));
    render(<MembershipPassCard user={user} />);
    // Let the config fetch resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('add-to-wallet')).toBeNull();
  });

  it('shows the Google Wallet button when configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ apple: { configured: false }, google: { configured: true } }) })));
    render(<MembershipPassCard user={user} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId('add-to-wallet')).toBeTruthy();
    expect(screen.getByText(/Add to Google Wallet/i)).toBeTruthy();
  });
});
