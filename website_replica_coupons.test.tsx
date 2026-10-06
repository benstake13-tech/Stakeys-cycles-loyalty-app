import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

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

import { WebsiteReplica } from './src/components/WebsiteReplica';

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
});
