import React from 'react';
import { render, screen, fireEvent, within, cleanup, act } from '@testing-library/react';
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
vi.mock('./src/components/WebsiteReplica', () => ({ WebsiteReplica: ({ onBookService }: any) => <div data-testid="website"><button onClick={onBookService}>Book a repair</button></div> }));
vi.mock('./src/components/BookingPortal', () => ({ BookingPortal: () => <div data-testid="booking-page">Workshop booking</div> }));
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

// Customer browser landing pages remain app-only; staff can sign in on the web.
describe('browser surface access', () => {
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
  it('keeps staff workspace access while covering customer browser sessions', () => {
    hoisted.native = false;
    hoisted.user = { uid: 's1', displayName: 'Sam Staff', membershipNumber: '001', role: 'staff' };
    render(<App />);
    if (isWebsiteSurface) {
      expect(screen.getByTestId('website')).toBeTruthy();
    } else if (isStaffSurface || isFullSurface) {
      expect(screen.getByTestId('staff-portal')).toBeTruthy();
      expect(screen.queryByText(/This web address does not provide account access/)).toBeNull();
    } else {
      expect(screen.getByText(/This web address does not provide account access/)).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByTestId('login')).toBeNull();
    }
  });
  it('shows staff browser sign-in instead of installation guidance', () => {
    hoisted.native = false; hoisted.user = null;
    render(<App />);
    if (isStaffSurface || isFullSurface) {
      expect(screen.getByTestId('login')).toBeTruthy();
      expect(screen.queryByText(/This web address does not provide account access/)).toBeNull();
    }
  });
  it('preserves the APK login screen', () => {
    hoisted.user = null;
    render(<App />);
    if (!isWebsiteSurface) expect(screen.getByTestId('login')).toBeTruthy();
  });
});


describe('public bookings page', () => {
  it('opens directly at /bookings and retains the page on refresh', () => {
    hoisted.publicWebsite = true; hoisted.user = null;
    window.history.replaceState({}, '', '/bookings');
    const view = render(<App />);
    expect(screen.getByTestId('booking-page')).toBeTruthy();
    expect(screen.queryByTestId('website')).toBeNull();
    view.unmount(); render(<App />);
    expect(screen.getByTestId('booking-page')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back to website/ }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByTestId('website')).toBeTruthy();
  });
  it('uses the bookings URL for website calls to action and responds to browser history', () => {
    hoisted.publicWebsite = true; hoisted.user = null;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Book a repair' }));
    expect(window.location.pathname).toBe('/bookings');
    expect(screen.getByTestId('booking-page')).toBeTruthy();
    act(() => { window.history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByTestId('website')).toBeTruthy();
    act(() => { window.history.replaceState({}, '', '/bookings/'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByTestId('booking-page')).toBeTruthy();
  });
});
