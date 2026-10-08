import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-sos-9',
    customerName: 'Sam Rider',
    customerEmail: 'sam@example.com',
    customerPhone: '+44 7911 123456',
    vehicleModel: 'Carrera Vengeance',
    serviceTitle: 'SOS Emergency Repair',
    preferredDate: '2026-10-06',
    preferredTimeSlot: 'ASAP',
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

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function fillContact() {
  fireEvent.change(screen.getByPlaceholderText(/John Smith/i), { target: { value: 'Sam Rider' } });
  fireEvent.change(screen.getByPlaceholderText(/\+44 7911 123456/i), { target: { value: '+44 7911 123456' } });
}

beforeEach(() => {
  hoisted.createBooking.mockClear();
});

describe('BookingPortal — SOS emergency request', () => {
  it('does not flag a normal booking as SOS', async () => {
    render(<BookingPortal />);
    fillContact();
    fireEvent.change(screen.getByPlaceholderText(/Describe any other issue/i), { target: { value: 'Chain noisy' } });
    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await flush();

    const data = hoisted.createBooking.mock.calls[0][0];
    expect(data.isSos).toBeUndefined();
  });

  it('submits an SOS booking with the fault, location and requested status', async () => {
    render(<BookingPortal />);

    // Turn SOS on — it should also switch the service to a call-out.
    fireEvent.click(screen.getByText('SOS Emergency Repair'));
    // SOS now defaults to Express mode; choose the full "Describe it" form.
    fireEvent.click(screen.getByText(/Describe it/));

    fillContact();
    fireEvent.change(screen.getByPlaceholderText(/Nearest landmark/i), {
      target: { value: 'Outside the Co-op, Mill Street' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Rear wheel won't turn/i), {
      target: { value: "Rear wheel buckled — I'm stuck with an order waiting." },
    });

    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await flush();

    expect(hoisted.createBooking).toHaveBeenCalledTimes(1);
    const data = hoisted.createBooking.mock.calls[0][0];
    expect(data.isSos).toBe(true);
    expect(data.sosStatus).toBe('requested');
    expect(data.notes).toContain('SOS EXPRESS REPAIR');
    expect(data.notes).toContain('Rear wheel buckled');
    expect(data.notes).toContain('Express surcharge: £15.00');
  });

  it('blocks an SOS submission that has no fault description', async () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));
    fireEvent.click(screen.getByText(/Describe it/));
    fillContact();
    fireEvent.change(screen.getByPlaceholderText(/Nearest landmark/i), {
      target: { value: 'Outside the Co-op' },
    });

    fireEvent.click(screen.getByText(/Book Workshop Service/i));
    await flush();

    expect(hoisted.createBooking).not.toHaveBeenCalled();
    expect(screen.getByText(/Please describe the fault/i)).toBeTruthy();
  });
});
