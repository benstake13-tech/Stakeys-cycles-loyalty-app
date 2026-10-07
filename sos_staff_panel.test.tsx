import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  shop: {} as any,
  approveBooking: vi.fn(async (_id: string, _note?: string, _opts?: { quotedPrice?: number }) => ({ success: true, message: 'Approved.' })),
  updateBookingQuote: vi.fn(async (_id: string, _quote: { quotedPrice: number; quoteNote?: string }) => ({ success: true, message: 'Quote saved.' })),
  requestSosLocation: vi.fn(async (_id: string, _note?: string) => ({ success: true, message: 'Location requested.' })),
  confirmSosQuote: vi.fn(async (_id: string) => ({ success: true, message: 'Confirmed.' })),
}));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));

import { StaffSosPanel } from './src/components/StaffSosPanel';
import type { ServiceBooking } from './src/types/bikeShop';

function makeSosBooking(over: Partial<ServiceBooking> = {}): ServiceBooking {
  return {
    id: 'bk-sos-1',
    customerName: 'Sam Rider',
    customerEmail: 'sam@example.com',
    customerPhone: '07388 209102',
    customerId: 'u1',
    membershipNumber: 'STK-123456',
    vehicleCategory: 'cycle',
    vehicleModel: 'Carrera Vengeance',
    serviceId: 'svc-1',
    serviceTitle: 'SOS Emergency Repair',
    servicePrice: 45,
    preferredDate: '2026-10-06',
    preferredTimeSlot: 'ASAP',
    status: 'pending',
    approvalStatus: 'pending_approval',
    repairStage: 'received',
    createdAt: '2026-10-06T09:00:00.000Z',
    progressEvents: [],
    notifications: [],
    notes: `🚨 SOS EXPRESS REPAIR\nRider use: Uber Eats delivery rider\nFault: Rear wheel buckled, can't ride.\nRider location: Outside the Co-op`,
    isSos: true,
    sosStatus: 'requested',
    ...over,
  };
}

beforeEach(() => {
  hoisted.approveBooking.mockClear();
  hoisted.updateBookingQuote.mockClear();
  hoisted.requestSosLocation.mockClear();
  hoisted.confirmSosQuote.mockClear();
  hoisted.shop = {
    bookings: [],
    approveBooking: hoisted.approveBooking,
    updateBookingQuote: hoisted.updateBookingQuote,
    requestSosLocation: hoisted.requestSosLocation,
    confirmSosQuote: hoisted.confirmSosQuote,
    reminderOwnerEmail: 'stakeyscycle95@gmail.com',
  };
});

describe('StaffSosPanel', () => {
  it('shows an empty state when there are no SOS jobs', () => {
    render(<StaffSosPanel />);
    expect(screen.getByText(/No SOS emergency requests right now/i)).toBeTruthy();
  });

  it('shows only SOS bookings, with the reported fault and location', () => {
    hoisted.shop.bookings = [makeSosBooking(), makeSosBooking({ id: 'bk-normal', isSos: false, notes: 'normal' })];
    render(<StaffSosPanel />);
    expect(screen.getByText('Sam Rider')).toBeTruthy();
    expect(screen.getAllByText(/Rear wheel buckled/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Outside the Co-op/i)).toBeTruthy();
  });

  it('approves a requested job with the express quote total', async () => {
    hoisted.shop.bookings = [makeSosBooking()];
    render(<StaffSosPanel />);
    fireEvent.click(screen.getByText('Approve SOS request'));
    await waitFor(() => expect(hoisted.approveBooking).toHaveBeenCalledTimes(1));
    const [id, , opts] = hoisted.approveBooking.mock.calls[0];
    expect(id).toBe('bk-sos-1');
    // servicePrice 45 + SOS surcharge 15.
    expect(opts).toEqual({ quotedPrice: 60 });
  });

  it('offers a WhatsApp live-location link once approved', () => {
    hoisted.shop.bookings = [makeSosBooking({ sosStatus: 'approved' })];
    render(<StaffSosPanel />);
    const link = screen.getByText(/Request live location on WhatsApp/i).closest('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('https://wa.me/447388209102');
  });

  it('marks a quoted job confirmed so staff can set off', async () => {
    hoisted.shop.bookings = [makeSosBooking({ sosStatus: 'quoted', quotedPrice: 60 })];
    render(<StaffSosPanel />);
    fireEvent.click(screen.getByText(/Price confirmed — set off now/i));
    await waitFor(() => expect(hoisted.confirmSosQuote).toHaveBeenCalledWith('bk-sos-1'));
  });

  it('shows the confirmed banner for a dispatched job', () => {
    hoisted.shop.bookings = [makeSosBooking({ sosStatus: 'confirmed', quotedPrice: 60 })];
    render(<StaffSosPanel />);
    expect(screen.getByText(/SET OFF — price confirmed at £60.00/i)).toBeTruthy();
  });
});
