import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {
  from: (table: string) => {
    const query: any = {
      select: () => query, order: () => query, eq: () => query,
      range: async () => ({ error: null, data: table === 'marketplace_records' ? [{
        listing_id: 'bike-1', seller_id: 'seller-1',
        seller_snapshot: { id: 'seller-1', name: 'Alex Seller', email: 'seller@example.com' },
        bike_snapshot: { title: 'Road bike', make_model: 'Trek Domane', category: 'bicycle', condition: 'good', frame_serial: 'ABC123', asking_price: 450 },
        sale_mode: 'auction', listing_status: 'sold', listing_created_at: '2026-10-01T12:00:00Z', recorded_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-17T12:00:00Z',
      }] : [{
        id: 1, listing_id: 'bike-1', event_type: 'bid_placed', actor_id: 'bidder-1',
        people: { bidder: { id: 'bidder-1', name: 'Sam Bidder', email: 'bidder@example.com' } },
        details: { amount: 500 }, bike_snapshot: null, occurred_at: '2026-10-17T12:00:00Z',
      }] }),
    };
    return query;
  },
} }));

import { MarketplaceRecords } from './MarketplaceRecords';

describe('staff marketplace case records', () => {
  it('shows the saved bike, seller and bid participant from the history', async () => {
    render(<MarketplaceRecords/>);
    const record = await screen.findByRole('button', { name: /Road bike/ });
    record.click();
    expect(await screen.findByText('Alex Seller')).toBeTruthy();
    expect(screen.getByText(/ABC123/)).toBeTruthy();
    expect(await screen.findByText('Sam Bidder')).toBeTruthy();
    expect(screen.getByText('£500.00')).toBeTruthy();
  });
});
