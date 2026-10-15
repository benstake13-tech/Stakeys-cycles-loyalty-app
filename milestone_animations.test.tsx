import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { announceMilestone, claimMilestone } from './src/utils/milestoneAnimations';
vi.mock('./src/context/ShopContext', () => ({ useShop: () => ({ currentUser: { uid: 'animation-test', role: 'customer' }, users: [], bookings: [], draws: [], notificationPreferences: {} }) }));
import { MilestoneOverlay } from './src/components/MilestoneOverlay';
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('milestone animations', () => {
  it('deduplicates per account and event', () => {
    expect(claimMilestone('one', 'event')).toBe(true);
    expect(claimMilestone('one', 'event')).toBe(false);
    expect(claimMilestone('two', 'event')).toBe(true);
  });
  it('ignores other accounts, displays a transparent variant and dismisses automatically', async () => {
    vi.useFakeTimers();
    render(<MilestoneOverlay/>);
    act(() => announceMilestone({ id: 'hidden', scope: 'other', kind: 'garage' }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => announceMilestone({ id: 'garage-test', scope: 'animation-test', kind: 'garage' }));
    expect(screen.getByText('Bike added to the garage')).toBeTruthy();
    expect(screen.getByRole('status').querySelector('svg[data-variant="garage"]')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(4300); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
