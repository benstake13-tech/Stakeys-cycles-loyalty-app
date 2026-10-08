import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bookings = [
  {
    id: 'bk-4299',
    status: 'pending',
    approvalStatus: 'pending_approval',
    customerName: 'Ben Pearson',
    customerEmail: 'ben@example.com',
    customerPhone: '07000 123456',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek - FX 1/2/3',
    serviceId: 'svc-1',
    serviceTitle: 'Brake Service',
    servicePrice: 30,
    preferredDate: '2026-10-09',
    preferredTimeSlot: 'Midday (12:00 - 14:00)',
    selectedIssues: ['brakes-squeaky'],
    notes: 'Customer reports noise under braking.',
    notifications: [],
    repairProgress: [],
  },
  {
    id: 'bk-1111',
    status: 'confirmed',
    approvalStatus: 'approved',
    customerName: 'Ada Lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '07000 000000',
    vehicleCategory: 'ebike',
    vehicleModel: 'Carrera Crossfire',
    serviceId: 'svc-2',
    serviceTitle: 'Full Service',
    servicePrice: 60,
    preferredDate: '2026-10-10',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    notes: '',
    notifications: [],
    repairProgress: [],
  },
  {
    id: 'bk-7777',
    status: 'completed',
    approvalStatus: 'approved',
    customerName: 'Completed Carl',
    customerEmail: 'carl@example.com',
    customerPhone: '07000 777777',
    vehicleCategory: 'cycle',
    vehicleModel: 'Giant Escape',
    serviceId: 'svc-3',
    serviceTitle: 'Full Service',
    servicePrice: 55,
    preferredDate: '2026-10-01',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    notes: '',
    notifications: [],
    repairProgress: [],
  },
];

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    bookings,
    approveBooking: vi.fn(async () => ({ success: true, message: 'ok' })),
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
    automatedRemindersEnabled: true,
    setAutomatedRemindersEnabled: vi.fn(),
    reminderSettings: {
      channel: 'both',
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
    isStaffBookingSoundEnabled: true,
    toggleStaffBookingSound: vi.fn(() => true),
    playStaffBookingAlertPing: vi.fn(),
    workshopAudioVolume: 'normal',
    cycleWorkshopAudioVolume: vi.fn(),
    requestPushNotificationPermission: vi.fn(async () => 'granted'),
  }),
}));

import { StaffBookingsTab } from './src/components/StaffBookingsTab';

beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('StaffBookingsTab high-density layout', () => {
  it('shows system tools collapsed by default but keeps status badges visible', () => {
    render(<StaffBookingsTab />);
    expect(screen.getByText('Workshop Booking & Notification Manager')).toBeTruthy();
    expect(screen.getByText('24-Hour Reminder Manager')).toBeTruthy();
    // Badges stay on the collapsed header.
    expect(screen.getByText('LIVE DISPATCH')).toBeTruthy();
    expect(screen.getByText('🔔 LOUD PING ARMED')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    // Reminder settings body is not reachable while collapsed.
    expect(screen.queryByText('Delivery method')).toBeNull();
  });

  it('reveals the reminder settings when the panel header is toggled', () => {
    render(<StaffBookingsTab />);
    fireEvent.click(screen.getByText('24-Hour Reminder Manager'));
    expect(screen.getByText('Delivery method')).toBeTruthy();
    expect(screen.getByText('Send reminders to')).toBeTruthy();
  });

  it('renders each booking as a collapsed summary with the key fields', () => {
    render(<StaffBookingsTab />);
    expect(screen.getByText('Ben Pearson')).toBeTruthy();
    expect(screen.getByText('#bk-4299')).toBeTruthy();
    expect(screen.getByText('AWAITING STAFF APPROVAL')).toBeTruthy();
    expect(screen.getByText('Trek - FX 1/2/3')).toBeTruthy();
    expect(screen.getByText('Cycle')).toBeTruthy();
    expect(screen.getByText(/Slot: 2026-10-09/)).toBeTruthy();
    // Symptom summary is visible without expanding.
    expect(screen.getByText(/squeaky/i)).toBeTruthy();
  });

  it('keeps the primary action and WhatsApp quick-actions on the collapsed row', () => {
    render(<StaffBookingsTab />);
    expect(screen.getByText('Accept & Approve')).toBeTruthy();
    expect(screen.getByText('Move to Bench')).toBeTruthy();
    const whatsapp = screen.getAllByLabelText(/WhatsApp Ben Pearson/);
    expect(whatsapp.length).toBeGreaterThan(0);
    expect(whatsapp[0].getAttribute('href')).toContain('wa.me/07000123456');
  });

  it('hides full details until the card is expanded', () => {
    render(<StaffBookingsTab />);
    expect(screen.queryByText('Customer / Diagnostic Notes')).toBeNull();
    fireEvent.click(screen.getAllByLabelText('Show booking details')[0]);
    expect(screen.getByText('Customer / Diagnostic Notes')).toBeTruthy();
    expect(screen.getByText('ACTION REQUIRED: Repair Request Needs Staff Review & Decision')).toBeTruthy();
    expect(screen.getByText('Send Quote / Info Request')).toBeTruthy();
    expect(screen.getByText('Decline Booking')).toBeTruthy();
  });

  it('expands cards independently', () => {
    render(<StaffBookingsTab />);
    const toggles = screen.getAllByLabelText('Show booking details');
    expect(toggles.length).toBe(2);
    fireEvent.click(toggles[0]);
    // First card open, second still collapsed.
    expect(screen.getAllByLabelText('Hide booking details').length).toBe(1);
    expect(screen.getAllByLabelText('Show booking details').length).toBe(1);
  });
});

describe('StaffBookingsTab active / completed split', () => {
  it('separates active jobs from completed jobs', () => {
    render(<StaffBookingsTab />);
    // Active view by default: the pending + confirmed jobs, not the completed one.
    expect(screen.getByText('Ben Pearson')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('Completed Carl')).toBeNull();
    // The Completed toggle advertises the hidden job count.
    expect(screen.getByText('Active Jobs')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('reveals completed jobs behind the Completed toggle', () => {
    render(<StaffBookingsTab />);
    fireEvent.click(screen.getByText('Completed'));
    expect(screen.getByText('Completed Carl')).toBeTruthy();
    // Active jobs are hidden while the completed view is on.
    expect(screen.queryByText('Ben Pearson')).toBeNull();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
  });
});
