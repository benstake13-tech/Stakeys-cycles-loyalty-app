import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  fetchBridgeDiagnostics: vi.fn(),
  bridgeRepairInstalled: vi.fn(),
  repairAppBridge: vi.fn(),
}));

vi.mock('./src/utils/appBridge', () => ({
  fetchBridgeDiagnostics: hoisted.fetchBridgeDiagnostics,
  bridgeRepairInstalled: hoisted.bridgeRepairInstalled,
}));

vi.mock('./src/utils/authHealth', () => ({
  repairAppBridge: hoisted.repairAppBridge,
}));

import { BridgeStatusTile } from './src/components/BridgeStatusTile';

const healthy = {
  reachable: true,
  authLogins: 10,
  unconfirmedLogins: 0,
  loyaltyProfiles: 10,
  profilesWithoutLogin: 0,
  loginsWithoutProfile: 0,
};

const broken = {
  reachable: true,
  authLogins: 4,
  unconfirmedLogins: 4,
  loyaltyProfiles: 9,
  profilesWithoutLogin: 5,
  loginsWithoutProfile: 0,
};

beforeEach(() => {
  cleanup();
  hoisted.fetchBridgeDiagnostics.mockReset();
  hoisted.bridgeRepairInstalled.mockReset();
  hoisted.repairAppBridge.mockReset();
});

describe('BridgeStatusTile', () => {
  it('reports a healthy bridge and offers the one-click repair', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue(healthy);
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);

    render(<BridgeStatusTile />);

    expect(await screen.findByText(/bridge is healthy/i)).toBeTruthy();
    expect(screen.getByTestId('staff-bridge-repair')).toBeTruthy();
  });

  it('flags the exact broken state customers hit', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue(broken);
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);

    render(<BridgeStatusTile />);

    expect(await screen.findByText(/5 members without a login/i)).toBeTruthy();
    expect(screen.getByText(/4 unconfirmed/i)).toBeTruthy();
  });

  it('repairs on click, re-checks and shows the result', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValueOnce(broken).mockResolvedValue(healthy);
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);
    hoisted.repairAppBridge.mockResolvedValue({
      success: true,
      message: 'Bridge repaired — confirmed 4 logins and created 5. Every member can now sign in.',
      confirmed: 4,
      created: 5,
      failed: 0,
      defaultPassword: 'Stakeys123!',
    });

    render(<BridgeStatusTile />);
    fireEvent.click(await screen.findByTestId('staff-bridge-repair'));

    await waitFor(() => {
      expect(hoisted.repairAppBridge).toHaveBeenCalledTimes(1);
    });
    const notice = await screen.findByTestId('staff-bridge-notice');
    expect(notice.textContent).toMatch(/confirmed 4 logins and created 5/i);
    // After a successful repair it re-probes and settles to healthy.
    await waitFor(() => {
      expect(screen.getByText(/bridge is healthy/i)).toBeTruthy();
    });
  });

  it('surfaces a refusal without claiming success', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue(broken);
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);
    hoisted.repairAppBridge.mockResolvedValue({
      success: false,
      message: 'Sign in as an administrator to repair the bridge.',
    });

    render(<BridgeStatusTile />);
    fireEvent.click(await screen.findByTestId('staff-bridge-repair'));

    const notice = await screen.findByTestId('staff-bridge-notice');
    expect(notice.textContent).toMatch(/administrator/i);
  });
});
