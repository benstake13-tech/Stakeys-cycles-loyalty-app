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
    expect(screen.getByText(/CYCLES/i)).toBeTruthy();
    expect(screen.getByText('Sam Staff')).toBeTruthy();
    expect(screen.getByText('STATION')).toBeTruthy();
    expect(screen.getByLabelText('Search staff tools')).toBeTruthy();
  });

  it('filters the launcher tiles by search query and clears back', () => {
    render(<StaffPortal />);
    const search = screen.getByLabelText('Search staff tools') as HTMLInputElement;

    fireEvent.change(search, { target: { value: 'sheldon' } });
    // Only the repair-guide tile (which mentions Sheldon Brown) survives.
    expect(screen.getByTestId('staff-tile-repair_guide')).toBeTruthy();
    expect(screen.queryByTestId('staff-tile-till')).toBeNull();
    expect(screen.queryByTestId('staff-tile-backend')).toBeNull();

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByTestId('staff-tile-till')).toBeTruthy();
    expect(screen.getByTestId('staff-tile-backend')).toBeTruthy();
  });

  it('shows an empty state when nothing matches, and clears it', () => {
    render(<StaffPortal />);
    const search = screen.getByLabelText('Search staff tools') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'zzzzz' } });
    expect(screen.getByText(/No tools match/i)).toBeTruthy();
    fireEvent.click(screen.getByText('Clear search'));
    expect(screen.getByTestId('staff-tile-till')).toBeTruthy();
  });

  it('enables push from the command bar', async () => {
    render(<StaffPortal />);
    // Scope to the command bar: the (mounted) settings pane also has a push button.
    const bar = screen.getByTestId('staff-command-bar');
    fireEvent.click(within(bar).getByText('Enable Push'));
    expect(await within(bar).findByText('Push On')).toBeTruthy();
  });
});

describe('staff metric rail', () => {
  it('shows live KPI values derived from the store', () => {
    render(<StaffPortal />);
    expect(screen.getByTestId('staff-metric-rail')).toBeTruthy();
    // 2 customers, 1 with a full stamp card, 1 active booking, 1 live promo.
    expect(screen.getByTestId('staff-metric-riders').textContent).toContain('2');
    expect(screen.getByTestId('staff-metric-rewards').textContent).toContain('1');
    expect(screen.getByTestId('staff-metric-jobs').textContent).toContain('1');
    expect(screen.getByTestId('staff-metric-promos').textContent).toContain('1');
  });

  it('opens a tool when a metric card is clicked', () => {
    render(<StaffPortal />);
    fireEvent.click(screen.getByTestId('staff-metric-jobs'));
    // Opening a tool collapses the launcher and shows the active-tool header.
    expect(screen.getByTestId('staff-back-to-tools')).toBeTruthy();
    expect(screen.queryByTestId('staff-metric-rail')).toBeNull();
  });
});
