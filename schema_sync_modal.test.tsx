import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ refreshDatabaseState: vi.fn(async () => {}) }));

vi.mock('./src/shared/context/ShopContext', () => ({
  useShop: () => ({ refreshDatabaseState: hoisted.refreshDatabaseState }),
}));

import { SchemaSyncModal } from './src/components/SchemaSyncModal';

const okReport = {
  checkedAt: '10:00:00',
  reachable: true,
  missingTables: [],
  missingColumns: [],
  warnings: [],
  totalColumns: 150,
  healthy: true,
};

beforeEach(() => {
  vi.restoreAllMocks();
  hoisted.refreshDatabaseState = vi.fn(async () => {});
  localStorage.setItem('stakeys_supabase_anon_key', 'test-key');
});

describe('SchemaSyncModal', () => {
  it('shows a healthy state when the live schema matches', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
    render(<SchemaSyncModal onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(/Schema matches the app/i)).toBeTruthy()
    );
  });

  it('lists drift and offers the sync SQL when columns are missing', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Only customer_bikes.bike_details is missing.
      if (url.includes('/customer_bikes?') && url.includes('bike_details')) {
        return new Response('', { status: 400 });
      }
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    render(<SchemaSyncModal onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText(/schema issue/i)).toBeTruthy());
    expect(screen.getByText(/customer_bikes\.bike_details/)).toBeTruthy();
    expect(screen.getByText(/Copy Sync SQL/i)).toBeTruthy();
    expect(screen.getByText(/Open Supabase SQL Editor/i)).toBeTruthy();
  });

  it('reloads app data and re-audits when Reload is pressed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
    render(<SchemaSyncModal onClose={() => {}} />);
    const btn = await screen.findByRole('button', { name: /Reload App Data/i });
    fireEvent.click(btn);
    await waitFor(() => expect(hoisted.refreshDatabaseState).toHaveBeenCalled());
  });
});
