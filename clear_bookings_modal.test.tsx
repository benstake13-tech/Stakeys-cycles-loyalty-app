import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  clearAllBookings: vi.fn(async () => ({ success: true, deleted: 2, message: 'Cleared 2 bookings.' })),
}));

const sampleBookings = [
  { id: 'bk-1', status: 'pending', approvalStatus: 'pending_approval' },
  { id: 'bk-2', status: 'confirmed', approvalStatus: 'approved' },
];

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    bookings: sampleBookings,
    clearAllBookings: hoisted.clearAllBookings,
  }),
}));

import { ClearBookingsModal } from './src/components/ClearBookingsModal';

beforeEach(() => {
  hoisted.clearAllBookings = vi.fn(async () => ({ success: true, deleted: 2, message: 'Cleared 2 bookings.' }));
});

describe('ClearBookingsModal', () => {
  it('summarises the bookings that will be removed', () => {
    render(<ClearBookingsModal onClose={() => {}} />);
    expect(screen.getByText(/2 bookings currently stored/i)).toBeTruthy();
    expect(screen.getByText(/1 awaiting approval/i)).toBeTruthy();
  });

  it('keeps the clear button disabled until CLEAR is typed', () => {
    render(<ClearBookingsModal onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /Clear 2 Bookings/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('CLEAR'), { target: { value: 'clear' } });
    expect(btn.disabled).toBe(false);
  });

  it('calls clearAllBookings and reports the result', async () => {
    render(<ClearBookingsModal onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('CLEAR'), { target: { value: 'CLEAR' } });
    fireEvent.click(screen.getByRole('button', { name: /Clear 2 Bookings/i }));

    await waitFor(() => expect(hoisted.clearAllBookings).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Cleared 2 bookings/i)).toBeTruthy();
  });

  it('surfaces a warning when the database delete fails', async () => {
    hoisted.clearAllBookings = vi.fn(async () => ({
      success: false,
      deleted: 2,
      message: 'Cleared 2 bookings on this device only — the database delete failed.',
    }));
    render(<ClearBookingsModal onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('CLEAR'), { target: { value: 'CLEAR' } });
    fireEvent.click(screen.getByRole('button', { name: /Clear 2 Bookings/i }));

    expect(await screen.findByText(/device only/i)).toBeTruthy();
  });
});
