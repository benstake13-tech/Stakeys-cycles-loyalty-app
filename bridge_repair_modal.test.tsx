import React from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

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

vi.mock('./src/supabase', () => ({
  getStoredSupabaseUrl: () => 'https://lhojocpygcnkxvkrcuxh.supabase.co',
}));

import { BridgeRepairModal } from './src/components/BridgeRepairModal';

describe('BridgeRepairModal', () => {
  it('flags the broken bridge and shows how many members cannot sign in', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue({
      reachable: true,
      authLogins: 4,
      unconfirmedLogins: 4,
      loyaltyProfiles: 9,
      profilesWithoutLogin: 5,
      loginsWithoutProfile: 0,
    });
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);

    render(<BridgeRepairModal onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/5 members without a login/i)).toBeTruthy();
    });
    expect(screen.getByText(/4 unconfirmed logins/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Re-copy Repair SQL/i })).toBeTruthy();
  });

  it('reports a healthy bridge once every login is linked', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue({
      reachable: true,
      authLogins: 9,
      unconfirmedLogins: 0,
      loyaltyProfiles: 9,
      profilesWithoutLogin: 0,
      loginsWithoutProfile: 0,
    });
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);

    render(<BridgeRepairModal onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Bridge healthy/i)).toBeTruthy();
    });
  });

  it('prompts staff to run the SQL when the repair functions are missing', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue({
      reachable: true,
      authLogins: 0,
      unconfirmedLogins: 0,
      loyaltyProfiles: 9,
      profilesWithoutLogin: 0,
      loginsWithoutProfile: 0,
    });
    hoisted.bridgeRepairInstalled.mockResolvedValue(false);

    render(<BridgeRepairModal onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy Repair SQL/i })).toBeTruthy();
    });
    expect(screen.getByText(/repair functions are not on this project yet/i)).toBeTruthy();
  });

  it('repairs the bridge in one click and reports what it fixed', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue({
      reachable: true,
      authLogins: 4,
      unconfirmedLogins: 4,
      loyaltyProfiles: 9,
      profilesWithoutLogin: 5,
      loginsWithoutProfile: 0,
    });
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);
    hoisted.repairAppBridge.mockResolvedValue({
      success: true,
      message: 'Bridge repaired — confirmed 4 logins and created 5. Every member can now sign in.',
      confirmed: 4,
      created: 5,
      failed: 0,
      defaultPassword: 'Stakeys123!',
    });

    render(<BridgeRepairModal onClose={() => {}} />);
    const btn = await screen.findByRole('button', { name: /Repair Bridge Now/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(hoisted.repairAppBridge).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/confirmed 4 logins and created 5/i)).toBeTruthy();
    expect(screen.getAllByText(/Stakeys123!/i).length).toBeGreaterThan(0);
  });

  it('surfaces the server message when a one-click repair is refused', async () => {
    hoisted.fetchBridgeDiagnostics.mockResolvedValue({
      reachable: true,
      authLogins: 4,
      unconfirmedLogins: 4,
      loyaltyProfiles: 9,
      profilesWithoutLogin: 5,
      loginsWithoutProfile: 0,
    });
    hoisted.bridgeRepairInstalled.mockResolvedValue(true);
    hoisted.repairAppBridge.mockResolvedValue({
      success: false,
      message: 'Sign in as an administrator to repair the bridge.',
    });

    render(<BridgeRepairModal onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /Repair Bridge Now/i }));

    expect(await screen.findByText(/Sign in as an administrator/i)).toBeTruthy();
  });
});
