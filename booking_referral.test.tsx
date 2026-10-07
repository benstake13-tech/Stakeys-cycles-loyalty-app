import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-ref-1',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    vehicleModel: 'Trek FX 1',
    serviceTitle: 'Brakes: Squeaky / Rubbing',
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
  })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: null,
    createBooking: hoisted.createBooking,
    redeemServiceVoucher: vi.fn(),
    ownerConfig: {
      ownerEmail: 'workshop@stakeyscycles.co.uk',
      ownerPhone: '+44 7388 209102',
      emailAlertsEnabled: true,
      businessName: "Stakey's Cycles",
    },
  }),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('./src/utils/membershipCode', () => ({}));

import { BookingPortal } from './src/components/BookingPortal';

beforeEach(() => {
  hoisted.createBooking.mockClear();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('BookingPortal Refer a Friend', () => {
  it('offers the £15 full-service referral reward and carries the code onto the booking', async () => {
    render(<BookingPortal />);

    // The referral field explains the friend reward before a code is entered.
    expect(screen.getByText(/Been referred by a friend/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/STK-REF-123456/i), {
      target: { value: 'stk-ref-999999' },
    });
    expect(screen.getByText(/only applies to a full service/i)).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/John Smith/i), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByPlaceholderText(/\+44 7911 123456/i), { target: { value: '+44 7911 123456' } });
    fireEvent.change(screen.getByPlaceholderText(/Describe any other issue/i), {
      target: { value: 'Rear brake feels spongy' },
    });
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await flush();

    expect(hoisted.createBooking).toHaveBeenCalledTimes(1);
    const payload = hoisted.createBooking.mock.calls[0][0] as any;
    expect(payload.referralCode).toBe('stk-ref-999999'.toUpperCase());
    expect(payload.notes).toMatch(/Refer a Friend code: STK-REF-999999/);
  });
});
