import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  state: {
    currentUser: null as any,
    logoutUser: vi.fn(),
    loginStaff: vi.fn(async () => ({ success: true })),
    bookings: [] as any[],
    theme: 'dark',
    seasonalTheme: 'none',
  },
}));

vi.mock('./src/shared/context/ShopContext', () => ({
  ShopProvider: ({ children }: any) => children,
  useShop: () => hoisted.state,
}));

vi.mock('./src/components/StaffPortal', () => ({
  StaffPortal: () => <div data-testid="staff-terminal">WORKSHOP TERMINAL</div>,
}));
vi.mock('./src/components/DeliverablesViewer', () => ({ DeliverablesViewer: () => <div>deliverables</div> }));
vi.mock('./src/components/WinnerAnnouncementBanner', () => ({ WinnerAnnouncementBanner: () => null }));
vi.mock('./src/components/SeasonalThemeCanvas', () => ({ SeasonalThemeCanvas: () => null }));
vi.mock('./src/components/ServiceStatusBadge', () => ({ ServiceStatusBadge: () => null }));
vi.mock('./src/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('./src/components/StakeysLogo', () => ({ StakeysLogo: () => null }));
vi.mock('./src/shared/data/socialLinks', () => ({ SHOP_SOCIAL_LINKS: [] }));
vi.mock('./src/components/LegalDisclaimers', () => ({ LegalDisclaimersButton: () => null }));
vi.mock('./src/shared/utils/pushNotifications', () => ({
  initOneSignal: vi.fn(),
  linkUser: vi.fn(),
  relinkUser: vi.fn(),
  unlinkUser: vi.fn(),
}));

import App from './src/App';

beforeEach(() => {
  hoisted.state.currentUser = null;
  hoisted.state.bookings = [];
  hoisted.state.loginStaff.mockClear();
});

describe('Staff-only app shell', () => {
  it('shows the dedicated staff sign-in and no customer entry points', () => {
    render(<App />);

    expect(screen.getByText(/Workshop Staff Access/i)).toBeTruthy();

    // None of the customer surfaces may appear anywhere in this build.
    expect(screen.queryByText(/Customer Sign In/i)).toBeNull();
    expect(screen.queryByText(/Book Repair as Guest/i)).toBeNull();
    expect(screen.queryByText(/^Register$/)).toBeNull();
    expect(screen.queryByText(/Sign in to your loyalty pass/i)).toBeNull();
    expect(screen.queryByTestId('staff-terminal')).toBeNull();
  });

  it('signs in through the staff path and rejects non-staff accounts', async () => {
    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/staff@stakeyscycles.com/i), {
      target: { value: 'admin@stakeyscycles.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock Staff Terminal/i }));

    await waitFor(() => {
      expect(hoisted.state.loginStaff).toHaveBeenCalledWith('admin@stakeyscycles.com', 'secret');
    });
  });

  it('renders the workshop terminal for a verified staff account', () => {
    hoisted.state.currentUser = {
      uid: 'staff-1',
      role: 'staff',
      displayName: 'Workshop Admin',
      email: 'admin@stakeyscycles.com',
    };
    render(<App />);

    expect(screen.getByTestId('staff-terminal')).toBeTruthy();
    expect(screen.getByText(/Staff Verified/i)).toBeTruthy();
    expect(screen.queryByText(/Workshop Staff Access/i)).toBeNull();
  });

  it('blocks a signed-in customer from the terminal', () => {
    hoisted.state.currentUser = {
      uid: 'cust-1',
      role: 'customer',
      displayName: 'Alex Rider',
      email: 'alex@example.com',
    };
    render(<App />);

    expect(screen.getByText(/Staff Access Only/i)).toBeTruthy();
    expect(screen.queryByTestId('staff-terminal')).toBeNull();
  });
});
