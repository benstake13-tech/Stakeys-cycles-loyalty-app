import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// StaffPortal pulls in a lot of heavy tabs; stub them so this test exercises
// only the navigation/paging wiring (which section renders for which tab).
const hoisted = vi.hoisted(() => ({ theme: 'dark' as const }));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'staff-1', displayName: 'Sam Staff', membershipNumber: '001', role: 'staff' },
    users: [],
    prizeWheels: [],
    draws: [],
    stampLogs: [],
    bookings: [],
    staffMembers: [],
    promotions: [],
    discountCodes: [],
    notificationPreferences: {},
    isStaffBookingSoundEnabled: false,
    workshopAudioVolume: 0.5,
    cycleWorkshopAudioVolume: 0.5,
    theme: hoisted.theme,
    addStamp: vi.fn(),
    redeemReward: vi.fn(),
    updateWheel: vi.fn(),
    executePrizeDraw: vi.fn(),
    createDraw: vi.fn(),
    updateDraw: vi.fn(),
    deleteDraw: vi.fn(),
    toggleStaffBookingSound: vi.fn(),
    playStaffBookingAlertPing: vi.fn(),
    requestPushNotificationPermission: vi.fn(),
    hardResetApp: vi.fn(),
  }),
}));

vi.mock('./src/components/StaffNotificationSettings', () => ({ StaffNotificationSettings: () => <div data-testid="notifications" /> }));
vi.mock('./src/components/AssistantManagerTab', () => ({ AssistantManagerTab: () => <div data-testid="assistant" /> }));
vi.mock('./src/components/StaffDiagnosticsTab', () => ({ StaffDiagnosticsTab: () => <div data-testid="test-bench" /> }));
vi.mock('./src/components/PerformanceTracker', () => ({ PerformanceTracker: () => <div data-testid="performance" /> }));
vi.mock('./src/components/FinancialReportingTab', () => ({ FinancialReportingTab: () => <div data-testid="financials" /> }));
vi.mock('./src/components/StaffBookingsTab', () => ({ StaffBookingsTab: () => <div data-testid="bookings" /> }));
vi.mock('./src/components/CustomerDatabaseTab', () => ({ CustomerDatabaseTab: () => <div data-testid="customers" /> }));
vi.mock('./src/components/StaffManagementTab', () => ({ StaffManagementTab: () => <div data-testid="team" /> }));
vi.mock('./src/components/PromotionsManagerTab', () => ({ PromotionsManagerTab: () => <div data-testid="promotions" /> }));
vi.mock('./src/components/DiscountCodesTab', () => ({ DiscountCodesTab: () => <div data-testid="discounts" /> }));
vi.mock('./src/components/CounterSaleTab', () => ({ CounterSaleTab: () => <div data-testid="till" /> }));
vi.mock('./src/components/StaffBackendTab', () => ({ StaffBackendTab: () => <div data-testid="backend" /> }));
vi.mock('./src/components/GoogleBusinessTab', () => ({ GoogleBusinessTab: () => <div data-testid="google" /> }));
vi.mock('./src/components/WebsiteContentManagerTab', () => ({ WebsiteContentManagerTab: () => <div data-testid="cms" /> }));
vi.mock('./src/components/StaffReferralsTab', () => ({ StaffReferralsTab: () => <div data-testid="referrals" /> }));
vi.mock('./src/components/QRCodeScannerModal', () => ({ QRCodeScannerModal: () => null }));
vi.mock('./src/components/StaffThemeSelector', () => ({ StaffThemeSelector: () => null }));
vi.mock('./src/components/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('./src/components/PrizeWheelModal', () => ({ PrizeWheelModal: () => null }));
vi.mock('./src/components/WheelEditorModal', () => ({ WheelEditorModal: () => null }));
vi.mock('./src/components/weather/WeatherForecast', () => ({ WeatherForecast: () => null }));
vi.mock('./src/api/firebaseService', () => ({ canCustomerReceiveStampToday: () => true }));

import { StaffPortal } from './src/components/StaffPortal';

beforeEach(() => {
  // Each test starts from a clean device: no remembered tab or settings section.
  localStorage.clear();
});

function openSettings() {
  render(<StaffPortal />);
  // The launcher is a grid of tiles; Settings is the last admin tile.
  fireEvent.click(screen.getByTestId('staff-tile-settings'));
  return screen.getByRole('tablist', { name: 'Settings sections' });
}

/** Whether a settings pane is the visible one (toggled via the `hidden` class). */
function isPaneShown(id: string): boolean {
  const el = document.querySelector(`[data-settings-pane="${id}"]`);
  return !!el && !el.className.includes('hidden');
}

/** Whether a staff view pane is the visible one (toggled via the `hidden` class). */
function isViewShown(id: string): boolean {
  const el = document.querySelector(`[data-staff-view="${id}"]`);
  return !!el && !el.className.includes('hidden');
}

describe('staff Settings tab paging', () => {
  it('exposes one launcher tile per tool and hides the settings-only tools', () => {
    render(<StaffPortal />);
    const launcher = screen.getByTestId('staff-tool-launcher');

    // The tools that live only inside Settings have no launcher tile.
    for (const gone of ['Assistant', 'Test Bench', 'Performance', 'Financials', 'Staff Station']) {
      expect(within(launcher).queryByText(gone)).toBeNull();
    }

    // Workspace groups replaced the old Operations/Admin headings.
    expect(within(launcher).getByText('01 / FRONT DESK')).toBeTruthy();
    expect(within(launcher).getByText('02 / WORKSHOP')).toBeTruthy();
    expect(within(launcher).getByText('05 / MANAGEMENT')).toBeTruthy();
    // Status pills use live data, and BLE Scan does not falsely claim a device
    // is connected before the technician pairs one.
    expect(within(launcher).getByText('0 Alerts')).toBeTruthy();
    expect(within(launcher).getByText('0 Members')).toBeTruthy();
    expect(within(launcher).getByText('BLE Scan')).toBeTruthy();
    for (const tool of ['till', 'bookings', 'customers', 'draws', 'staff_roster', 'weather',
      'website_cms', 'promotions', 'discount_codes', 'referrals', 'logs', 'backend', 'settings']) {
      expect(within(launcher).queryByTestId(`staff-tile-${tool}`)).toBeTruthy();
    }
  });

  it('pages notifications, assistant, test bench, performance, financials and station', () => {
    const sections = openSettings();

    // Defaults to Notifications.
    expect(screen.getByTestId('notifications')).toBeTruthy();

    const go = (name: string) => fireEvent.click(within(sections).getByRole('tab', { name }));

    // Every section stays mounted; the active one is shown, the rest are
    // toggled with CSS visibility (never unmounted) so the backdrop can't flash.
    go('Assistant');
    expect(screen.getByTestId('assistant')).toBeTruthy();
    expect(screen.getByTestId('notifications')).toBeTruthy();
    expect(isPaneShown('assistant')).toBe(true);
    expect(isPaneShown('notifications')).toBe(false);

    go('Test Bench');
    expect(screen.getByTestId('test-bench')).toBeTruthy();
    expect(isPaneShown('test_bench')).toBe(true);

    go('Performance');
    expect(screen.getByTestId('performance')).toBeTruthy();
    expect(isPaneShown('performance')).toBe(true);

    go('Financials');
    expect(screen.getByTestId('financials')).toBeTruthy();
    expect(isPaneShown('financials')).toBe(true);

    go('Staff Station');
    // The station section folded in the old top-level tab's unique controls.
    expect(screen.getByText(/Staff Command Station/i)).toBeTruthy();
    expect(screen.getByText('Draw Pool')).toBeTruthy();
    expect(screen.getByText(/Scan Member Code/i)).toBeTruthy();
    expect(isPaneShown('station')).toBe(true);
    expect(isPaneShown('financials')).toBe(false);
  });

  it('defaults to Notifications when nothing is remembered', () => {
    openSettings();
    expect(screen.getByTestId('notifications')).toBeTruthy();
  });

  it('keeps every settings section mounted, toggling visibility', () => {
    const sections = openSettings();
    // All six sections exist in the DOM at once (no unmount on switch).
    for (const pane of ['notifications', 'assistant', 'test_bench', 'performance', 'financials', 'station']) {
      expect(document.querySelector(`[data-settings-pane="${pane}"]`)).toBeTruthy();
    }
    fireEvent.click(within(sections).getByRole('tab', { name: 'Test Bench' }));
    // The switch flipped visibility rather than removing nodes.
    expect(isPaneShown('test_bench')).toBe(true);
    expect(isPaneShown('notifications')).toBe(false);
  });

  it('restores the last Settings section across a remount', () => {
    const sections = openSettings();
    fireEvent.click(within(sections).getByRole('tab', { name: 'Test Bench' }));
    expect(screen.getByTestId('test-bench')).toBeTruthy();
    expect(localStorage.getItem('stakeys_staff_settings_section')).toBe('test_bench');

    // Simulate the remount that used to snap the operator back to Notifications.
    cleanup();
    const restored = openSettings();
    expect(screen.getByTestId('test-bench')).toBeTruthy();
    expect(isPaneShown('test_bench')).toBe(true);
    expect(isPaneShown('notifications')).toBe(false);
    // The nav reflects the restored section too.
    expect(within(restored).getByRole('tab', { name: 'Test Bench' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps every staff view mounted and toggles it by CSS visibility', () => {
    render(<StaffPortal />);
    // The shell is always present.
    expect(document.querySelector('[data-staff-view="till"]')).toBeTruthy();
    // A non-active view is still in the DOM, just hidden.
    expect(document.querySelector('[data-staff-view="bookings"]')).toBeTruthy();
    expect(isViewShown('till')).toBe(true);
    expect(isViewShown('bookings')).toBe(false);
    fireEvent.click(screen.getByTestId('staff-tile-bookings'));
    expect(isViewShown('bookings')).toBe(true);
    expect(isViewShown('till')).toBe(false);
    // Nothing was unmounted.
    expect(document.querySelector('[data-staff-view="till"]')).toBeTruthy();
  });

  it('opens a tool from the launcher and returns via "Back to tools"', () => {
    render(<StaffPortal />);
    expect(screen.getByTestId('staff-tool-launcher')).toBeTruthy();
    expect(screen.queryByTestId('staff-back-to-tools')).toBeNull();

    fireEvent.click(screen.getByTestId('staff-tile-bookings'));
    // The launcher collapses to a "Back to tools" control.
    expect(screen.queryByTestId('staff-tool-launcher')).toBeNull();
    expect(screen.getByTestId('staff-back-to-tools')).toBeTruthy();
    expect(screen.getByTestId('staff-tool-page')).toBeTruthy();
    expect(screen.queryByTestId('staff-home-header')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeTruthy();
    expect(screen.getByTestId('ride-stage').getAttribute('data-ride-state')).toBe('entering');
    expect(isViewShown('bookings')).toBe(true);

    fireEvent.click(screen.getByTestId('staff-back-to-tools'));
    expect(screen.getByTestId('staff-tool-launcher')).toBeTruthy();
    expect(screen.queryByTestId('staff-tool-page')).toBeNull();
    expect(screen.getByTestId('staff-home-header')).toBeTruthy();
    expect(screen.getByTestId('ride-stage').getAttribute('data-ride-state')).toBe('exiting');
  });
});


describe('staff app primary navigation', () => {
  it('opens till and workshop tools and returns to the dashboard from the dock', () => {
    render(<StaffPortal />);
    const nav = screen.getByRole('navigation', { name: 'Staff dock' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Till' }));
    expect(screen.getByTestId('till').closest('[data-staff-view]')?.getAttribute('aria-hidden')).toBe('false');
    expect(within(nav).getByRole('button', { name: 'Till' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(within(nav).getByRole('button', { name: 'Workshop Tools' }));
    expect(document.querySelector('[data-staff-view="repair_guide"]')?.getAttribute('aria-hidden')).toBe('false');
    fireEvent.click(within(nav).getByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('staff-tool-launcher')).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
  });
});
