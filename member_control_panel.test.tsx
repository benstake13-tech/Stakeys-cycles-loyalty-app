import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  updateCustomerPoints: vi.fn(
    async (_uid: string, _staffId: string, _updates: Record<string, unknown>) => ({
      success: true,
      message: 'Saved',
    })
  ),
  users: [] as any[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: { uid: 'staff-1', role: 'staff', displayName: 'Ben' },
    users: hoisted.users,
    updateCustomerPoints: hoisted.updateCustomerPoints,
  }),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { MemberControlPanel } from './src/components/MemberControlPanel';

const member = {
  uid: 'm1',
  role: 'customer',
  displayName: 'Ben Pearson',
  email: 'interactly514@gmail.com',
  phoneNumber: '07309103782',
  membershipNumber: 'SC-8921',
  stamps: 2,
  tickets: 10,
  points: 0,
  createdAt: '',
};

beforeEach(() => {
  hoisted.users = [member];
  hoisted.updateCustomerPoints.mockClear();
});

afterEach(cleanup);

describe('MemberControlPanel', () => {
  it('renders the profile, balances and quick-add controls', () => {
    render(<MemberControlPanel customer={member as any} onBack={vi.fn()} />);
    expect(screen.getByText('Ben Pearson')).toBeTruthy();
    expect(screen.getByText(/#SC-8921/)).toBeTruthy();
    expect(screen.getByText(/Stamp & Balance Control/i)).toBeTruthy();
    expect(screen.getByText('Prize Tickets')).toBeTruthy();
    expect(screen.getByText('Bonus Points')).toBeTruthy();
    // 10 tickets clears the VIP threshold.
    expect(screen.getByText('VIP Member')).toBeTruthy();
  });

  it('increments tickets and points from the quick-add buttons', () => {
    render(<MemberControlPanel customer={member as any} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('+5'));
    fireEvent.click(screen.getByText('+100'));
    // 10 tickets + 5, and 0 points + 100 (hero summary mirrors the ticket count).
    expect(screen.getAllByText('15').length).toBeGreaterThan(0);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('flags eligibility when the card is full', () => {
    const full = { ...member, stamps: 10 };
    hoisted.users = [full];
    render(<MemberControlPanel customer={full as any} onBack={vi.fn()} />);
    expect(screen.getByText('Eligible for £40 Service')).toBeTruthy();
  });

  it('saves the drafted balances with an audit reason', async () => {
    const onBack = vi.fn();
    render(<MemberControlPanel customer={member as any} onBack={onBack} />);
    fireEvent.click(screen.getByText('+1'));
    fireEvent.click(screen.getByText('Goodwill'));
    fireEvent.click(screen.getByText(/Save Loyalty Changes/i));
    await waitFor(() => expect(hoisted.updateCustomerPoints).toHaveBeenCalledTimes(1));
    const [uid, staffId, updates] = hoisted.updateCustomerPoints.mock.calls[0];
    expect(uid).toBe('m1');
    expect(staffId).toBe('staff-1');
    expect(updates.tickets).toBe(11);
    expect(updates.staffNote).toBe('Goodwill');
    expect(updates.resetDailyRateLimit).toBe(true);
  });

  it('toggles the till override switches', () => {
    render(<MemberControlPanel customer={member as any} onBack={vi.fn()} />);
    const resetSwitch = screen.getByRole('switch', { name: /Reset Weekly Prize Wheel Cooldown/i });
    expect(resetSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(resetSwitch);
    expect(resetSwitch.getAttribute('aria-checked')).toBe('true');
  });
});
