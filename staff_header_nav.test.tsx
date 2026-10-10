import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// App pulls in the whole app; mock the heavy children so this test exercises
// only the header navigation wiring.
const hoisted = vi.hoisted(() => ({
  user: { uid: 'u1', displayName: 'Rider One', membershipNumber: 'STK-1', role: 'customer' } as
    | { uid: string; displayName: string; membershipNumber: string; role: string }
    | null,
}));

vi.mock('./src/context/ShopContext', () => ({
  ShopProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useShop: () => ({
    currentUser: hoisted.user,
    logoutUser: vi.fn(),
    loginStaff: vi.fn(),
    theme: 'dark',
    bookings: [],
    seasonalTheme: 'spring',
  }),
}));

vi.mock('./src/components/CustomerPortal', () => ({ CustomerPortal: () => <div data-testid="customer-portal" /> }));
vi.mock('./src/components/WebsiteReplica', () => ({ WebsiteReplica: () => <div data-testid="website" /> }));
vi.mock('./src/components/ShopAssistant', () => ({ ShopAssistant: () => null }));
vi.mock('./src/components/PromotionsCarousel', () => ({ PromotionsCarousel: () => <div data-testid="promotions" /> }));
vi.mock('./src/components/WinnerAnnouncementBanner', () => ({ WinnerAnnouncementBanner: () => null }));
vi.mock('./src/components/ThemeStage', () => ({ ThemeStage: () => null }));
vi.mock('./src/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('./src/components/StakeysLogo', () => ({ StakeysLogo: () => null }));
vi.mock('./src/components/DeliverablesViewer', () => ({ DeliverablesViewer: () => <div data-testid="deliverables" /> }));
vi.mock('./src/components/AvatarPreviewStage', () => ({ AvatarPreviewStage: () => null }));
vi.mock('./src/components/LoginScreen', () => ({ LoginScreen: () => <div data-testid="login" /> }));
vi.mock('react-hot-toast', () => ({ Toaster: () => null }));
vi.mock('./src/utils/pushNotifications', () => ({
  initOneSignal: vi.fn(),
  linkUser: vi.fn(),
  unlinkUser: vi.fn(),
  registerEmailSubscription: vi.fn(),
  ADMIN_NOTIFICATION_EMAIL: 'a@b.c',
}));

import App from './src/App';
import { isWebsiteSurface } from './src/config/surface';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  hoisted.user = { uid: 'u1', displayName: 'Rider One', membershipNumber: 'STK-1', role: 'customer' };
});

describe('staff header navigation', () => {
  it('shows no staff sign-in entry to a signed-in non-staff user', () => {
    render(<App />);
    // The desktop nav renders the primary tabs; the redundant "Staff Station"
    // sign-in door must not be offered to a plain customer.
    expect(screen.queryByRole('tab', { name: /Staff Station/i })).toBeNull();
    expect(screen.queryByText(/Staff Station/i)).toBeNull();
  });

  it('still shows staff tools to a signed-in staff user', () => {
    hoisted.user = { uid: 's1', displayName: 'Sam Staff', membershipNumber: '001', role: 'staff' };
    render(<App />);
    // The website surface ships a public-only shell (guest booking + marketing
    // site) with no tabbed nav at all, so it must never surface a staff door;
    // the Staff Terminal tab only exists on surfaces that render the nav.
    const staffTab = screen.queryByRole('tab', { name: /Staff Terminal/i });
    if (isWebsiteSurface) {
      expect(staffTab).toBeNull();
      return;
    }
    expect(staffTab).toBeTruthy();
  });
});
