import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => hoisted.native } }));

// App pulls in the whole app; mock the heavy children so this test exercises
// only the header navigation wiring.
const hoisted = vi.hoisted(() => ({
  native: true,
  publicWebsite: false,
  user: { uid: 'u1', displayName: 'Rider One', membershipNumber: 'STK-1', role: 'customer' } as
    | { uid: string; displayName: string; membershipNumber: string; role: string }
    | null,
}));

vi.mock('./src/config/surface', async (importOriginal) => { const original = await importOriginal<typeof import('./src/config/surface')>(); return { ...original, get isWebsiteSurface() { return hoisted.publicWebsite || original.isWebsiteSurface; } }; });

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

vi.mock('./src/components/StaffPortal', () => ({ StaffPortal: ({ onOpenSurface }: any) => <div data-testid="staff-portal"><button onClick={() => onOpenSurface('customer')}>Open customer preview</button></div> }));
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
vi.mock('./src/components/ResetPasswordScreen', () => ({ ResetPasswordScreen: () => <div data-testid="reset-password" /> }));
vi.mock('./src/components/LoginScreen', () => ({ LoginScreen: () => <div data-testid="login" /> }));
vi.mock('react-hot-toast', () => ({ Toaster: () => null }));
vi.mock('./src/utils/pushNotifications', () => ({
  initOneSignal: vi.fn(),
  linkUser: vi.fn(async () => {}),
  unlinkUser: vi.fn(async () => {}),
  registerEmailSubscription: vi.fn(),
  consumeNativeNotificationOpenUrl: vi.fn(async () => null),
  ADMIN_NOTIFICATION_EMAIL: 'a@b.c',
}));

import App from './src/App';
import { isWebsiteSurface, isStaffSurface, isFullSurface } from './src/config/surface';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  hoisted.native = true;
  hoisted.publicWebsite = false;
  window.history.replaceState({}, '', '/');
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

  it('uses the staff drawer and dock instead of a second app-level menu, preserving preview access', async () => {
    hoisted.user = { uid: 's1', displayName: 'Sam Staff', membershipNumber: '001', role: 'staff' };
    render(<App />);
    if (isWebsiteSurface) return;
    if (isStaffSurface || isFullSurface) {
      expect(await screen.findByTestId('staff-portal')).toBeTruthy();
      expect(screen.queryByRole('tablist', { name: 'Primary navigation' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Open customer preview' }));
      expect(screen.getByTestId('customer-portal')).toBeTruthy();
    } else {
      expect(screen.getByRole('tab', { name: /Staff Terminal/i })).toBeTruthy();
    }
  });
});

// Browser landing pages must replace the app, including existing web sessions.
describe('browser app blanket', () => {
  it('keeps the public shop domain reachable even when a hosted app surface setting is stale', () => {
    hoisted.native = false; hoisted.publicWebsite = true;
    render(<App/>);
    expect(screen.getByTestId('website')).toBeTruthy();
    expect(screen.queryByText(/This web address does not provide account access/)).toBeNull();
  });
  it('keeps recovery links limited to password reset even with an existing session', () => {
    hoisted.native = false;
    window.history.replaceState({}, '', '/reset-password');
    render(<App />);
    if (!isWebsiteSurface) {
      expect(screen.getByTestId('reset-password')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByTestId('customer-portal')).toBeNull();
    }
  });
  it('replaces authenticated app navigation in a browser', () => {
    hoisted.native = false;
    render(<App />);
    if (isWebsiteSurface) {
      expect(screen.getByTestId('website')).toBeTruthy();
    } else {
      expect(screen.getByText(/This web address does not provide account access/)).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByTestId('login')).toBeNull();
    }
  });
  it('preserves the APK login screen', () => {
    hoisted.user = null;
    render(<App />);
    if (!isWebsiteSurface) expect(screen.getByTestId('login')).toBeTruthy();
  });
});
