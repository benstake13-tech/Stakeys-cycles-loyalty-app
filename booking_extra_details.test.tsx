import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-extra-1',
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

describe('BookingPortal optional extra detail', () => {
  it('keeps the extra detail fields collapsed until the customer asks for them', () => {
    render(<BookingPortal />);
    expect(screen.getByText(/Additional details/i)).toBeTruthy();
    // Collapsed by default — the extra textareas are not in the tree yet.
    expect(screen.queryByPlaceholderText(/Gate code 1234/i)).toBeNull();
  });

  it('folds optional access notes, extra detail and contact preference into the booking notes', async () => {
    render(<BookingPortal />);

    fireEvent.click(screen.getByText(/Additional details/i));
    fireEvent.change(screen.getByPlaceholderText(/Gate code 1234/i), {
      target: { value: 'Side gate, code 4455' },
    });
    fireEvent.change(screen.getByPlaceholderText(/only ride it at weekends/i), {
      target: { value: 'Please quote before ordering parts' },
    });
    fireEvent.click(screen.getByText('Email'));

    fireEvent.change(screen.getByPlaceholderText(/John Smith/i), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByPlaceholderText(/\+44 7911 123456/i), { target: { value: '+44 7911 123456' } });
    fireEvent.change(screen.getByPlaceholderText(/Describe any other issue/i), {
      target: { value: 'Rear brake feels spongy' },
    });
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await flush();

    expect(hoisted.createBooking).toHaveBeenCalledTimes(1);
    const notes = (hoisted.createBooking.mock.calls[0][0] as any).notes as string;
    expect(notes).toMatch(/Access \/ drop-off notes: Side gate, code 4455/);
    expect(notes).toMatch(/Extra detail: Please quote before ordering parts/);
    expect(notes).toMatch(/Preferred contact: Email/);
  });
});
