import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  createBooking: vi.fn(async (_data: any) => ({
    id: 'bk-express-1',
    customerName: 'Sam Rider',
    customerEmail: 'sam@example.com',
    customerPhone: '+44 7911 123456',
    vehicleModel: 'Not specified — SOS call-out',
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

const cta = () => screen.getByText(/Request Immediate SOS Call-Out/i);

beforeEach(() => {
  hoisted.createBooking.mockClear();
});

describe('BookingPortal — Express SOS mode', () => {
  it('toggling SOS on opens the single-screen express mode by default', () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));

    expect(screen.getByTestId('express-sos-mode')).toBeTruthy();
    // All six visual tiles are present.
    for (const label of ['Brakes', 'Gears & Chain', 'Tires & Wheels', 'E-Bike / Battery', 'Snapped Part', 'Other / Total Breakdown']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // The dense wizard is gone: no classic submit, no discount/referral inputs.
    expect(screen.queryByText(/Book Workshop Service/i)).toBeNull();
    expect(screen.queryByText(/Have a discount code/i)).toBeNull();
    expect(screen.queryByText(/Refer a Friend Code/i)).toBeNull();
    expect(cta()).toBeTruthy();
  });

  it('dispatches a 3-tap express SOS booking with category, location and mapped symptoms', async () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));

    // Tap 1: the visual issue tile.
    fireEvent.click(screen.getByText('Tires & Wheels'));
    // Tap 2: location + contact.
    fireEvent.change(screen.getByPlaceholderText(/Nearest landmark, or tap GPS/i), {
      target: { value: 'A6 layby near the retail park' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Your name/i), { target: { value: 'Sam Rider' } });
    fireEvent.change(screen.getByPlaceholderText(/Mobile \(for WhatsApp\)/i), { target: { value: '+44 7911 123456' } });

    // Tap 3: dispatch.
    fireEvent.click(cta());
    await flush();

    expect(hoisted.createBooking).toHaveBeenCalledTimes(1);
    const data = hoisted.createBooking.mock.calls[0][0];
    expect(data.isSos).toBe(true);
    expect(data.sosStatus).toBe('requested');
    expect(data.sosCategory).toBe('Tires & Wheels');
    expect(data.sosLocationNote).toBe('A6 layby near the retail park');
    expect(data.notes).toContain('EXPRESS SOS CALL-OUT');
    expect(data.notes).toContain('Issue category: 🚲 Tires & Wheels');
    expect(data.notes).toContain('Fault: Flat tire · puncture · bent wheel');
    expect(data.selectedIssues).toEqual(['wheels-flat-puncture', 'wheels-wobbly-untrue', 'wheels-broken-spoke']);
  });

  it('blocks dispatch until an issue tile has been tapped', async () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));
    fireEvent.change(screen.getByPlaceholderText(/Nearest landmark, or tap GPS/i), { target: { value: 'Here' } });
    fireEvent.change(screen.getByPlaceholderText(/Your name/i), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByPlaceholderText(/Mobile \(for WhatsApp\)/i), { target: { value: '07911 123456' } });

    fireEvent.click(cta());
    await flush();

    expect(hoisted.createBooking).not.toHaveBeenCalled();
    expect(screen.getByText(/Tap what is wrong with your bike/i)).toBeTruthy();
  });

  it('blocks dispatch until a location is set', async () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));
    fireEvent.click(screen.getByText('Brakes'));
    fireEvent.change(screen.getByPlaceholderText(/Your name/i), { target: { value: 'Sam' } });
    fireEvent.change(screen.getByPlaceholderText(/Mobile \(for WhatsApp\)/i), { target: { value: '07911 123456' } });

    fireEvent.click(cta());
    await flush();

    expect(hoisted.createBooking).not.toHaveBeenCalled();
    expect(screen.getByText(/Tell us where you are/i)).toBeTruthy();
  });

  it('keeps the classic describe-it form available behind the mode switch', () => {
    render(<BookingPortal />);
    fireEvent.click(screen.getByText('SOS Emergency Repair'));
    fireEvent.click(screen.getByText(/Describe it/));

    expect(screen.queryByTestId('express-sos-mode')).toBeNull();
    expect(screen.getByPlaceholderText(/Nearest landmark, or what3words/i)).toBeTruthy();
    expect(screen.getByText(/Book Workshop Service/i)).toBeTruthy();
  });
});
