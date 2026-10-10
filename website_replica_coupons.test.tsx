import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

/** Renders the public site and routes to the Offers page where codes live. */
function renderOffers() {
  render(<WebsiteReplica context="public" onBookService={vi.fn()} />);
  fireEvent.click(screen.getByText(/See all offers/i));
}

describe('website coupon panel', () => {
  it('shows the curated public welcome codes to a signed-out visitor', () => {
    renderOffers();
    // The live discount_codes table may not have the audience migration yet, so
    // the curated public set must still render.
    expect(screen.getAllByText('WEB-5OFF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('WEB-5CREDIT').length).toBeGreaterThan(0);
  });

  it('does not leak member-only codes to a signed-out visitor', () => {
    renderOffers();
    expect(screen.queryByText('MEM-15OFF')).toBeNull();
    expect(screen.getAllByText(/Sign in/i).length).toBeGreaterThan(0);
  });

  it('offers a one-tap way to use a code', () => {
    renderOffers();
    expect(screen.getAllByText(/Use this code/i).length).toBeGreaterThan(0);
  });

  it('keeps discount codes off the brand-first home page but links to all offers', () => {
    render(<WebsiteReplica context="public" onBookService={vi.fn()} />);
    // The Home page leads with the brand story and demotes offers to one row.
    expect(screen.getByTestId('home-brand-story')).toBeTruthy();
    expect(screen.queryByText(/Current discount codes/i)).toBeNull();
    expect(screen.getByTestId('home-offers-teaser')).toBeTruthy();
    expect(screen.getByText(/See all offers/i)).toBeTruthy();
  });

  it('recovers codes on a pre-migration DB where the audience column is missing', () => {
    // The live rows exist but read back with no audience tag (42703 on the
    // column), which previously made the panel show "0 available".
    hoisted.discountCodes = [
      { id: 'disc-329537', code: 'WEB-5OFF', title: 'Welcome 5% off', status: 'active' },
      { id: 'disc-425356', code: 'MEM-15OFF', title: 'Members 15% off labour', status: 'active' },
    ];
    renderOffers();
    expect(screen.getAllByText('WEB-5OFF').length).toBeGreaterThan(0);
    expect(screen.queryByText('MEM-15OFF')).toBeNull();
    expect(screen.queryByText(/No active coupon codes right now/i)).toBeNull();
  });

  it('lets a visitor copy a code for use in-store', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderOffers();
    const copyButtons = screen.getAllByTitle('Copy code');
    fireEvent.click(copyButtons[0]);
    expect(writeText).toHaveBeenCalled();
  });

  it('lets a visitor copy a shareable offer link carrying the code', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderOffers();
    const linkButtons = screen.getAllByTitle('Copy shareable offer link');
    expect(linkButtons.length).toBeGreaterThan(0);
    fireEvent.click(linkButtons[0]);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toMatch(/\?code=WEB-/);
  });
});

describe('website public/embedded context split', () => {
  it('marks the standalone public website as the public context', () => {
    render(<WebsiteReplica context="public" onBookService={vi.fn()} />);
    expect(screen.getByTestId('website-context-badge').textContent).toMatch(/Public website/i);
  });

  it('marks the embedded customer-app Website tab as the embedded context', () => {
    render(<WebsiteReplica context="embedded" onBookService={vi.fn()} />);
    expect(screen.getByTestId('website-context-badge').textContent).toMatch(/Customer app preview/i);
  });

  it('defaults to the public context when no context is passed', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    expect(screen.getByTestId('website-context-badge').textContent).toMatch(/Public website/i);
  });
});
