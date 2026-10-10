import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// StaffPortal mounts many heavy tabs; stub all but the guide so this test
// exercises only the Repair Guide tile -> view wiring.
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
    theme: 'dark',
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
import { StaffRepairGuideTab } from './src/components/StaffRepairGuideTab';

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe('staff Repair Guide tile', () => {
  it('exposes a Repair Guide tile in the launcher', () => {
    render(<StaffPortal />);
    const tile = screen.getByTestId('staff-tile-repair_guide');
    expect(tile).toBeTruthy();
    expect(screen.getAllByText('Repair Guide').length).toBeGreaterThan(0);
  });

  it('opens the guide view when the tile is selected', () => {
    render(<StaffPortal />);
    fireEvent.click(screen.getByTestId('staff-tile-repair_guide'));
    const pane = document.querySelector('[data-staff-view="repair_guide"]');
    expect(pane).toBeTruthy();
    expect(pane!.className).toContain('block');
  });
});

describe('StaffRepairGuideTab', () => {
  it('embeds the static guide bundle', () => {
    render(<StaffRepairGuideTab />);
    const frame = screen.getByTestId('guide-frame') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toContain('/guide/index.html');
    expect(screen.getByTestId('guide-open-new').getAttribute('href')).toContain('/guide/index.html');
  });

  it('toggles full screen', () => {
    render(<StaffRepairGuideTab />);
    fireEvent.click(screen.getByTestId('guide-fullscreen'));
    const frame = screen.getByTestId('guide-frame') as HTMLIFrameElement;
    expect(frame.className).toContain('h-full');
  });
});
