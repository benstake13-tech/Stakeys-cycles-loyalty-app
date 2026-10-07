import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatInvoiceEmailBody } from './src/utils/invoiceService';
import type { RepairInvoice } from './src/types/bikeShop';

const sample = (): RepairInvoice =>
  ({
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    bookingId: 'bk-1',
    issuedAt: new Date(),
    completedAt: new Date('2026-10-01T10:00:00Z'),
    leadMechanic: 'Ben',
    customerName: 'Ada Rider',
    customerEmail: 'ada@example.com',
    customerPhone: '07700900000',
    vehicleModel: 'Trek FX 2',
    vehicleCategory: 'cycle',
    items: [],
    checklistSignoff: [],
    labourSubtotal: 35,
    partsSubtotal: 0,
    subtotal: 35,
    vatRate: 0,
    vatAmount: 0,
    voucherDiscount: 0,
    grandTotal: 35,
    paymentStatus: 'paid_card',
    warrantyPeriod: '30-Day Stakey Workshop Warranty',
  } as RepairInvoice);

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('workshop address on customer-facing documents', () => {
  it('prints the Salford M6 6QS postcode on the emailed invoice', () => {
    const body = formatInvoiceEmailBody(sample());
    expect(body).toContain('M6 6QS');
  });

  it('no longer shows the old Bideford address anywhere', () => {
    for (const file of [
      'src/components/RepairInvoiceModal.tsx',
      'src/utils/invoiceService.ts',
      'src/components/CustomerRepairTracker.tsx',
    ]) {
      const src = read(file);
      expect(src).not.toMatch(/High Street/i);
      expect(src).not.toMatch(/Bideford/i);
      expect(src).not.toMatch(/EX39/);
    }
  });

  it('shows the new address on the printable invoice header', () => {
    expect(read('src/components/RepairInvoiceModal.tsx')).toContain('M6 6QS');
  });

  it('points the Directions link at the new postcode', () => {
    expect(read('src/components/CustomerRepairTracker.tsx')).toContain('Salford+M6+6QS');
  });
});
