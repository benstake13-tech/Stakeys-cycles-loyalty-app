import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bookings = [
  {
    id: 'bk-bilingual-1',
    status: 'pending',
    approvalStatus: 'pending_approval',
    customerName: 'Ola Kowalska',
    customerEmail: 'ola@example.com',
    customerPhone: '+48 600 100 200',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 1',
    serviceId: 'svc-1',
    serviceTitle: 'Brake Service',
    servicePrice: 30,
    preferredDate: '2026-10-12',
    preferredTimeSlot: 'Morning (09:00 - 12:00)',
    selectedIssues: ['brakes-squeaky'],
    notes: 'Reported Symptoms (1):\n• [Brakes] Squeaky / Rubbing\n\nOther Issues / Symptoms: Rear brake feels spongy\n\nCustomer Instructions: Please tighten the rear brake\n\nBooking completed in Polish\n\nSERVICE TYPE: Drop off at workshop',
    notifications: [],
    repairProgress: [],
    translationPayload: {
      customer_language: 'pl',
      language_detected: 'pl',
      translated_payload_en: {
        customer_name: 'Ola Kowalska',
        contact_info: 'ola@example.com · +48 600 100 200',
        booking_date_time: '2026-10-12 Morning (09:00 - 12:00)',
        service_type: 'Drop off at workshop',
        issue_description: 'Rear brake feels spongy — Please tighten the rear brake',
        additional_notes: '',
      },
      original_payload_native: {
        service_type: 'Dostarczenie do warsztatu',
        issue_description: 'Tylny hamulec jest miękki — Proszę dokręcić tylny hamulec',
        additional_notes: '',
      },
    },
  },
];

vi.mock('./src/utils/notificationService', () => ({ dispatchTestEmail: vi.fn(async () => ({ ok: true })), send24hReminderEmail: vi.fn(async () => true) }));
vi.mock('./src/utils/bookingCustomer', () => ({ findCustomerForBooking: () => undefined }));

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
    clearAllBookings: vi.fn(async () => ({ success: true, message: '', deleted: 0 })),
    repairBookingsLedger: vi.fn(async () => ({ found: 0, reuploaded: 0, failed: 0 })),
    users: [
      {
        uid: 'cust-ola',
        email: 'ola@example.com',
        role: 'customer',
        displayName: 'Ola Kowalska',
        membershipNumber: 'STK-000002',
        stamps: 0,
        tickets: 0,
        createdAt: '',
        avatarColor: '{"backdrop":"ocean"}',
      },
    ],
  }),
}));

import { StaffBookingsTab } from './src/components/StaffBookingsTab';

beforeEach(() => {
  (Element.prototype as any).scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('StaffBookingsTab bilingual translation view', () => {
  const openDetails = () => fireEvent.click(screen.getByText('Details'));

  it('shows a booking with translationPayload through the bilingual notes panel', () => {
    render(<StaffBookingsTab />);
    openDetails();
    expect(screen.getByTestId('bilingual-notes')).toBeTruthy();
    // English translation is surfaced prominently.
    expect(screen.getByTestId('translation-en')).toBeTruthy();
    expect(screen.getByText(/Rear brake feels spongy — Please tighten the rear brake/)).toBeTruthy();
    // Language badge indicates the source language.
    expect(screen.getByText(/translated from Polish/i)).toBeTruthy();
    // The original native text is collapsed by default.
    expect(screen.queryByTestId('translation-original')).toBeNull();
    expect(screen.queryByText(/Tylny hamulec jest miękki/)).toBeNull();
  });

  it('reveals the original native text when the toggle is clicked', () => {
    render(<StaffBookingsTab />);
    openDetails();
    fireEvent.click(screen.getByTestId('translation-toggle'));
    expect(screen.getByTestId('translation-original')).toBeTruthy();
    expect(screen.getByText(/Tylny hamulec jest miękki — Proszę dokręcić tylny hamulec/)).toBeTruthy();
  });

  it('uses the plain English notes block for a legacy booking without payload', () => {
    const originalPayload = bookings[0].translationPayload;
    delete (bookings[0] as any).translationPayload;
    render(<StaffBookingsTab />);
    openDetails();
    expect(screen.queryByTestId('bilingual-notes')).toBeNull();
    expect(screen.getByText(/Customer \/ Diagnostic Notes/)).toBeTruthy();
    bookings[0].translationPayload = originalPayload;
  });
});