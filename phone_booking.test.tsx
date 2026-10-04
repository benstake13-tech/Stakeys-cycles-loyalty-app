import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({ id: 'bk-7777', customerName: 'Sam Carter' })),
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ users: [], createBooking: hoisted.createBooking }),
}));

import { PhoneBookingPanel } from './src/components/PhoneBookingPanel';

beforeEach(() => {
  hoisted.createBooking = vi.fn(async (_data: any) => ({ id: 'bk-7777', customerName: 'Sam Carter' }));
});

describe('PhoneBookingPanel', () => {
  it('shows the staff call script', () => {
    render(<PhoneBookingPanel />);
    expect(screen.getByText(/Phone call script/i)).toBeTruthy();
    expect(screen.getByText(/Open the call/i)).toBeTruthy();
  });

  it('blocks submission until a caller name is captured', async () => {
    render(<PhoneBookingPanel />);
    fireEvent.click(screen.getByText(/Log phone booking/i));
    await waitFor(() => expect(screen.getByText(/take the caller's name/i)).toBeTruthy());
    expect(hoisted.createBooking).not.toHaveBeenCalled();
  });

  it('logs a phone booking into the same system with a channel marker', async () => {
    render(<PhoneBookingPanel />);
    fireEvent.change(screen.getByPlaceholderText(/Sam Carter/i), { target: { value: 'Sam Carter' } });
    fireEvent.change(screen.getByPlaceholderText(/\+44 7700 900/i), { target: { value: '+44 7911 123456' } });
    fireEvent.click(screen.getByText(/Log phone booking/i));

    await waitFor(() => expect(hoisted.createBooking).toHaveBeenCalledTimes(1));
    const payload = hoisted.createBooking.mock.calls[0][0];
    expect(payload.customerName).toBe('Sam Carter');
    expect(payload.customerPhone).toBe('+44 7911 123456');
    expect(payload.notes).toContain('BOOKING CHANNEL: Phone call');
    expect(payload.serviceId).toBeTruthy();
  });
});
