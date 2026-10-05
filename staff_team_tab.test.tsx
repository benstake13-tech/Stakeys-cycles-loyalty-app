import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createStaffAccount: vi.fn(async (_email: string, _password: string, _name: string, _role: string) => ({
    success: true,
  })),
  updateStaffAccountRole: vi.fn(async (_id: string, _role: string) => ({ success: true })),
  refreshStaffAccounts: vi.fn(async () => {}),
  addStaffMember: vi.fn(async (_data: any) => ({})),
  updateStaffMember: vi.fn(async (_id: string, _data: any) => ({})),
  deleteStaffMember: vi.fn(async (_id: string) => ({})),
  role: 'admin',
}));

vi.mock('./src/shared/context/ShopContext', () => ({
  useShop: () => ({
    staffMembers: [
      {
        id: 'st-1',
        name: 'Alex Morgan',
        email: 'alex@stakeyscycles.com',
        phone: '+44 7700 900111',
        role: 'Mechanic',
        status: 'Active',
        joinedDate: '2024-01-01',
        certificationLevel: 'Workshop Level 2',
        notes: 'Bench lead',
        avatarColor: '#05C147',
      },
      {
        id: 'st-2',
        name: 'Sam Rider',
        email: 'sam@stakeyscycles.com',
        phone: '+44 7700 900222',
        role: 'Mechanic',
        status: 'Active',
        joinedDate: '2024-02-01',
        avatarColor: '#059669',
      },
    ],
    addStaffMember: hoisted.addStaffMember,
    updateStaffMember: hoisted.updateStaffMember,
    deleteStaffMember: hoisted.deleteStaffMember,
    staffAccounts: [
      { id: 'acct-1', email: 'owner@stakeyscycles.com', displayName: 'Owner', role: 'admin', createdAt: '' },
      { id: 'acct-2', email: 'sam@stakeyscycles.com', displayName: 'Sam', role: 'staff', createdAt: '' },
    ],
    refreshStaffAccounts: hoisted.refreshStaffAccounts,
    createStaffAccount: hoisted.createStaffAccount,
    updateStaffAccountRole: hoisted.updateStaffAccountRole,
    currentUser: { uid: 'acct-1', role: hoisted.role },
  }),
}));

import { StaffManagementTab } from './src/components/StaffManagementTab';

beforeEach(() => {
  hoisted.role = 'admin';
  hoisted.createStaffAccount = vi.fn(async () => ({ success: true }));
  hoisted.updateStaffAccountRole = vi.fn(async () => ({ success: true }));
});

describe('StaffManagementTab (Team = roster + logins)', () => {
  it('shows both the roster and the Staff Station access section', () => {
    render(<StaffManagementTab />);
    expect(screen.getByText(/Staff Station access/i)).toBeTruthy();
    expect(screen.getByText(/Roster \(2\)/i)).toBeTruthy();
    expect(screen.getByText('Alex Morgan')).toBeTruthy();
    expect(screen.getByText(/Existing logins \(2\)/i)).toBeTruthy();
  });

  it('creates a staff login from the merged tab', async () => {
    render(<StaffManagementTab />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Sam@StakeysCycles.co.uk' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret1' } });
    fireEvent.click(screen.getByText(/Create staff login/i));

    await waitFor(() => expect(hoisted.createStaffAccount).toHaveBeenCalledTimes(1));
    const call = hoisted.createStaffAccount.mock.calls[0];
    expect(call[0]).toBe('sam@stakeyscycles.co.uk');
    expect(call[1]).toBe('secret1');
    expect(call[2]).toBe('Sam Carter');
    expect(call[3]).toBe('staff');
  });

  it('blocks the create form when passwords do not match', async () => {
    render(<StaffManagementTab />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@stakeyscycles.co.uk' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'nope123' } });
    fireEvent.click(screen.getByText(/Create staff login/i));

    await waitFor(() => expect(screen.getByText(/do not match/i)).toBeTruthy());
    expect(hoisted.createStaffAccount).not.toHaveBeenCalled();
  });

  it('hides login management from non-admins', () => {
    hoisted.role = 'staff';
    render(<StaffManagementTab />);
    expect(screen.getByText(/Only admins can manage staff logins/i)).toBeTruthy();
    expect(screen.queryByText(/Create staff login/i)).toBeNull();
  });

  it('shows login status on roster cards and prefills the form via Grant access', () => {
    render(<StaffManagementTab />);
    expect(screen.getByText(/Has login/i)).toBeTruthy();
    expect(screen.getByText(/No login/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/Grant access/i));
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
      'alex@stakeyscycles.com'
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Alex Morgan');
  });

  it('offers to promote or demote an existing login from the roster card', async () => {
    render(<StaffManagementTab />);
    fireEvent.click(screen.getByText(/Make admin/i));
    await waitFor(() => expect(hoisted.updateStaffAccountRole).toHaveBeenCalledWith('acct-2', 'admin'));
  });
});
