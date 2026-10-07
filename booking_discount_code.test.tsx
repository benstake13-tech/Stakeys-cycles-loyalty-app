import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-6001',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    vehicleModel: 'Trek FX 1',
    serviceTitle: 'General Safety Check & Tune-Up',
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
  })),
  currentUser: null as any,
  discountCodes: [] as any[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: hoisted.currentUser,
    createBooking: hoisted.createBooking,
    redeemServiceVoucher: vi.fn(),
    discountCodes: hoisted.discountCodes,
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
import { generateDiscountSet, MEMBER_DISCOUNT_SET } from './src/utils/discountAudience';

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText(/John Smith/i), { target: { value: 'Sam Carter' } });
  fireEvent.change(screen.getByPlaceholderText(/\+44 7911 123456/i), { target: { value: '+44 7911 123456' } });
  fireEvent.change(screen.getByPlaceholderText(/Describe any other issue/i), { target: { value: 'Rear brake feels spongy' } });
  fireEvent.click(screen.getByText(/Book Workshop Service/i));
}

function applyCode(code: string) {
  fireEvent.change(screen.getByPlaceholderText('Discount code'), { target: { value: code } });
  fireEvent.click(screen.getByText('Apply'));
}

beforeEach(() => {
  hoisted.currentUser = null;
  hoisted.discountCodes = [];
  hoisted.createBooking = vi.fn(async (_data: any) => ({
    id: 'bk-6001',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    vehicleModel: 'Trek FX 1',
    serviceTitle: 'General Safety Check & Tune-Up',
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
  }));
});

describe('BookingPortal discount code', () => {
  it('captures a valid public code and records it on the booking', async () => {
    render(<BookingPortal />);
    applyCode('web-5off');
    await waitFor(() => expect(screen.getByText(/WEB-5OFF applied/i)).toBeTruthy());

    fillAndSubmit();
    await waitFor(() => expect(hoisted.createBooking).toHaveBeenCalledTimes(1));
    const notes = hoisted.createBooking.mock.calls[0][0].notes as string;
    expect(notes).toContain('Discount code: WEB-5OFF');
    expect(notes).toContain('honoured on the final repair invoice');
  });

  it('rejects an unknown code', async () => {
    render(<BookingPortal />);
    applyCode('NOPE-123');
    await waitFor(() => expect(screen.getByText(/not recognised/i)).toBeTruthy());
  });

  it('refuses a member-only code to a signed-out visitor', async () => {
    hoisted.discountCodes = generateDiscountSet(MEMBER_DISCOUNT_SET);
    render(<BookingPortal />);
    applyCode('MEM-15OFF');
    await waitFor(() => expect(screen.getByText(/loyalty members only/i)).toBeTruthy());
  });

  it('lets a member apply a member-only code', async () => {
    hoisted.currentUser = { uid: 'user-1', membershipNumber: 'STK-100001', serviceVouchers: [] };
    hoisted.discountCodes = generateDiscountSet(MEMBER_DISCOUNT_SET);
    render(<BookingPortal />);
    applyCode('MEM-15OFF');
    await waitFor(() => expect(screen.getByText(/MEM-15OFF applied/i)).toBeTruthy());
  });

  it('omits the note when no code is applied', async () => {
    render(<BookingPortal />);
    fillAndSubmit();
    await waitFor(() => expect(hoisted.createBooking).toHaveBeenCalledTimes(1));
    const notes = hoisted.createBooking.mock.calls[0][0].notes as string;
    expect(notes).not.toContain('Discount code:');
  });
});
