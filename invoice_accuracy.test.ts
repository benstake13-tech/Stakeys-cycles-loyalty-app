import { describe, it, expect } from 'vitest';
import { ServiceBooking, RepairInvoice } from './src/types/bikeShop';
import {
  auditInvoiceAgainstBooking,
  bookingSymptomLabels,
  seedInvoiceLineItemsFromBooking,
} from './src/utils/invoiceAccuracy';

const baseBooking = (over: Partial<ServiceBooking> = {}): ServiceBooking =>
  ({
    id: 'bk-1',
    customerName: 'Ada Rider',
    customerEmail: 'ada@example.com',
    customerPhone: '07700900000',
    vehicleCategory: 'cycle',
    vehicleModel: 'Trek FX 2',
    serviceId: 'svc-1',
    serviceTitle: 'Standard Workshop Service',
    servicePrice: 35,
    preferredDate: '2026-10-10',
    preferredTimeSlot: '13:00',
    status: 'in_progress',
    createdAt: '2026-10-06T00:00:00.000Z',
    notifications: [],
    selectedIssues: ['brakes-squeaky', 'gears-slipping'],
    otherNotes: 'Rear wheel feels loose',
    ...over,
  } as ServiceBooking);

const baseInvoice = (over: Partial<RepairInvoice> = {}): RepairInvoice =>
  ({
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    bookingId: 'bk-1',
    issuedAt: '2026-10-06T00:00:00.000Z',
    completedAt: '2026-10-06T00:00:00.000Z',
    leadMechanic: 'Ben Stake - Lead Mechanic',
    customerName: 'Ada Rider',
    customerEmail: 'ada@example.com',
    customerPhone: '07700900000',
    vehicleModel: 'Trek FX 2',
    vehicleCategory: 'cycle',
    items: [],
    checklistSignoff: [],
    labourSubtotal: 0,
    partsSubtotal: 0,
    subtotal: 0,
    vatRate: 0,
    vatAmount: 0,
    voucherDiscount: 0,
    grandTotal: 0,
    paymentStatus: 'unpaid',
    warrantyPeriod: '30-Day Stakey Workshop Warranty',
    ...over,
  } as RepairInvoice);

describe('bookingSymptomLabels', () => {
  it('resolves selected issues and includes other notes', () => {
    const labels = bookingSymptomLabels(baseBooking());
    expect(labels).toContain('Squeaky / noisy brakes');
    expect(labels).toContain('Gears slipping or jumping teeth while pedaling');
    expect(labels).toContain('Rear wheel feels loose');
  });
});

describe('seedInvoiceLineItemsFromBooking', () => {
  it('seeds one line per symptom plus the other-notes line', () => {
    const items = seedInvoiceLineItemsFromBooking(baseBooking(), (i) => `id-${i}`);
    expect(items).toHaveLength(3);
    expect(items[0].description).toContain('Squeaky / noisy brakes');
    expect(items[2].description).toContain('Rear wheel feels loose');
  });

  it('falls back to a single labour line when nothing was reported', () => {
    const items = seedInvoiceLineItemsFromBooking(
      baseBooking({ selectedIssues: [], otherNotes: undefined }),
      (i) => `id-${i}`
    );
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('Labour');
    expect(items[0].unitPrice).toBe(0);
  });
});

describe('auditInvoiceAgainstBooking', () => {
  it('passes when every symptom is billed and the total is set', () => {
    const invoice = baseInvoice({
      items: [
        { id: '1', description: 'Squeaky / noisy brakes (Brakes)', category: 'Labour', quantity: 1, unitPrice: 15, total: 15 },
        { id: '2', description: 'Gears slipping or jumping teeth while pedaling (Drivetrain)', category: 'Labour', quantity: 1, unitPrice: 20, total: 20 },
        { id: '3', description: 'Rear wheel feels loose (Customer reported)', category: 'Labour', quantity: 1, unitPrice: 10, total: 10 },
      ],
      subtotal: 45,
      grandTotal: 45,
    });
    const audit = auditInvoiceAgainstBooking(baseBooking(), invoice);
    expect(audit.ok).toBe(true);
    expect(audit.missingSymptoms).toHaveLength(0);
    expect(audit.itemsTotal).toBe(45);
  });

  it('flags a £0 unpriced job', () => {
    const invoice = baseInvoice({
      items: [
        { id: '1', description: 'Squeaky / noisy brakes (Brakes)', category: 'Labour', quantity: 1, unitPrice: 0, total: 0 },
        { id: '2', description: 'Gears slipping or jumping teeth while pedaling (Drivetrain)', category: 'Labour', quantity: 1, unitPrice: 0, total: 0 },
        { id: '3', description: 'Rear wheel feels loose (Customer reported)', category: 'Labour', quantity: 1, unitPrice: 0, total: 0 },
      ],
      subtotal: 0,
      grandTotal: 0,
    });
    const audit = auditInvoiceAgainstBooking(baseBooking(), invoice);
    expect(audit.ok).toBe(false);
    expect(audit.issues.some((i) => i.includes('£0.00'))).toBe(true);
  });

  it('flags a symptom that never made it onto the bill', () => {
    const invoice = baseInvoice({
      items: [
        { id: '1', description: 'Squeaky / noisy brakes (Brakes)', category: 'Labour', quantity: 1, unitPrice: 15, total: 15 },
      ],
      subtotal: 15,
      grandTotal: 15,
    });
    const audit = auditInvoiceAgainstBooking(baseBooking(), invoice);
    expect(audit.ok).toBe(false);
    expect(audit.missingSymptoms).toContain('Gears slipping or jumping teeth while pedaling');
  });

  it('flags a stale subtotal that does not match the line items', () => {
    const invoice = baseInvoice({
      items: [
        { id: '1', description: 'Squeaky / noisy brakes (Brakes)', category: 'Labour', quantity: 1, unitPrice: 15, total: 15 },
        { id: '2', description: 'Gears slipping or jumping teeth while pedaling (Drivetrain)', category: 'Labour', quantity: 1, unitPrice: 20, total: 20 },
        { id: '3', description: 'Rear wheel feels loose (Customer reported)', category: 'Labour', quantity: 1, unitPrice: 10, total: 10 },
      ],
      subtotal: 40,
      grandTotal: 40,
    });
    const audit = auditInvoiceAgainstBooking(baseBooking(), invoice);
    expect(audit.ok).toBe(false);
    expect(audit.issues.some((i) => i.includes('does not match'))).toBe(true);
  });
});
