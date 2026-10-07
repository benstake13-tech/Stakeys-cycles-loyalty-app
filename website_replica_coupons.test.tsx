import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

const hoisted = vi.hoisted(() => ({
  discountCodes: [] as any[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: null,
    theme: 'dark',
    promotions: [],
    discountCodes: hoisted.discountCodes,
    recordDiscountUsage: vi.fn(),
  }),
}));

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => DEFAULT_WEBSITE_CONTENT,
}));

import { WebsiteReplica } from './src/components/WebsiteReplica';

beforeEach(() => {
  hoisted.discountCodes = [];
});

describe('website coupon panel', () => {
  it('shows the curated public welcome codes to a signed-out visitor', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    // The live discount_codes table may not have the audience migration yet, so
    // the curated public set must still render.
    expect(screen.getAllByText('WEB-5OFF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('WEB-5CREDIT').length).toBeGreaterThan(0);
  });

  it('does not leak member-only codes to a signed-out visitor', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    expect(screen.queryByText('MEM-15OFF')).toBeNull();
    expect(screen.getAllByText(/Sign in/i).length).toBeGreaterThan(0);
  });

  it('offers a one-tap way to use a code', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    expect(screen.getAllByText(/Use this code/i).length).toBeGreaterThan(0);
  });

  it('surfaces the current codes on the home page with a route to all offers', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    expect(screen.getByText(/Current discount codes/i)).toBeTruthy();
    expect(screen.getByText(/See all offers/i)).toBeTruthy();
  });

  it('recovers codes on a pre-migration DB where the audience column is missing', () => {
    // The live rows exist but read back with no audience tag (42703 on the
    // column), which previously made the panel show "0 available".
    hoisted.discountCodes = [
      { id: 'disc-329537', code: 'WEB-5OFF', title: 'Welcome 5% off', status: 'active' },
      { id: 'disc-425356', code: 'MEM-15OFF', title: 'Members 15% off labour', status: 'active' },
    ];
    render(<WebsiteReplica onBookService={vi.fn()} />);
    expect(screen.getAllByText('WEB-5OFF').length).toBeGreaterThan(0);
    expect(screen.queryByText('MEM-15OFF')).toBeNull();
    expect(screen.queryByText(/No active coupon codes right now/i)).toBeNull();
  });
});
