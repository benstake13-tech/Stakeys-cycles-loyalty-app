import React from 'react';
import { render, waitFor, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Only the two bookings we need, with just the fields the tab reads.
const bookings = [
  {
    id: 'bk-1111',
    status: 'confirmed',
    approvalStatus: 'approved',
    customerName: 'Ada',
    customerEmail: 'ada@example.com',
    customerPhone: '07000 000000',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 2',
    serviceId: 'svc-1',
    serviceTitle: 'General Safety Check & Tune-Up',
    servicePrice: 45,
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    notes: '',
    notifications: [],
    repairProgress: [],
  },
  {
    id: 'bk-2222',
    status: 'pending',
    approvalStatus: 'pending_approval',
    customerName: 'Bob',
    customerEmail: 'bob@example.com',
    customerPhone: '07111 111111',
    vehicleCategory: 'cycle',
    vehicleModel: 'Carrera Vengeance',
    serviceId: 'svc-2',
    serviceTitle: 'Full Service',
    servicePrice: 60,
    preferredDate: '2026-10-11',
    preferredTimeSlot: 'Afternoon (12:00 - 17:00)',
    notes: '',
    notifications: [],
    repairProgress: [],
  },
];

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    bookings,
    approveBooking: vi.fn(),
    declineBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    setRepairStage: vi.fn(),
    addRepairProgressNote: vi.fn(),
    updateBookingQuote: vi.fn(),
    saveRepairInvoice: vi.fn(),
    updateInvoicePaymentStatus: vi.fn(),
    currentUser: { uid: 'staff-1', role: 'staff', email: 'staff@example.com' },
    ownerConfig: { ownerEmail: 'owner@example.com', ownerPhone: '+44 7000 000000', emailAlertsEnabled: true, businessName: "Stakey's Cycles" },
    updateOwnerConfig: vi.fn(),
    automatedRemindersEnabled: false,
    setAutomatedRemindersEnabled: vi.fn(),
    remindersPushOnly: true,
    setRemindersPushOnly: vi.fn(),
    reminderOwnerEmail: 'owner@example.com',
    setReminderOwnerEmail: vi.fn(),
    reminderSettings: {
      channel: 'push',
      recipients: 'both',
      leadHours: 24,
      repeatHours: 0,
      quietStartHour: 21,
      quietEndHour: 8,
      quietHoursEnabled: true,
      ownerEmail: 'owner@example.com',
    },
    setReminderSettings: vi.fn(),
    bookingsDueIn24h: [],
    dispatch24hReminderForBooking: vi.fn(async () => true),
    isStaffBookingSoundEnabled: false,
    toggleStaffBookingSound: vi.fn(() => true),
    playStaffBookingAlertPing: vi.fn(),
    workshopAudioVolume: 'normal',
    cycleWorkshopAudioVolume: vi.fn(),
    requestPushNotificationPermission: vi.fn(async () => 'granted'),
    repairBookingsLedger: vi.fn(async () => ({ found: 0, reuploaded: 0, failed: 0 })),
    users: [],
  }),
}));

import { StaffBookingsTab } from './src/components/StaffBookingsTab';

// jsdom lacks scrollIntoView.
beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('StaffBookingsTab notification focus', () => {
  it('highlights the deep-linked booking', async () => {
    render(<StaffBookingsTab focusBookingId="bk-2222" />);
    await waitFor(() => {
      const ref = screen.getByText('#bk-2222');
      const card = ref.closest('div[class*="ring-sky-400"]');
      expect(card).toBeTruthy();
    });
  });

  it('leaves other bookings unhighlighted', async () => {
    render(<StaffBookingsTab focusBookingId="bk-2222" />);
    await waitFor(() => expect(screen.getByText('#bk-1111')).toBeTruthy());
    const other = screen.getByText('#bk-1111').closest('div[class*="ring-sky-400"]');
    expect(other).toBeNull();
  });
});
