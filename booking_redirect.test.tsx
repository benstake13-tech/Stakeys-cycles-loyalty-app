import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  onComplete: vi.fn(),
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-5555',
    customerName: 'Sam Carter',
    customerEmail: 'sam@example.com',
    vehicleModel: 'Trek FX 1',
    serviceTitle: 'General Safety Check & Tune-Up',
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

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText(/John Smith/i), { target: { value: 'Sam Carter' } });
  fireEvent.change(screen.getByPlaceholderText(/\+44 7911 123456/i), { target: { value: '+44 7911 123456' } });
  fireEvent.change(screen.getByPlaceholderText(/Describe any other issue/i), { target: { value: 'Rear brake feels spongy' } });
  fireEvent.click(screen.getByText(/Book Workshop Service/i));
}

beforeEach(() => {
  vi.useFakeTimers();
  hoisted.onComplete = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('BookingPortal website auto-redirect', () => {
  it('calls onBookingComplete after the confirmation has been shown', async () => {
    render(<BookingPortal onBookingComplete={hoisted.onComplete} />);
    fillAndSubmit();
    await flush();

    // The confirmation screen appears first — no instant redirect.
    expect(screen.getByText(/Workshop Repair Request Submitted/i)).toBeTruthy();
    expect(hoisted.onComplete).not.toHaveBeenCalled();

    // After the dwell time the website is sent back to its homepage.
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(hoisted.onComplete).toHaveBeenCalledTimes(1);
  });

  it('never redirects when no callback is provided (signed-in surfaces)', async () => {
    render(<BookingPortal />);
    fillAndSubmit();
    await flush();

    expect(screen.getByText(/Workshop Repair Request Submitted/i)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText(/Workshop Repair Request Submitted/i)).toBeTruthy();
  });
});
