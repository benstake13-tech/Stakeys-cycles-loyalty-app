import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: {} as any,
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));
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

import { FEATURE_TESTS, runFeatureTests, summarize, AREA_LABELS } from './src/utils/featureDiagnostics';
import { StaffDiagnosticsTab } from './src/components/StaffDiagnosticsTab';

beforeEach(() => {
  hoisted.shop = {
    ownerConfig: { ownerEmail: 'workshop@stakeyscycles.co.uk', emailAlertsEnabled: true },
    checkServiceHealth: vi.fn(async () => ({ isOnline: true, latencyMs: 12 })),
    isStaffBookingSoundEnabled: true,
    playStaffBookingAlertPing: vi.fn(),
    requestPushNotificationPermission: vi.fn(async () => 'granted'),
    refreshDatabaseState: vi.fn(async () => {}),
  };
});

describe('feature diagnostics engine', () => {
  it('exposes a test for every staff feature area', () => {
    const areas = new Set(FEATURE_TESTS.map((t) => t.area));
    for (const area of Object.keys(AREA_LABELS)) {
      expect(areas.has(area as any)).toBe(true);
    }
    expect(FEATURE_TESTS.length).toBeGreaterThanOrEqual(20);
    for (const t of FEATURE_TESTS) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(typeof t.run).toBe('function');
    }
  });

  it('runs the offline logic tests for real and they pass', async () => {
    const logicIds = FEATURE_TESTS.filter((t) => t.area === 'logic').map((t) => t.id);
    const results = await runFeatureTests(undefined, logicIds);
    expect(results).toHaveLength(logicIds.length);
    expect(results.every((r) => r.status === 'pass')).toBe(true);
    const s = summarize(results);
    expect(s.pass).toBe(logicIds.length);
    expect(s.fail).toBe(0);
  });

  it('runs the offline email template checks and they pass', async () => {
    const emailIds = FEATURE_TESTS.filter((t) => t.area === 'email').map((t) => t.id);
    expect(emailIds.length).toBeGreaterThan(0);
    const results = await runFeatureTests(undefined, emailIds);
    expect(results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('runs the offline scanner/code checks and they pass', async () => {
    const scannerIds = FEATURE_TESTS.filter((t) => t.area === 'scanner').map((t) => t.id);
    expect(scannerIds.length).toBeGreaterThan(0);
    const results = await runFeatureTests(undefined, scannerIds);
    expect(results.every((r) => r.status === 'pass')).toBe(true);
  });

  it('exposes the member pass round-trip as a standalone test', async () => {
    const id = 'membership-encode-roundtrip';
    const [result] = await runFeatureTests(undefined, [id]);
    expect(result.id).toBe(id);
    expect(result.status).toBe('pass');
  });

  it('every test has a description (so a not-yet-run row is never blank)', () => {
    for (const t of FEATURE_TESTS) {
      expect(typeof t.description).toBe('string');
      expect((t.description || '').length).toBeGreaterThan(0);
    }
  });

  it('reports progress for each test as it completes', async () => {
    const seen: string[] = [];
    const ids = FEATURE_TESTS.filter((t) => t.area === 'logic').map((t) => t.id);
    await runFeatureTests((r) => seen.push(r.id), ids);
    expect(seen.sort()).toEqual([...ids].sort());
  });
});

describe('StaffDiagnosticsTab', () => {
  it('renders the test bench with a Run All control', () => {
    const { container } = render(<StaffDiagnosticsTab />);
    expect(container.textContent).toContain('Feature Test Bench');
    expect(container.textContent).toContain('Run All Tests');
    // every feature area is listed
    for (const label of Object.values(AREA_LABELS)) {
      expect(container.textContent).toContain(label);
    }
  });

  it('runs an area on demand and shows pass results', async () => {
    const { container, getAllByText } = render(<StaffDiagnosticsTab />);
    const areaButtons = getAllByText('Test this area');
    // Logic is the last area in the panel order.
    fireEvent.click(areaButtons[areaButtons.length - 1]);
    await waitFor(() => {
      expect(container.textContent).toContain('Discount maths');
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Working');
    });
  });

  it('lists every catalogue test with its own Run control', () => {
    const { getByTestId } = render(<StaffDiagnosticsTab />);
    // Every test is rendered up-front, before anything is run.
    for (const t of FEATURE_TESTS) {
      expect(getByTestId(`test-row-${t.id}`)).toBeTruthy();
    }
  });

  it('runs a single test on its own and replaces only that row', async () => {
    const { getByTestId } = render(<StaffDiagnosticsTab />);
    const row = getByTestId('test-row-logic-discount-maths');
    const runButton = within(row).getByText('Run');
    fireEvent.click(runButton);
    await waitFor(() => {
      expect(within(row).getByText('Working')).toBeTruthy();
    });
    // Only the row we ran gained a result; an unrelated row stays "Not run".
    expect(within(getByTestId('test-row-booking-write')).queryByText('Working')).toBeNull();
  });
});
