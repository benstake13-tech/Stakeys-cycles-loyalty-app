import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The whole point of this file: prove that NOTHING runs a feature test (and so
// never creates a probe booking) as a side effect of rendering a login screen or
// the staff portal. Diagnostics must only ever run from an explicit click in the
// Test Bench. `runFeatureTests` is the single entry point that creates the
// self-cleaning probe bookings, so a spy on it is the guard.
const hoisted = vi.hoisted(() => ({
  shop: {} as any,
  runFeatureTests: vi.fn(async () => [] as any[]),
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));
vi.mock('./src/utils/featureDiagnostics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./src/utils/featureDiagnostics')>()),
  runFeatureTests: hoisted.runFeatureTests,
}));
vi.mock('./src/utils/notificationService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./src/utils/notificationService')>()),
  dispatchTestEmail: vi.fn(async () => ({ success: true })),
}));
vi.mock('./src/utils/pushNotifications', () => ({
  sendPushToUser: vi.fn(async () => ({ ok: true, via: 'local' })),
  initOneSignal: vi.fn(async () => true),
  getPushPermission: vi.fn(async () => 'granted'),
  requestPushPermission: vi.fn(async () => 'granted'),
  getSubscriptionId: vi.fn(async () => 'sub-1'),
  isPushSubscribed: vi.fn(async () => true),
  optInPushSubscription: vi.fn(async () => 'sub-1'),
  getConfiguredAppId: vi.fn(() => 'app-id'),
  setConfiguredAppId: vi.fn(() => true),
  linkUser: vi.fn(async () => {}),
  registerEmailSubscription: vi.fn(async () => {}),
}));

import { LoginScreen } from './src/components/LoginScreen';
import { StaffDiagnosticsTab } from './src/components/StaffDiagnosticsTab';

beforeEach(() => {
  cleanup();
  hoisted.runFeatureTests.mockClear();
  hoisted.shop = {
    // LoginScreen
    loginWithCredentials: vi.fn(async () => ({ success: false, message: 'no creds' })),
    loginStaff: vi.fn(async () => ({ success: false, message: 'no creds' })),
    registerCustomerAccount: vi.fn(async () => ({ success: false })),
    resendConfirmationEmail: vi.fn(async () => ({ success: false })),
    addCustomerBike: vi.fn(async () => ({})),
    theme: 'dark',
    toggleTheme: vi.fn(),
    // StaffDiagnosticsTab
    ownerConfig: { ownerEmail: 'workshop@stakeyscycles.co.uk', emailAlertsEnabled: true },
    currentUser: null,
    checkServiceHealth: vi.fn(async () => ({ isOnline: true, latencyMs: 12 })),
    isStaffBookingSoundEnabled: true,
    playStaffBookingAlertPing: vi.fn(),
    requestPushNotificationPermission: vi.fn(async () => 'granted'),
    refreshDatabaseState: vi.fn(async () => {}),
  };
});

describe('no booking test runs at login', () => {
  it('renders the customer login screen without running any feature test', () => {
    render(<LoginScreen audience="customer" />);
    expect(hoisted.runFeatureTests).not.toHaveBeenCalled();
  });

  it('renders the staff login screen without running any feature test', () => {
    render(<LoginScreen audience="staff" />);
    expect(hoisted.runFeatureTests).not.toHaveBeenCalled();
  });

  it('does not run a feature test when a sign-in is submitted without credentials', async () => {
    const { container } = render(<LoginScreen audience="customer" />);
    const form = container.querySelector('form');
    if (form) fireEvent.submit(form);
    // The validation path runs, but nothing that creates a probe booking.
    expect(hoisted.runFeatureTests).not.toHaveBeenCalled();
  });

  it('does not run any feature test merely by mounting the Test Bench', () => {
    render(<StaffDiagnosticsTab />);
    expect(hoisted.runFeatureTests).not.toHaveBeenCalled();
  });

  it('only runs feature tests from an explicit click in the Test Bench', () => {
    const { getByText } = render(<StaffDiagnosticsTab />);
    expect(hoisted.runFeatureTests).not.toHaveBeenCalled();
    fireEvent.click(getByText('Run All Tests'));
    expect(hoisted.runFeatureTests).toHaveBeenCalledTimes(1);
  });
});
