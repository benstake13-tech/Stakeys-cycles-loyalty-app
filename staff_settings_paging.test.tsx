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
  // The admin nav is the tablist labelled "Admin and reports".
  const adminNav = screen.getByRole('tablist', { name: 'Admin and reports' });
  fireEvent.click(within(adminNav).getByRole('tab', { name: /Settings/i }));
  return screen.getByRole('tablist', { name: 'Settings sections' });
}

describe('staff Settings tab paging', () => {
  it('no longer duplicates admin tools on the top-level nav', () => {
    render(<StaffPortal />);
    for (const label of ['Admin and reports', 'Workshop operations']) {
      const nav = screen.getByRole('tablist', { name: label });
      // Tools that live only inside Settings now, including the Staff Station
      // which used to also have its own top-level tab.
      for (const gone of ['Assistant', 'Test Bench', 'Performance', 'Financials', 'Staff Station']) {
        expect(within(nav).queryByRole('tab', { name: gone })).toBeNull();
      }
    }
  });

  it('pages notifications, assistant, test bench, performance, financials and station', () => {
    const sections = openSettings();

    // Defaults to Notifications.
    expect(screen.getByTestId('notifications')).toBeTruthy();

    const go = (name: string) => fireEvent.click(within(sections).getByRole('tab', { name }));

    go('Assistant');
    expect(screen.getByTestId('assistant')).toBeTruthy();
    expect(screen.queryByTestId('notifications')).toBeNull();

    go('Test Bench');
    expect(screen.getByTestId('test-bench')).toBeTruthy();

    go('Performance');
    expect(screen.getByTestId('performance')).toBeTruthy();

    go('Financials');
    expect(screen.getByTestId('financials')).toBeTruthy();

    go('Staff Station');
    // The station section folded in the old top-level tab's unique controls.
    expect(screen.getByText(/Staff Command Station/i)).toBeTruthy();
    expect(screen.getByText('Draw Pool')).toBeTruthy();
    expect(screen.getByText(/Scan Member Code/i)).toBeTruthy();
    expect(screen.queryByTestId('financials')).toBeNull();
  });

  it('defaults to Notifications when nothing is remembered', () => {
    openSettings();
    expect(screen.getByTestId('notifications')).toBeTruthy();
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
    expect(screen.queryByTestId('notifications')).toBeNull();
    // The nav reflects the restored section too.
    expect(within(restored).getByRole('tab', { name: 'Test Bench' }).getAttribute('aria-selected')).toBe('true');
  });
});
