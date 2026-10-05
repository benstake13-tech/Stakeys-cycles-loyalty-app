import { describe, it, expect } from 'vitest';
import { generateBookingApprovalEmailHtml } from './src/shared/utils/notificationService';
import type { ServiceBooking, OwnerNotificationConfig } from './src/shared/types/bikeShop';

const config: OwnerNotificationConfig = {
  ownerEmail: 'workshop@stakeyscycles.com',
  ownerPhone: '+44 7700 900821',
  emailAlertsEnabled: true,
  businessName: "Stakey's Cycles",
};

const baseBooking: ServiceBooking = {
  id: 'bk-9001',
  customerName: 'Sam Carter',
  customerEmail: 'sam@example.com',
  customerPhone: '+44 7911 000000',
  vehicleCategory: 'cycle',
  vehicleModel: 'Trek FX 1',
  serviceId: 'cycle-tune',
  serviceTitle: 'General Safety Check & Tune-Up',
  servicePrice: 0,
  preferredDate: '2026-10-10',
  preferredTimeSlot: 'Morning (09:00 - 12:00)',
  status: 'confirmed',
  approvalStatus: 'approved',
  createdAt: new Date().toISOString(),
  notifications: [],
};

describe('booking approval confirmation email', () => {
  it('shows the staff estimate and note when a quote was provided', () => {
    const html = generateBookingApprovalEmailHtml(
      { ...baseBooking, quotedPrice: 129.5, quoteNote: 'Includes new chain and labour' },
      'Please bring the battery key',
      config
    );

    expect(html).toContain('Estimated Quote:');
    expect(html).toContain('£129.50');
    expect(html).toContain('Includes new chain and labour');
    expect(html).toContain('Please bring the battery key');
  });

  it('never shows a misleading £0.00 when no estimate exists', () => {
    const html = generateBookingApprovalEmailHtml({ ...baseBooking }, undefined, config);

    expect(html).not.toContain('£0.00');
    expect(html).toContain('Confirmed on inspection');
  });
});
