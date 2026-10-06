import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  fetchBridgeDiagnostics: vi.fn(),
  bridgeRepairInstalled: vi.fn(),
}));

vi.mock('./src/utils/appBridge', () => ({
  fetchBridgeDiagnostics: hoisted.fetchBridgeDiagnostics,
  bridgeRepairInstalled: hoisted.bridgeRepairInstalled,
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
});
