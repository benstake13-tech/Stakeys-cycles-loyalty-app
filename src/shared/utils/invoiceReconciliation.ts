import { ServiceBooking, RepairInvoice, InvoiceLineItem } from '../types/bikeShop';
import { ALL_BIKE_ISSUES_MAP } from '../data/bikeIssuesCatalog';
import { findMaintenancePackage } from '../data/maintenancePackages';

/**
 * Reconciliation helpers that keep a repair invoice honest against the booking
 * it was raised from: the work the customer actually asked for, and the quote
 * that was agreed before the repair started.
 */

export interface RequestedWorkItem {
  id: string;
  label: string;
  category?: string;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Crude singular form so "brakes" matches "brake", "pads" matches "pad". */
const singular = (w: string) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

/** The exact work the customer requested at booking time (symptoms or package checks). */
export function getRequestedWork(booking: ServiceBooking): RequestedWorkItem[] {
  const out: RequestedWorkItem[] = [];
  (booking.selectedIssues || []).forEach((id) => {
    const it = ALL_BIKE_ISSUES_MAP.get(id);
    out.push({ id, label: it?.label || id, category: it?.category });
  });

  // Seasonal packages do not use symptom ids — their scope is written into the
  // booking notes as an "Included checks:" bullet list.
  if (out.length === 0 && booking.notes) {
    const lines = booking.notes.split('\n');
    const start = lines.findIndex((l) => /included checks:/i.test(l));
    if (start >= 0) {
      for (let i = start + 1; i < lines.length; i++) {
        const m = lines[i].match(/^\s*[•\-*]\s*(.+)$/);
        if (!m) break;
        out.push({ id: `chk-${i}`, label: m[1].trim() });
      }
    }
  }

  return out;
}

/** Human summary of the vehicle the booking is for, including any captured identity. */
export function describeBookedVehicle(booking: ServiceBooking): string {
  const bd = booking.bikeDetails;
  const bits: string[] = [];
  if (booking.vehicleModel) bits.push(booking.vehicleModel);
  if (bd?.year) bits.push(bd.year);
  if (bd?.serialNumber) bits.push(`Serial ${bd.serialNumber}`);
  if (bd?.frameSize) bits.push(`Frame ${bd.frameSize}`);
  return bits.join(' · ');
}

/**
 * Seed invoice line items from the booking so the bill starts as the work the
 * customer asked for, rather than a generic "workshop service" line. Staff
 * still price each line; the point is that nothing is missed.
 */
export function buildInvoiceLineItemsFromBooking(booking: ServiceBooking): InvoiceLineItem[] {
  const stamp = () => `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const requested = getRequestedWork(booking);

  if (requested.length > 0) {
    return requested.map((r) => ({
      id: stamp(),
      description: r.category ? `[${r.category}] ${r.label}` : r.label,
      category: 'Labour' as InvoiceLineItem['category'],
      quantity: 1,
      unitPrice: 0,
      total: 0,
    }));
  }

  return [
    {
      id: stamp(),
      description: `${booking.serviceTitle || 'Workshop Service & Inspection'} (Labour)`,
      category: 'Labour' as InvoiceLineItem['category'],
      quantity: 1,
      unitPrice: 35,
      total: 35,
    },
  ];
}

/** True when a line item appears to bill the given requested-work label. */
export function lineItemCoversRequest(label: string, items: InvoiceLineItem[]): boolean {
  const target = normalize(label);
  if (!target) return false;
  const words = target.split(' ').filter((w) => w.length > 2).map(singular);
  return items.some((it) => {
    const d = normalize(it.description);
    if (!d) return false;
    const dWords = new Set(d.split(' ').map(singular));
    if (d.includes(target) || target.includes(d)) return true;
    if (words.length === 0) return false;
    const hits = words.filter((w) => dWords.has(w) || d.includes(w)).length;
    return hits / words.length >= 0.6;
  });
}

export interface InvoiceReconciliation {
  requestedWork: RequestedWorkItem[];
  unbilledWork: RequestedWorkItem[];
  quoteAmount?: number;
  quoteDelta?: number;
  quoteMatches: boolean;
  warnings: string[];
}

/** Compare an invoice against its booking (requested work + agreed quote). */
export function reconcileInvoiceWithBooking(
  invoice: Pick<RepairInvoice, 'items' | 'grandTotal'>,
  booking: ServiceBooking
): InvoiceReconciliation {
  const requestedWork = getRequestedWork(booking);
  const unbilledWork = requestedWork.filter(
    (r) => !lineItemCoversRequest(r.label, invoice.items)
  );

  const quoteAmount =
    typeof booking.quotedPrice === 'number' && Number.isFinite(booking.quotedPrice)
      ? booking.quotedPrice
      : undefined;
  const quoteDelta =
    quoteAmount !== undefined ? round2(invoice.grandTotal - quoteAmount) : undefined;
  const quoteMatches = quoteAmount !== undefined && Math.abs(quoteDelta!) < 0.01;

  const warnings: string[] = [];
  if (quoteAmount !== undefined && !quoteMatches) {
    const dir = (quoteDelta ?? 0) > 0 ? 'above' : 'below';
    warnings.push(
      `Invoice total £${invoice.grandTotal.toFixed(2)} is £${Math.abs(quoteDelta!).toFixed(2)} ${dir} the agreed quote of £${quoteAmount.toFixed(2)}.`
    );
  }
  if (unbilledWork.length > 0) {
    warnings.push(
      `${unbilledWork.length} requested item${unbilledWork.length === 1 ? '' : 's'} not itemised: ${unbilledWork
        .map((w) => w.label)
        .join(', ')}.`
    );
  }
  if (!booking.customerPhone) warnings.push('Booking has no customer phone number.');
  if (!booking.vehicleModel) warnings.push('Booking has no vehicle recorded.');

  return { requestedWork, unbilledWork, quoteAmount, quoteDelta, quoteMatches, warnings };
}

/**
 * Snapshot the booking's context (service, agreed quote, requested work,
 * vehicle) onto the invoice so it stays self-describing even if the booking
 * record later changes.
 */
export function applyBookingContextToInvoice(
  invoice: RepairInvoice,
  booking: ServiceBooking
): RepairInvoice {
  return {
    ...invoice,
    serviceTitle: booking.serviceTitle,
    quotedAmount: booking.quotedPrice,
    quoteNote: booking.quoteNote,
    vehicleDetails: describeBookedVehicle(booking) || undefined,
    requestedWork: getRequestedWork(booking).map((w) => w.label),
  };
}
