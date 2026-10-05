import { describe, it, expect } from 'vitest';
import { ServiceBooking, RepairInvoice, InvoiceLineItem } from './src/shared/types/bikeShop';
import {
  getRequestedWork,
  buildInvoiceLineItemsFromBooking,
  reconcileInvoiceWithBooking,
  applyBookingContextToInvoice,
  lineItemCoversRequest,
  describeBookedVehicle,
} from './src/shared/utils/invoiceReconciliation';

const baseBooking = (over: Partial<ServiceBooking> = {}): ServiceBooking => ({
  id: 'bk-5436',
  customerName: 'Chloe',
  customerEmail: 'chloe@example.com',
  customerPhone: '07309103782',
  vehicleCategory: 'cycle',
  vehicleModel: 'Trek FX 1',
  serviceId: 'cycle-tune',
  serviceTitle: 'Brakes Repair (2 Symptoms Selected)',
  servicePrice: 0,
  preferredDate: '2026-10-07',
  preferredTimeSlot: '09:00–12:00',
  status: 'in_progress',
  createdAt: '2026-10-01T10:00:00Z',
  notifications: [],
  selectedIssues: ['brakes-squeaky', 'gears-slipping'],
  quotedPrice: 60,
  ...over,
});

const line = (description: string, total = 0): InvoiceLineItem => ({
  id: `l-${description}`,
  description,
  category: 'Labour',
  quantity: 1,
  unitPrice: total,
  total,
});

describe('getRequestedWork', () => {
  it('maps selected symptom ids to their catalogue labels', () => {
    const work = getRequestedWork(baseBooking());
    expect(work).toHaveLength(2);
    expect(work[0].label).toMatch(/brake/i);
    expect(work[1].label).toMatch(/gear/i);
  });

  it('parses "Included checks" bullets for seasonal packages', () => {
    const booking = baseBooking({
      selectedIssues: [],
      notes: 'Winterization Check (Seasonal Tune-Up)\nSeasonal package: Winterization Check\nIncluded checks:\n• Brake adjustment & pad inspection\n• Tyre pressure check & top-up\nRider description: kept outside',
    });
    const work = getRequestedWork(booking);
    expect(work.map((w) => w.label)).toEqual([
      'Brake adjustment & pad inspection',
      'Tyre pressure check & top-up',
    ]);
  });
});

describe('buildInvoiceLineItemsFromBooking', () => {
  it('seeds one line per requested item so the bill matches the booking', () => {
    const items = buildInvoiceLineItemsFromBooking(baseBooking());
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.unitPrice === 0)).toBe(true);
    const rec = reconcileInvoiceWithBooking({ items, grandTotal: 0 }, baseBooking());
    expect(rec.unbilledWork).toHaveLength(0);
  });

  it('falls back to a generic labour line when nothing specific was requested', () => {
    const items = buildInvoiceLineItemsFromBooking(
      baseBooking({ selectedIssues: [], serviceTitle: 'General Workshop Diagnostic & Inspection' })
    );
    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('General Workshop Diagnostic & Inspection');
  });
});

describe('reconcileInvoiceWithBooking', () => {
  it('matches the invoice total to the agreed quote', () => {
    const items = [line('[Brakes] Squeaky/noisy brakes', 30), line('[Gears] Gears slipping', 30)];
    const rec = reconcileInvoiceWithBooking({ items, grandTotal: 60 }, baseBooking());
    expect(rec.quoteAmount).toBe(60);
    expect(rec.quoteMatches).toBe(true);
    expect(rec.quoteDelta).toBe(0);
  });

  it('reports the delta when the bill differs from the quote', () => {
    const items = [line('[Brakes] Squeaky/noisy brakes', 40), line('[Gears] Gears slipping', 40)];
    const rec = reconcileInvoiceWithBooking({ items, grandTotal: 80 }, baseBooking());
    expect(rec.quoteMatches).toBe(false);
    expect(rec.quoteDelta).toBe(20);
    expect(rec.warnings.some((w) => /agreed quote/i.test(w))).toBe(true);
  });

  it('flags requested work that has no matching line item', () => {
    const items = [line('[Brakes] Squeaky/noisy brakes', 30)];
    const rec = reconcileInvoiceWithBooking({ items, grandTotal: 30 }, baseBooking());
    expect(rec.unbilledWork).toHaveLength(1);
    expect(rec.unbilledWork[0].label).toMatch(/gear/i);
  });

  it('handles a booking with no recorded quote', () => {
    const rec = reconcileInvoiceWithBooking(
      { items: [line('Labour', 20)], grandTotal: 20 },
      baseBooking({ quotedPrice: undefined })
    );
    expect(rec.quoteAmount).toBeUndefined();
    expect(rec.quoteMatches).toBe(false);
    expect(rec.warnings.some((w) => /agreed quote/i.test(w))).toBe(false);
  });
});

describe('lineItemCoversRequest', () => {
  it('matches on a shared keyword even when wording differs', () => {
    expect(
      lineItemCoversRequest('Squeaky / noisy brakes', [line('Brake service for squeaky brakes')])
    ).toBe(true);
  });

  it('does not match unrelated work', () => {
    expect(lineItemCoversRequest('Flat tire/puncture', [line('Chain replacement')])).toBe(false);
  });
});

describe('applyBookingContextToInvoice', () => {
  it('snapshots the service, quote, vehicle identity and requested work', () => {
    const invoice = {
      ...({} as RepairInvoice),
      items: [],
      grandTotal: 60,
    } as RepairInvoice;
    const enriched = applyBookingContextToInvoice(
      invoice,
      baseBooking({ bikeDetails: { serialNumber: 'SN123', year: '2021' } })
    );
    expect(enriched.serviceTitle).toBe('Brakes Repair (2 Symptoms Selected)');
    expect(enriched.quotedAmount).toBe(60);
    expect(enriched.requestedWork).toHaveLength(2);
    expect(enriched.vehicleDetails).toContain('Serial SN123');
  });
});

describe('describeBookedVehicle', () => {
  it('combines model with captured identity fields', () => {
    const label = describeBookedVehicle(
      baseBooking({ bikeDetails: { year: '2021', frameSize: 'M' } })
    );
    expect(label).toContain('Trek FX 1');
    expect(label).toContain('2021');
    expect(label).toContain('Frame M');
  });
});
