import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ shop: {} as any }));

vi.mock('./src/context/ShopContext', () => ({ useShop: () => hoisted.shop }));
vi.mock('./src/components/RepairInvoiceModal', () => ({
  RepairInvoiceModal: () => null,
}));

import { CustomerRepairTracker } from './src/components/CustomerRepairTracker';
import type { ServiceBooking } from './src/types/bikeShop';

function makeBooking(over: Partial<ServiceBooking> = {}): ServiceBooking {
  return {
    id: 'bk-2001',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '07911 882910',
    customerId: 'u1',
    membershipNumber: 'STK-123456',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek Domane',
    serviceId: 'svc-1',
    serviceTitle: 'Full Service',
    servicePrice: 60,
    preferredDate: '2026-10-05',
    preferredTimeSlot: '09:00 - 10:00',
    status: 'in_progress',
    repairStage: 'on_the_bench',
    progressEvents: [
      {
        id: 'rep-1',
        kind: 'stage',
        stage: 'on_the_bench',
        label: 'On the Workshop Bench',
        note: 'Replacing the chain and truing the rear wheel.',
        createdBy: 'Ben',
        createdAt: '2026-10-03T10:00:00Z',
      },
      {
        id: 'rep-2',
        kind: 'stage',
        stage: 'received',
        label: 'Received at Workshop',
        createdAt: '2026-10-03T09:00:00Z',
      },
    ],
    createdAt: '2026-10-03T09:00:00Z',
    notifications: [],
    ...over,
  } as ServiceBooking;
}

function setup(bookings: ServiceBooking[], currentUser: any = null) {
  hoisted.shop = { bookings, currentUser };
}

describe('CustomerRepairTracker', () => {
  beforeEach(() => setup([]));

  it('shows the live stage, progress and workshop updates for the latest booking', () => {
    setup([makeBooking()], null);
    render(<CustomerRepairTracker initialBookingId="bk-2001" />);

    expect(screen.getByText(/Customer Repair Progress Tracker/i)).toBeTruthy();
    expect(screen.getAllByText(/On the Workshop Bench/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Workshop Updates \(2\)/i)).toBeTruthy();
    expect(screen.getByText(/Replacing the chain/i)).toBeTruthy();
    // The 8-stage timeline shows the correct position (on_the_bench is 5th).
    expect(screen.getByText(/Stage 5 of 8/i)).toBeTruthy();
  });

  it('prefers an explicit repairStage over the coarse status', () => {
    setup([makeBooking({ status: 'confirmed', repairStage: 'parts_ordered' })] as ServiceBooking[], null);
    render(<CustomerRepairTracker initialBookingId="bk-2001" />);
    expect(screen.getByText(/Parts Ordered — Your Repair is Booked In/i)).toBeTruthy();
  });

  it('lets a customer (or guest) look a repair up by phone number', () => {
    const other = makeBooking({ id: 'bk-3003', customerPhone: '07700 900123', repairStage: 'diagnosing', progressEvents: [] });
    setup([makeBooking(), other], null);
    render(<CustomerRepairTracker />);

    const input = screen.getByPlaceholderText(/Booking #/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '900123' } });
    fireEvent.click(screen.getByText(/Track Live Status/i));

    expect(screen.getByText(/#bk-3003/)).toBeTruthy();
    expect(screen.getAllByText(/Diagnostics & Safety Check/i).length).toBeGreaterThan(0);
  });

  it('never leaks another customer\'s repair to a guest with no match', () => {
    setup([makeBooking()], null);
    render(<CustomerRepairTracker />);
    // A guest landing on the tab sees the lookup prompt, not the global booking.
    expect(screen.getByText(/No Repair Booking Found/i)).toBeTruthy();
    const input = screen.getByPlaceholderText(/Booking #/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'bk-0000' } });
    fireEvent.click(screen.getByText(/Track Live Status/i));
    // Still nothing after a non-matching lookup.
    expect(screen.getByText(/No Repair Booking Found/i)).toBeTruthy();
    expect(screen.queryByText(/#bk-2001/)).toBeNull();
  });
});
