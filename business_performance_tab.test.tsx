import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/utils/oauthService', () => ({
  OAUTH_PROVIDERS: {
    google: { label: 'Google Business Profile', clientIdEnv: 'VITE_GOOGLE_CLIENT_ID' },
    meta: { label: 'Meta (Facebook & Instagram)', clientIdEnv: 'VITE_META_APP_ID' },
  },
  isProviderConfigured: vi.fn(() => false),
  getStoredToken: vi.fn(() => null),
  isTokenExpired: vi.fn(() => true),
  disconnectProvider: vi.fn(),
  startOAuthPopup: vi.fn(),
}));

vi.mock('./src/utils/businessInsights', () => ({
  fetchInsights: vi.fn(),
  refreshServerManaged: vi.fn(async () => {}),
  isServerManaged: vi.fn(() => false),
}));

import { BusinessPerformanceTab } from './src/components/BusinessPerformanceTab';
import { fetchInsights, isServerManaged } from './src/utils/businessInsights';

const metaInsights = (over: Partial<any> = {}) => ({
  provider: 'meta',
  connected: true,
  live: true,
  accountLabel: "Stakey's cycles",
  windowLabel: 'Last 28 days',
  metrics: [{ label: 'Media Views', value: '277' }],
  ...over,
});

const googleInsights = {
  provider: 'google',
  connected: false,
  live: false,
  windowLabel: 'Last 28 days',
  metrics: [],
  message: 'Authorise with the provider to load live performance data.',
};

beforeEach(() => {
  vi.mocked(isServerManaged).mockReturnValue(false);
  vi.mocked(fetchInsights).mockImplementation(async (p: any) =>
    p === 'meta' ? metaInsights() : (googleInsights as any)
  );
});

describe('BusinessPerformanceTab — Meta is results-first (no link prompt)', () => {
  it('shows Meta results with a Refresh button and never an Authorise-with-Meta prompt', async () => {
    vi.mocked(isServerManaged).mockImplementation((p: any) => p === 'meta');
    render(<BusinessPerformanceTab />);

    await waitFor(() => expect(screen.getByText('Media Views')).toBeTruthy());
    expect(screen.getByText('277')).toBeTruthy();
    expect(screen.getByText(/Server linked/i)).toBeTruthy();
    // The Meta card offers Refresh (the small icon button plus the action button).
    expect(screen.getAllByRole('button', { name: /Refresh/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Authorise with Meta/i)).toBeNull();
  });

  it('still offers Refresh and shows a "token not set" state when the server token is absent', async () => {
    vi.mocked(isServerManaged).mockReturnValue(false);
    vi.mocked(fetchInsights).mockImplementation(async (p: any) =>
      p === 'meta'
        ? (metaInsights({
            connected: false,
            live: false,
            metrics: [],
            message: 'Meta results aren’t available yet — the server-side Meta token isn’t set.',
          }) as any)
        : (googleInsights as any)
    );
    render(<BusinessPerformanceTab />);

    await waitFor(() => expect(screen.getByText(/Token not set/i)).toBeTruthy());
    expect(screen.getByText(/server-side Meta token isn’t set/i)).toBeTruthy();
    expect(screen.queryByText(/Authorise with Meta/i)).toBeNull();
    // Google keeps its (disabled, unconfigured) Authorise button.
    expect(screen.getByText('Authorise with Google')).toBeTruthy();
  });
});
