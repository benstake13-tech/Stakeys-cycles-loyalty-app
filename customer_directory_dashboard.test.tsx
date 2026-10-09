import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  users: [] as any[],
  updateCustomerPoints: vi.fn(async () => ({ success: true, message: 'Saved' })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'staff-1', role: 'staff', displayName: 'Ben' },
    users: hoisted.users,
    stampLogs: [],
    addStamp: vi.fn(async () => ({ success: true, message: 'Stamped' })),
    updateCustomerPoints: hoisted.updateCustomerPoints,
    createCustomerByStaff: vi.fn(async () => ({ success: true, message: 'Created' })),
    deleteCustomerAccount: vi.fn(async () => ({ success: true, message: 'Deleted' })),
    adjustCustomerStamps: vi.fn(async () => ({ success: true, message: 'Adjusted' })),
  }),
}));

// The member panel is the "edit/update stats" destination; stub it so this test
// asserts only the directory wiring (a tile opens the editor).
vi.mock('./src/components/MemberControlPanel', () => ({
  MemberControlPanel: ({ customer }: any) => (
    <div data-testid="member-control-panel">Editing {customer.displayName}</div>
  ),
}));
vi.mock('./src/components/CustomerAccountDossier', () => ({
  CustomerAccountDossier: () => <div data-testid="full-dossier" />,
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { CustomerDatabaseTab } from './src/components/CustomerDatabaseTab';

const memberA = {
  uid: 'm1',
  role: 'customer',
  displayName: 'Alice Rider',
  email: 'alice@example.com',
  phoneNumber: '07000000001',
  membershipNumber: 'SC-1001',
  stamps: 3,
  tickets: 1,
  points: 20,
  createdAt: '',
};
const memberB = {
  uid: 'm2',
  role: 'customer',
  displayName: 'Bob Wheeler',
  email: 'bob@example.com',
  phoneNumber: '07000000002',
  membershipNumber: 'SC-1002',
  stamps: 10,
  tickets: 0,
  points: 0,
  createdAt: '',
};

beforeEach(() => {
  hoisted.users = [memberA, memberB];
});

afterEach(cleanup);

describe('CustomerDirectory dashboard grid', () => {
  it('renders one square tile per member with name, id and stat chips', () => {
    render(<CustomerDatabaseTab />);
    expect(screen.getByTestId('member-tile-grid')).toBeTruthy();
    expect(screen.getByTestId('member-tile-m1')).toBeTruthy();
    expect(screen.getByTestId('member-tile-m2')).toBeTruthy();

    expect(screen.getByText('Alice Rider')).toBeTruthy();
    expect(screen.getByText('SC-1001')).toBeTruthy();
    expect(screen.getByText('Bob Wheeler')).toBeTruthy();
    // Stat chips are labelled once per tile.
    expect(screen.getAllByText('Stamps').length).toBe(2);
    expect(screen.getAllByText('Tickets').length).toBe(2);
    expect(screen.getAllByText('Points').length).toBe(2);
  });

  it('badges reward-ready members', () => {
    render(<CustomerDatabaseTab />);
    // Bob has 10 stamps → reward-ready badge.
    expect(screen.getByText('Reward')).toBeTruthy();
  });

  it('opens the member editor when a tile is tapped', () => {
    render(<CustomerDatabaseTab />);
    fireEvent.click(screen.getByTestId('member-tile-m1'));
    expect(screen.getByTestId('member-control-panel')).toBeTruthy();
    expect(screen.getByText('Editing Alice Rider')).toBeTruthy();
  });

  it('keeps the metrics strip and the search bar', () => {
    render(<CustomerDatabaseTab />);
    expect(screen.getByText('Total Customers')).toBeTruthy();
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeTruthy();
  });
});
