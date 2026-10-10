import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: { message: 'no column' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
  getSupabaseClient: () => ({}),
  AUTH_LINK_ON_LOAD: false,
}));

// StaffPortal mounts many heavy tabs; stub the ones we do not exercise.
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
vi.mock('./src/components/ReviewsTab', () => ({ ReviewsTab: () => null }));
vi.mock('./src/components/QRCodeScannerModal', () => ({ QRCodeScannerModal: () => null }));
vi.mock('./src/components/StaffThemeSelector', () => ({ StaffThemeSelector: () => null }));
vi.mock('./src/components/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('./src/components/PrizeWheelModal', () => ({ PrizeWheelModal: () => null }));
vi.mock('./src/components/WheelEditorModal', () => ({ WheelEditorModal: () => null }));
vi.mock('./src/components/weather/WeatherForecast', () => ({ WeatherForecast: () => null }));
vi.mock('./src/api/firebaseService', () => ({ canCustomerReceiveStampToday: () => true }));

import { StaffTradeInsTab } from './src/components/StaffTradeInsTab';
import { StaffPortal } from './src/components/StaffPortal';
import { submitTradeInRequest, getTradeInRequests, deleteTradeInRequest } from './src/context/TradeInStore';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  for (const r of getTradeInRequests()) deleteTradeInRequest(r.id);
});

describe('StaffTradeInsTab', () => {
  it('shows an empty state with no leads', () => {
    render(<StaffTradeInsTab />);
    expect(screen.getByText(/No trade-in leads yet/i)).toBeTruthy();
  });

  it('lists a submitted lead and advances its status', () => {
    submitTradeInRequest({
      customerName: 'Ada Rider',
      customerEmail: 'ada@x.com',
      brand: 'Giant',
      model: 'Escape 3',
      condition: 'good',
    });
    render(<StaffTradeInsTab />);
    expect(screen.getByText(/Giant Escape 3/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/Mark valued/i));
    expect(getTradeInRequests()[0].status).toBe('valued');
    // The "Mark valued" action disappears once the lead is valued.
    expect(screen.queryByText(/Mark valued/i)).toBeNull();
  });

  it('deletes a lead', () => {
    submitTradeInRequest({ customerName: 'A', customerEmail: 'a@x.com', brand: 'B', model: 'M', condition: 'fair' });
    render(<StaffTradeInsTab />);
    fireEvent.click(screen.getAllByLabelText(/Delete lead/i)[0]);
    expect(getTradeInRequests()).toEqual([]);
  });
});

describe('StaffPortal trade-in tile', () => {
  it('exposes a Trade-Ins launcher tile that opens the inbox', () => {
    render(<StaffPortal />);
    const tile = screen.getByTestId('staff-tile-tradeins');
    fireEvent.click(tile);
    expect(screen.getByTestId('staff-tradeins')).toBeTruthy();
  });
});
