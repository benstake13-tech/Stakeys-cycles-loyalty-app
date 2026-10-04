import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ServiceBooking, UserProfile } from './src/types/bikeShop';

const hoisted = vi.hoisted(() => ({
  bookings: [] as ServiceBooking[],
  users: [] as UserProfile[],
}));

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({ bookings: hoisted.bookings, users: hoisted.users }),
}));

import { PerformanceTracker } from './src/components/PerformanceTracker';

function booking(partial: Partial<ServiceBooking>): ServiceBooking {
  return {
    id: 'bk-1',
    customerName: 'Test Rider',
    customerEmail: 'rider@example.com',
    customerPhone: '07000000000',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek Marlin',
    serviceId: 'svc-1',
    serviceTitle: 'Full Service',
    servicePrice: 0,
    preferredDate: '2026-10-03',
    preferredTimeSlot: 'AM',
    status: 'pending',
    createdAt: new Date().toISOString(),
    notifications: [],
    ...partial,
  } as ServiceBooking;
}

describe('PerformanceTracker', () => {
  it('merges service requests, call log and growth into one view', () => {
    hoisted.bookings = [
      booking({ id: 'online-1' }),
      booking({ id: 'call-1', notes: 'BOOKING CHANNEL: Phone call (staff-entered)', customerName: 'Sam Carter', customerPhone: '+44 7911 123456' }),
    ];
    hoisted.users = [
      { uid: 'u1', role: 'customer', stamps: 3 } as UserProfile,
      { uid: 'u2', role: 'customer', stamps: 0 } as UserProfile,
    ];

    render(<PerformanceTracker />);

    expect(screen.getByText(/Performance Tracker/i)).toBeTruthy();
    expect(screen.getAllByText(/Weekly Service Requests/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Call Log/i)).toBeTruthy();
    // phone booking appears in the call log with its number
    expect(screen.getByText('Sam Carter')).toBeTruthy();
    expect(screen.getByText('+44 7911 123456')).toBeTruthy();
    // Growth section (Google & Meta) is merged in and expanded by default
    expect(screen.getByText(/Growth — Google/i)).toBeTruthy();
    expect(screen.getByText(/Google & Meta Business Performance/i)).toBeTruthy();
  });

  it('collapses the growth section on click', () => {
    hoisted.bookings = [];
    hoisted.users = [];
    render(<PerformanceTracker />);
    fireEvent.click(screen.getByText(/Growth — Google/i));
    expect(screen.queryByText(/Google & Meta Business Performance/i)).toBeNull();
  });
});
