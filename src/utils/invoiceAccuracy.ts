import { ServiceBooking, RepairInvoice, InvoiceLineItem } from '../types/bikeShop';
import { ALL_BIKE_ISSUES_MAP } from '../data/bikeIssuesCatalog';

/**
 * Every symptom the customer reported at intake, as human labels. These are the
 * jobs the invoice is expected to account for.
 */
export function bookingSymptomLabels(booking: ServiceBooking): string[] {
  const labels: string[] = [];
  (booking.selectedIssues || []).forEach((id) => {
    const issue = ALL_BIKE_ISSUES_MAP.get(id);
    if (issue) labels.push(issue.label);
  });
  const other = booking.otherNotes?.trim();
  if (other) labels.push(other);
  return labels;
}

/**
 * Build the opening set of invoice lines from the completed job, so the invoice
 * starts out describing exactly what was booked rather than a single generic
 * labour line. Prices stay at zero for staff to complete.
 */
export function seedInvoiceLineItemsFromBooking(
  booking: ServiceBooking,
  makeId: (index: number) => string
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  let index = 0;

  (booking.selectedIssues || []).forEach((id) => {
    const issue = ALL_BIKE_ISSUES_MAP.get(id);
    if (!issue) return;
    items.push({
      id: makeId(index++),
      description: `${issue.label} (${issue.category})`,
      category: issue.category === 'E-Bike System' ? 'Diagnostic' : 'Labour',
      quantity: 1,
      unitPrice: issue.defaultPrice ?? 0,
      total: issue.defaultPrice ?? 0,
    });
  });

  const other = booking.otherNotes?.trim();
  if (other) {
    items.push({
      id: makeId(index++),
      description: `${other} (Customer reported)`,
      category: 'Labour',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    });
  }

  if (items.length === 0) {
    items.push({
      id: makeId(index++),
      description: `${booking.serviceTitle || 'Workshop Service & Inspection'} (Labour)`,
      category: 'Labour',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    });
  }

  return items;
}

export interface InvoiceAudit {
  /** True when the invoice is a faithful, priced record of the completed job. */
  ok: boolean;
  /** Human-readable problems that make the invoice inaccurate. */
  issues: string[];
  /** Reported symptoms the invoice accounts for. */
  coveredSymptoms: string[];
  /** Reported symptoms the invoice does not mention at all. */
  missingSymptoms: string[];
  /** Sum of the line items, independent of the stored subtotal. */
  itemsTotal: number;
}

/**
 * Compare an invoice against the job it is meant to bill. Catches the common
 * inaccuracies: an unpriced job, blank lines, a stale subtotal, and reported
 * symptoms that never made it onto the bill.
 */
export function auditInvoiceAgainstBooking(
  booking: ServiceBooking,
  invoice: RepairInvoice
): InvoiceAudit {
  const issues: string[] = [];
  const items = invoice.items || [];

  if (items.length === 0) {
    issues.push('Invoice has no line items.');
  }

  items.forEach((item) => {
    if (!item.description.trim()) {
      issues.push('A line item is missing its description.');
    }
    if (!(item.quantity > 0)) {
      issues.push(`"${item.description || 'Line item'}" has a quantity of zero.`);
    }
  });

  const itemsTotal = Number(
    items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0).toFixed(2)
  );

  if (items.length > 0 && invoice.grandTotal <= 0 && invoice.voucherDiscount <= 0) {
    issues.push('Grand total is £0.00 — price up the completed job before issuing the invoice.');
  }

  if (items.length > 0 && Math.abs(itemsTotal - invoice.subtotal) > 0.01) {
    issues.push(
      `Stored subtotal £${invoice.subtotal.toFixed(2)} does not match the line items (£${itemsTotal.toFixed(2)}).`
    );
  }

  const haystack = [...items.map((item) => item.description), ...(invoice.reportedSymptoms || [])]
    .join(' \n ')
    .toLowerCase();

  const symptoms = bookingSymptomLabels(booking);
  const coveredSymptoms: string[] = [];
  const missingSymptoms: string[] = [];

  symptoms.forEach((label) => {
    if (haystack.includes(label.toLowerCase())) {
      coveredSymptoms.push(label);
    } else {
      missingSymptoms.push(label);
      issues.push(`Reported symptom "${label}" is not covered by any invoice line item.`);
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    coveredSymptoms,
    missingSymptoms,
    itemsTotal,
  };
}
