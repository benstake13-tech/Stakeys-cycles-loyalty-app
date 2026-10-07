import { RepairInvoice, OwnerNotificationConfig } from '../types/bikeShop';

export function calculateInvoiceTotals(
  items: Array<{ category: string; quantity: number; unitPrice: number }>,
  vatRate: number = 0,
  voucherDiscount: number = 0
) {
  let labourSubtotal = 0;
  let partsSubtotal = 0;

  items.forEach((item) => {
    const lineTotal = (item.quantity || 1) * (item.unitPrice || 0);
    if (item.category === 'Labour' || item.category === 'Diagnostic') {
      labourSubtotal += lineTotal;
    } else {
      partsSubtotal += lineTotal;
    }
  });

  const subtotal = labourSubtotal + partsSubtotal;
  const vatAmount = subtotal * (vatRate || 0);
  const effectiveVoucher = Math.min(voucherDiscount, subtotal + vatAmount);
  const grandTotal = Math.max(0, subtotal + vatAmount - effectiveVoucher);

  return {
    labourSubtotal: Number(labourSubtotal.toFixed(2)),
    partsSubtotal: Number(partsSubtotal.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    voucherDiscount: Number(effectiveVoucher.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}

export function formatInvoiceEmailBody(invoice: RepairInvoice, ownerConfig?: OwnerNotificationConfig): string {
  const lineItemsText = invoice.items
    .map(
      (it, idx) =>
        `${idx + 1}. [${it.category.toUpperCase()}] ${it.description}\n   Qty: ${it.quantity} @ £${it.unitPrice.toFixed(2)} = £${it.total.toFixed(2)}`
    )
    .join('\n');

  const checklistText = invoice.checklistSignoff
    .filter((c) => c.completed)
    .map((c) => `  ✓ ${c.label}`)
    .join('\n');

  return `
=====================================================
          STAKEY'S CYCLES - WORKSHOP INVOICE
=====================================================
Invoice Reference: ${invoice.invoiceNumber}
Booking Reference: #${invoice.bookingId}
Date Completed:    ${new Date(invoice.completedAt).toLocaleDateString('en-GB')}
Lead Workshop Mech:  ${invoice.leadMechanic} (${invoice.mechanicCertification || 'Workshop Certified'})
-----------------------------------------------------
BILLED TO:
Customer:          ${invoice.customerName}
Phone:             ${invoice.customerPhone}
Email:             ${invoice.customerEmail}
Vehicle / Asset:   ${invoice.vehicleModel} (${invoice.vehicleCategory.toUpperCase()})
-----------------------------------------------------
SAFETY SIGN-OFF & QUALITY AUDIT:
${checklistText || '  ✓ Standard M-Check & Safety Inspection Passed'}

ITEMIZED REPAIR BILL OF MATERIALS & LABOUR:
${lineItemsText || '  1. Workshop Diagnostic & Safety Tune: £' + invoice.subtotal.toFixed(2)}
-----------------------------------------------------
FINANCIAL BREAKDOWN:
Labour Subtotal:             £${invoice.labourSubtotal.toFixed(2)}
Parts & Consumables:         £${invoice.partsSubtotal.toFixed(2)}
Subtotal:                    £${invoice.subtotal.toFixed(2)}
${invoice.vatAmount > 0 ? `VAT (${(invoice.vatRate * 100).toFixed(0)}%):                   £${invoice.vatAmount.toFixed(2)}\n` : ''}${(invoice.voucherDiscount > 0 || invoice.discountCode) ? `Discounts Applied:           -£${invoice.voucherDiscount.toFixed(2)}${invoice.voucherCode ? ` (${invoice.voucherCode})` : ''}${invoice.discountCode ? ` (Code ${invoice.discountCode})` : ''}\n` : ''}-----------------------------------------------------
TOTAL AMOUNT DUE:            £${invoice.grandTotal.toFixed(2)}
PAYMENT STATUS:              ${invoice.paymentStatus.toUpperCase().replace('_', ' ')}
-----------------------------------------------------
WARRANTY & ASSURANCE:
${invoice.warrantyPeriod} on all fitted genuine components and adjustments.

COLLECTION INSTRUCTIONS:
Your cycle is fully serviced, safety tested, and ready for pickup at Stakey's Cycles workshop bench (Salford, M6 6QS).
Please present your invoice number or membership card upon collection.
=====================================================
`;
}

export function createInvoiceMailtoUrl(invoice: RepairInvoice, ownerConfig?: OwnerNotificationConfig): string {
  const subject = `Official Workshop Invoice & Pickup Notice: ${invoice.invoiceNumber} - Stakey's Cycles`;
  const body = formatInvoiceEmailBody(invoice, ownerConfig);
  return `mailto:${invoice.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
