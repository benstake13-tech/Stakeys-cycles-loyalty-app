import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// StaffPortal mounts many heavy tabs; stub all but the shell so this test
// exercises only the command bar, metric rail and launcher filter.
vi.mock('./src/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: null }) }) }) }) },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'staff-1', displayName: 'Sam Staff', membershipNumber: '007', role: 'staff' },
    users: [
      { uid: 'c1', role: 'customer', displayName: 'Ada', stamps: 10 },
      { uid: 'c2', role: 'customer', displayName: 'Ben', stamps: 3 },
    ],
    prizeWheels: [],
    draws: [],
    stampLogs: [],
    bookings: [{ uid: 'b1', status: 'confirmed', customerName: 'Ada', vehicleModel: 'Carrera', serviceTitle: 'Service' }],
    staffMembers: [],
    promotions: [{ id: 'p1', status: 'active' }],
    discountCodes: [],
    reviews: [],
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
    requestPushNotificationPermission: vi.fn(async () => 'granted'),
    hardResetApp: vi.fn(),
  }),
}));

vi.mock('./src/components/StaffNotificationSettings', () => ({ StaffNotificationSettings: () => null }));
vi.mock('./src/components/AssistantManagerTab', () => ({ AssistantManagerTab: () => null }));
vi.mock('./src/components/StaffDiagnosticsTab', () => ({ StaffDiagnosticsTab: () => null }));
vi.mock('./src/components/PerformanceTracker', () => ({ PerformanceTracker: () => null }));
vi.mock('./src/components/FinancialReportingTab', () => ({ FinancialReportingTab: () => null }));
vi.mock('./src/components/StaffBookingsTab', () => ({ StaffBookingsTab: () => null }));
vi.mock('./src/components/CustomerDatabaseTab', () => ({ CustomerDatabaseTab: () => null }));
vi.mock('./src/components/StaffManagementTab', () => ({ StaffManagementTab: () => null }));
vi.mock('./src/components/PromotionsManagerTab', () => ({ PromotionsManagerTab: () => null }));
vi.mock('./src/components/DiscountCodesTab', () => ({ DiscountCodesTab: () => null }));
vi.mock('./src/components/CounterSaleTab', () => ({ CounterSaleTab: () => null }));
vi.mock('./src/components/StaffBackendTab', () => ({ StaffBackendTab: () => null }));
vi.mock('./src/components/GoogleBusinessTab', () => ({ GoogleBusinessTab: () => null }));
vi.mock('./src/components/WebsiteContentManagerTab', () => ({ WebsiteContentManagerTab: () => null }));
vi.mock('./src/components/StaffReferralsTab', () => ({ StaffReferralsTab: () => null }));
vi.mock('./src/components/StaffTradeInsTab', () => ({ StaffTradeInsTab: () => null }));
vi.mock('./src/components/ReviewsTab', () => ({ ReviewsTab: () => null }));
vi.mock('./src/components/QRCodeScannerModal', () => ({ QRCodeScannerModal: () => null }));
vi.mock('./src/components/StaffThemeSelector', () => ({ StaffThemeSelector: () => null }));
vi.mock('./src/components/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('./src/components/PrizeWheelModal', () => ({ PrizeWheelModal: () => null }));
vi.mock('./src/components/WheelEditorModal', () => ({ WheelEditorModal: () => null }));
vi.mock('./src/components/weather/WeatherForecast', () => ({ WeatherForecast: () => null }));
vi.mock('./src/api/firebaseService', () => ({ canCustomerReceiveStampToday: () => true }));

import { openStaffApp } from './test/helpers/staffNavigation';
import { StaffPortal } from './src/components/StaffPortal';

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('staff command bar', () => {
  it('renders brand, operator badge and station status chips', () => {
    render(<StaffPortal />);
    const bar = screen.getByTestId('staff-command-bar');
    expect(bar).toBeTruthy();
    expect(bar.textContent).toMatch(/CYCLES/i);
    expect(screen.getByText('Sam Staff')).toBeTruthy();
    expect(screen.getByText('STATION')).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Open staff apps' })).toBeTruthy();
  });

  it('opens the searchable drawer without adding launcher tiles to Home', () => {
    render(<StaffPortal />);
    fireEvent.click(within(screen.getByTestId('staff-command-bar')).getByRole('button', { name: 'Open staff apps' }));
    const drawer = screen.getByRole('dialog', { name: 'All apps' });
    const search = within(drawer).getByRole('textbox', { name: 'Search staff apps' });
    fireEvent.change(search, { target: { value: 'sheldon' } });
    expect(within(drawer).getByRole('button', { name: 'Repair Guide' })).toBeTruthy();
    expect(within(drawer).queryByRole('button', { name: 'Till' })).toBeNull();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Clear app search' }));
    expect(within(drawer).getByRole('button', { name: 'Till' })).toBeTruthy();
  });

  it('shows an empty drawer search state and clears it', () => {
    render(<StaffPortal />);
    fireEvent.click(within(screen.getByTestId('staff-command-bar')).getByRole('button', { name: 'Open staff apps' }));
    const drawer = screen.getByRole('dialog', { name: 'All apps' });
    fireEvent.change(within(drawer).getByRole('textbox'), { target: { value: 'zzzzz' } });
    expect(within(drawer).getByText(/No apps match/i)).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Clear search' }));
    expect(within(drawer).getByRole('button', { name: 'Till' })).toBeTruthy();
  });

  it('enables push from the command bar', async () => {
    render(<StaffPortal />);
    // Scope to the command bar: the (mounted) settings pane also has a push button.
    const bar = screen.getByTestId('staff-command-bar');
    fireEvent.click(within(bar).getByText('Enable Push'));
    expect(await within(bar).findByText('Push On')).toBeTruthy();
  });
});

describe('staff live overview', () => {
  it('shows actual workshop counts as plain readouts with no metric tiles', () => {
    render(<StaffPortal />);
    const summary = screen.getByTestId('staff-home-summary');
    const valueFor = (label: string) => within(summary).getByText(label).nextElementSibling?.textContent;
    expect(valueFor('Total Riders')).toBe('2');
    expect(valueFor('Rewards Ready')).toBe('1');
    expect(valueFor('Workshop Jobs')).toBe('1');
    expect(valueFor('Live Promotions')).toBe('1');
    expect(within(summary).queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('staff-metric-rail')).toBeNull();
  });

  it('opens bookings from the drawer while keeping Home clear of tool tiles', () => {
    render(<StaffPortal />);
    openStaffApp('Bookings');
    expect(screen.getByTestId('staff-back-to-tools')).toBeTruthy();
    expect(screen.queryByTestId('staff-home-summary')).toBeNull();
  });
});
