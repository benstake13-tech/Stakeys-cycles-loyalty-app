import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Mail,
  CheckCircle2,
  X,
  Wrench,
  Bike,
  ShieldCheck,
  Calendar,
  Phone,
  User,
  CreditCard,
  DollarSign,
  Download,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { RepairInvoice, ServiceBooking } from '../types/bikeShop';
import { StakeysLogo } from './StakeysLogo';
import { createInvoiceMailtoUrl } from '../utils/invoiceService';
import toast from 'react-hot-toast';

interface RepairInvoiceModalProps {
  invoice: RepairInvoice;
  booking?: ServiceBooking;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePaymentStatus?: (paymentStatus: 'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online') => void;
  isStaff?: boolean;
}

export const RepairInvoiceModal: React.FC<RepairInvoiceModalProps> = ({
  invoice,
  booking,
  isOpen,
  onClose,
  onUpdatePaymentStatus,
  isStaff = false,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSendInvoiceEmail = () => {
    const mailto = createInvoiceMailtoUrl(invoice);
    window.location.href = mailto;
    toast.success(`Opening email client with Invoice ${invoice.invoiceNumber}!`, {
      icon: '✉️',
    });
  };

  const handleCopyInvoiceNumber = () => {
    navigator.clipboard.writeText(invoice.invoiceNumber);
    setIsCopied(true);
    toast.success(`Copied ${invoice.invoiceNumber} to clipboard!`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getPaymentBadge = () => {
    switch (invoice.paymentStatus) {
      case 'paid_card':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            PAID · DEBIT/CREDIT CARD
          </span>
        );
      case 'paid_cash':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            PAID · CASH AT TILL
          </span>
        );
      case 'paid_online':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            PAID · ONLINE PORTAL
          </span>
        );
      case 'unpaid':
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            PAYMENT DUE UPON COLLECTION
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Container with print styles: on screen it looks sleek, on print it outputs clean white A4 */}
      <div className="relative w-full max-w-4xl my-auto bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print p-4 sm:px-6 bg-[#0a0d12] border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Workshop Tax Invoice</span>
                <button
                  type="button"
                  onClick={handleCopyInvoiceNumber}
                  className="font-mono text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title="Click to copy invoice number"
                >
                  {invoice.invoiceNumber}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400">
                Official itemized repair receipt for {invoice.customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStaff && (
              <button
                type="button"
                onClick={handleSendInvoiceEmail}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
                title="Send invoice breakdown to customer email"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send to Customer</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Sheet */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-8 bg-white text-neutral-900 print:p-0 print:m-0 print:shadow-none print:w-full">
          {/* INVOICE HEADER */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b-2 border-neutral-900">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-950 text-white flex items-center justify-center font-black">
                  <Wrench className="w-5 h-5 text-[#05C147]" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-black tracking-tight text-neutral-950 uppercase">
                    Stakey's Cycles
                  </h1>
                  <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest block">
                    Bicycle Workshop &amp; Certified Repairs
                  </span>
                </div>
              </div>

              <div className="text-xs text-neutral-600 mt-3 space-y-0.5 font-mono">
                <div>14 High Street, Bideford, Devon EX39 2AA</div>
                <div>Tel: +44 7911 882910 · workshop@stakeyscycles.co.uk</div>
                <div>VAT Reg: GB 892 1049 82 · Master Bench #412</div>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Official Repair Invoice
              </span>
              <div className="font-mono text-2xl font-black text-neutral-950">
                {invoice.invoiceNumber}
              </div>
              <div className="text-xs text-neutral-600 space-y-0.5">
                <div>
                  <strong className="text-neutral-800">Date Issued:</strong>{' '}
                  {new Date(invoice.issuedAt || Date.now()).toLocaleDateString('en-GB')}
                </div>
                <div>
                  <strong className="text-neutral-800">Booking Ref:</strong> #{invoice.bookingId}
                </div>
                <div>
                  <strong className="text-neutral-800">Mechanic:</strong> {invoice.leadMechanic}
                </div>
              </div>
            </div>
          </div>

          {/* BILLED TO & ASSET DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
            {/* Customer Details */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                Billed To
              </span>
              <div className="text-sm font-bold text-neutral-950">{invoice.customerName}</div>
              <div className="text-neutral-600">{invoice.customerEmail}</div>
              <div className="text-neutral-600 font-mono">{invoice.customerPhone}</div>
              {invoice.membershipNumber && (
                <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                  Member ID: {invoice.membershipNumber}
                </div>
              )}
            </div>

            {/* Vehicle Details */}
            <div className="space-y-1 sm:text-right">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                Serviced Cycle / Vehicle
              </span>
              <div className="text-sm font-bold text-neutral-950">{invoice.vehicleModel}</div>
              <div className="text-neutral-600 uppercase font-mono text-[11px]">
                Type: {invoice.vehicleCategory.replace('_', ' ')}
              </div>
              {invoice.serviceTitle && (
                <div className="text-neutral-600 text-[11px]">
                  Service Booked: <span className="font-semibold">{invoice.serviceTitle}</span>
                </div>
              )}
              {invoice.vehicleDetails && invoice.vehicleDetails !== invoice.vehicleModel && (
                <div className="text-neutral-500 text-[11px] font-mono">{invoice.vehicleDetails}</div>
              )}
              <div className="text-neutral-500 text-[11px]">
                Workshop Intake Completed: {new Date(invoice.completedAt || Date.now()).toLocaleDateString('en-GB')}
              </div>
              <div className="pt-1 flex sm:justify-end">{getPaymentBadge()}</div>
            </div>
          </div>

          {/* PRE-REPAIR INTAKE SYMPTOMS RECAP */}
          {booking && booking.notes && (
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                Original Customer Reported Symptoms:
              </span>
              <p className="text-neutral-700 italic whitespace-pre-line leading-relaxed">
                {booking.notes}
              </p>
            </div>
          )}

          {/* ITEMIZED BILL OF MATERIALS & LABOUR TABLE */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-neutral-950 uppercase tracking-wide">
              Itemized Workshop Parts &amp; Labour Breakdown
            </h3>

            <div className="border border-neutral-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-100 text-neutral-700 uppercase font-mono text-[10px] border-b border-neutral-300">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description of Work / Component</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-neutral-800">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-neutral-50/50">
                      <td className="py-2.5 px-3 font-mono text-neutral-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <strong className="text-neutral-950 block">{item.description}</strong>
                        {item.partNumber && (
                          <span className="font-mono text-[10px] text-neutral-500">
                            Part #{item.partNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">£{item.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-neutral-950">
                        £{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCIAL TOTALS SUMMARY */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
            {/* Quality Sign-off Badges */}
            <div className="sm:max-w-md space-y-2 text-xs">
              <span className="font-mono text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                Inspection &amp; Safety Sign-Off Checklist:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-neutral-700">
                {invoice.checklistSignoff
                  .filter((c) => c.completed)
                  .map((chk) => (
                    <div key={chk.id} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="line-clamp-1">{chk.label}</span>
                    </div>
                  ))}
              </div>
              {invoice.mechanicNotes && (
                <div className="mt-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-[11px] text-neutral-700 italic">
                  <strong>Mechanic Notes:</strong> "{invoice.mechanicNotes}"
                </div>
              )}
            </div>

            {/* Price Calculation Box */}
            <div className="w-full sm:w-72 bg-neutral-50 p-4 rounded-xl border border-neutral-300 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Labour Subtotal:</span>
                <span className="font-mono font-medium">£{invoice.labourSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Parts &amp; Consumables:</span>
                <span className="font-mono font-medium">£{invoice.partsSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-800 font-semibold pt-1 border-t border-neutral-200">
                <span>Subtotal (Net):</span>
                <span className="font-mono">£{invoice.subtotal.toFixed(2)}</span>
              </div>

              {typeof invoice.quotedAmount === 'number' &&
                Math.abs(invoice.quotedAmount - invoice.grandTotal) > 0.001 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Agreed quote:</span>
                    <span className="font-mono">£{invoice.quotedAmount.toFixed(2)}</span>
                  </div>
                )}

              {invoice.vatAmount > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>VAT ({(invoice.vatRate * 100).toFixed(0)}%):</span>
                  <span className="font-mono">£{invoice.vatAmount.toFixed(2)}</span>
                </div>
              )}

              {invoice.voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50 p-1.5 rounded border border-emerald-200">
                  <span>Voucher Credit Applied:</span>
                  <span className="font-mono">-£{invoice.voucherDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-neutral-900 flex justify-between items-baseline text-neutral-950">
                <span className="font-bold text-sm uppercase">Total Due:</span>
                <span className="font-mono text-xl font-black text-neutral-950">
                  £{invoice.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* SIGNATURE & WARRANTY FOOTER */}
          <div className="pt-6 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-neutral-600">
            <div>
              <div className="font-bold text-neutral-900 mb-1">Workshop Warranty &amp; Assurance:</div>
              <p className="leading-relaxed text-[11px]">
                {invoice.warrantyPeriod}. All replaced components are brand new OEM or genuine aftermarket.
                Please ensure you retain this invoice receipt for any follow-up adjustments.
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="font-mono text-[10px] uppercase text-neutral-400">Authorized Lead Mechanic</div>
              <div className="font-bold text-neutral-900 font-display text-sm">
                {invoice.leadMechanic}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold">
                Master Certified Technician · Stamp Verified
              </div>
            </div>
          </div>
        </div>

        {/* Staff Quick Payment Update Controls (Hidden on print) */}
        {isStaff && onUpdatePaymentStatus && (
          <div className="no-print p-4 bg-[#0a0d12] border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-300">
            <span className="font-mono text-neutral-400">Staff Till Controls: Update Payment Status</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus('paid_card')}
                className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors ${
                  invoice.paymentStatus === 'paid_card'
                    ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                }`}
              >
                Mark Paid (Card)
              </button>
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus('paid_cash')}
                className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors ${
                  invoice.paymentStatus === 'paid_cash'
                    ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                }`}
              >
                Mark Paid (Cash)
              </button>
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus('unpaid')}
                className={`px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors ${
                  invoice.paymentStatus === 'unpaid'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                }`}
              >
                Mark Unpaid
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
