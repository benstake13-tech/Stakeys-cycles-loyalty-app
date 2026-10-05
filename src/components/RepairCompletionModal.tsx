import React, { useState, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  X,
  Bike,
  User,
  Calendar,
  Sparkles,
  Award,
  FileText,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  ServiceBooking,
  InvoiceLineItem,
  RepairChecklistItem,
  RepairInvoice,
  SaleDiscountState,
} from '../shared/types/bikeShop';
import {
  DEFAULT_REPAIR_CHECKLIST_ITEMS,
  COMMON_REPAIR_PRESETS,
  PresetRepairItem,
} from '../shared/data/repairChecklistCatalog';
import { ALL_BIKE_ISSUES_MAP } from '../shared/data/bikeIssuesCatalog';
import { calculateInvoiceTotals } from '../shared/utils/invoiceService';
import {
  buildInvoiceLineItemsFromBooking,
  reconcileInvoiceWithBooking,
  applyBookingContextToInvoice,
} from '../shared/utils/invoiceReconciliation';
import {
  validateDiscountCode,
  findDiscountCode,
  describeDiscountValue,
  roundMoney,
} from '../shared/utils/discountService';
import { useShop } from '../shared/context/ShopContext';
import toast from 'react-hot-toast';

interface RepairCompletionModalProps {
  booking: ServiceBooking;
  isOpen: boolean;
  onClose: () => void;
  onSaveInvoice: (invoice: RepairInvoice) => Promise<void>;
  currentStaffName?: string;
}

export const RepairCompletionModal: React.FC<RepairCompletionModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSaveInvoice,
  currentStaffName = 'Ben Stake - Lead Mechanic',
}) => {
  // Existing invoice or fresh state
  const existingInvoice = booking.invoice;

  // 1. Checklist State
  const [checklist, setChecklist] = useState<RepairChecklistItem[]>(() => {
    if (existingInvoice && existingInvoice.checklistSignoff.length > 0) {
      return existingInvoice.checklistSignoff;
    }
    return DEFAULT_REPAIR_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      completed: true, // Default to completed as staff is completing repair
    }));
  });

  const [newChecklistLabel, setNewChecklistLabel] = useState('');

  // 2. Line Items State
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() => {
    if (existingInvoice && existingInvoice.items.length > 0) {
      return existingInvoice.items;
    }
    // Seed the bill from the booking itself: the exact symptoms the customer
    // ticked (or the seasonal package's included checks), so the invoice always
    // corresponds to the work that was actually booked.
    return buildInvoiceLineItemsFromBooking(booking);
  });

  // 3. Tax, Vouchers & Mechanic Info
  const [vatRate, setVatRate] = useState<number>(existingInvoice?.vatRate || 0);
  const voucherDiscount = booking.notes?.includes('£40 Service Voucher') || booking.serviceTitle.includes('£40 Voucher') ? 40 : 0;
  const [leadMechanic, setLeadMechanic] = useState(
    existingInvoice?.leadMechanic || currentStaffName || 'Ben Stake - Lead Mechanic'
  );
  const [mechanicNotes, setMechanicNotes] = useState(
    existingInvoice?.mechanicNotes ||
      'All reported symptoms inspected and adjusted. Components tightened to manufacturer torque specifications. Road-tested and approved for customer pickup.'
  );
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online'>(
    existingInvoice?.paymentStatus || 'unpaid'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Discount code applied at invoice time (scan or type)
  const { discountCodes, recordDiscountUsage } = useShop();
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<SaleDiscountState | null>(null);

  // Dynamic calculations in real-time. Voucher credit + discount code are combined.
  const combinedDiscount = roundMoney((voucherDiscount || 0) + (appliedDiscount?.amountOff || 0));
  const totals = useMemo(() => {
    return calculateInvoiceTotals(lineItems, vatRate, combinedDiscount);
  }, [lineItems, vatRate, combinedDiscount]);

  // Reconciliation against the booking: keep the invoice honest about the work
  // the customer actually booked and the quote they were given.
  const reconciliation = useMemo(
    () =>
      reconcileInvoiceWithBooking(
        { items: lineItems, grandTotal: totals.grandTotal },
        booking
      ),
    [lineItems, totals.grandTotal, booking]
  );
  const [useQuotedTotal, setUseQuotedTotal] = useState(false);

  const applyInvoiceDiscount = (raw: string) => {
    const code = findDiscountCode(raw, discountCodes || []);
    if (!code) {
      toast.error(`No discount code matches "${raw}".`);
      return;
    }
    const subtotal = lineItems.reduce((s, l) => s + (l.quantity || 1) * (l.unitPrice || 0), 0);
    const res = validateDiscountCode(code, {
      subtotal,
      customerUid: booking.customerId,
      customerMembership: booking.membershipNumber,
      categories: [booking.vehicleCategory],
    });
    if (!res.ok) {
      toast.error(`${code.code}: ${res.reason}`);
      return;
    }
    setAppliedDiscount({
      code: code.code,
      label: code.title,
      type: code.type,
      value: code.value,
      amountOff: res.amountOff!,
      discountCodeId: code.id,
      source: 'discount_code',
    });
    toast.success(`Applied ${code.code} — ${describeDiscountValue(code.type, code.value)}.`);
  };

  if (!isOpen) return null;

  // Checklist handlers
  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleToggleAllChecklist = (allChecked: boolean) => {
    setChecklist((prev) => prev.map((item) => ({ ...item, completed: allChecked })));
  };

  const handleAddCustomChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistLabel.trim()) return;
    const newItem: RepairChecklistItem = {
      id: `chk-custom-${Date.now()}`,
      label: newChecklistLabel.trim(),
      category: 'Final Inspection',
      completed: true,
      notes: 'Custom task verified by mechanic',
    };
    setChecklist((prev) => [...prev, newItem]);
    setNewChecklistLabel('');
  };

  // Line item handlers
  const handleAddLineItem = () => {
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: '',
      category: 'Part',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setLineItems((prev) => [...prev, newItem]);
  };

  const handleAddPreset = (preset: PresetRepairItem) => {
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: preset.name,
      category: preset.category,
      quantity: 1,
      unitPrice: preset.unitPrice,
      total: preset.unitPrice,
      partNumber: preset.partNumber,
    };
    setLineItems((prev) => [...prev, newItem]);
    toast.success(`Added ${preset.name}`);
  };

  const handleUpdateLineItem = (
    id: string,
    field: keyof InvoiceLineItem,
    value: any
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        // Auto-calculate line total: qty * unitPrice
        const qty = field === 'quantity' ? Number(value) || 0 : item.quantity;
        const price = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
        updated.total = Number((qty * price).toFixed(2));
        return updated;
      })
    );
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error('Invoice must contain at least one line item.');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit & build invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const invalidItem = lineItems.find((i) => !i.description.trim() || i.quantity <= 0);
    if (invalidItem) {
      toast.error('Please enter a description and valid quantity for all items.');
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceNumber = existingInvoice?.invoiceNumber || `INV-2026-${Date.now().toString().slice(-4)}`;
      // When the bill matches the agreed quote, force the grand total to that
      // quoted figure so the customer is charged exactly what they agreed.
      const reconciledGrandTotal =
        useQuotedTotal && reconciliation.quoteAmount !== undefined
          ? reconciliation.quoteAmount
          : totals.grandTotal;
      const completedInvoice: RepairInvoice = applyBookingContextToInvoice(
        {
          id: existingInvoice?.id || `inv-${Date.now()}`,
          invoiceNumber,
          bookingId: booking.id,
          issuedAt: existingInvoice?.issuedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          leadMechanic: leadMechanic.trim() || 'Ben Stake - Lead Mechanic',
          mechanicCertification: 'Master Bench',
          customerName: booking.customerName,
          customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone,
          membershipNumber: booking.membershipNumber,
          vehicleModel: booking.vehicleModel,
          vehicleCategory: booking.vehicleCategory,
          items: lineItems,
          checklistSignoff: checklist,
          labourSubtotal: totals.labourSubtotal,
          partsSubtotal: totals.partsSubtotal,
          subtotal: totals.subtotal,
          vatRate,
          vatAmount: totals.vatAmount,
          voucherDiscount: totals.voucherDiscount,
          voucherCode: voucherDiscount > 0 ? 'LOYALTY-VOUCHER-£40' : undefined,
          discountCode: appliedDiscount?.code,
          discountLabel: appliedDiscount?.label,
          grandTotal: reconciledGrandTotal,
          paymentStatus,
          paymentDate: paymentStatus !== 'unpaid' ? new Date().toISOString() : undefined,
          mechanicNotes: mechanicNotes.trim(),
          warrantyPeriod: '30-Day Stakey Workshop Warranty',
        },
        booking
      );

      await onSaveInvoice(completedInvoice);
      if (appliedDiscount?.discountCodeId) {
        await recordDiscountUsage(appliedDiscount.discountCodeId);
      }
      toast.success(`Invoice ${invoiceNumber} generated! Total: £${reconciledGrandTotal.toFixed(2)}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save repair invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl my-auto bg-[#0d1015] border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#090b0e] border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#05C147] text-neutral-950 flex items-center justify-center font-black">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-white">
                  Staff Repair Completion &amp; Invoice Builder
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Booking #{booking.id}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Sign off completion checklist, price up parts &amp; labour manually, and build customer invoice.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <form onSubmit={handleSubmitInvoice} className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Customer & Asset Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-neutral-500 text-[10px] block">Customer</span>
                <span className="font-bold text-white">{booking.customerName}</span>
                <div className="text-[11px] text-neutral-400 font-mono">{booking.customerPhone}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-neutral-500 text-[10px] block">Bicycle / Asset</span>
                <span className="font-bold text-white">{booking.vehicleModel}</span>
                <div className="text-[11px] text-neutral-400 uppercase font-mono">
                  {booking.vehicleCategory.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-neutral-500 text-[10px] block">Scheduled Window</span>
                <span className="font-bold text-white">{booking.preferredDate}</span>
                <div className="text-[11px] text-neutral-400">{booking.preferredTimeSlot}</div>
              </div>
            </div>
          </div>

          {/* Pre-Repair Customer Reported Symptoms Recap */}
          {booking.selectedIssues && booking.selectedIssues.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
              <span className="font-mono text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                Customer Reported Symptoms During Intake ({booking.selectedIssues.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {booking.selectedIssues.map((id) => {
                  const it = ALL_BIKE_ISSUES_MAP.get(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-neutral-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#05C147]" />
                      <strong>[{it?.category || 'Issue'}]</strong> {it?.label || id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* BOOKING ↔ INVOICE RECONCILIATION */}
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                Reconciliation with Booking #{booking.id}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-neutral-500 text-[10px] block">Service Booked</span>
                <span className="font-bold text-white">{booking.serviceTitle}</span>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  {reconciliation.requestedWork.length} requested item
                  {reconciliation.requestedWork.length === 1 ? '' : 's'} · Vehicle:{' '}
                  {booking.vehicleModel}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-neutral-500 text-[10px] block">Agreed Quote</span>
                {reconciliation.quoteAmount !== undefined ? (
                  <>
                    <span className="font-bold text-white font-mono">
                      £{reconciliation.quoteAmount.toFixed(2)}
                    </span>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      vs invoice total £{totals.grandTotal.toFixed(2)}
                      {reconciliation.quoteMatches ? (
                        <span className="text-emerald-400 font-semibold"> · matches</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">
                          {' '}
                          · {reconciliation.quoteDelta! > 0 ? '+' : '−'}£
                          {Math.abs(reconciliation.quoteDelta!).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-neutral-400 text-[11px]">
                    No quote recorded on this booking.
                  </span>
                )}
              </div>
            </div>

            {reconciliation.unbilledWork.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300">
                <strong>Not yet itemised:</strong>{' '}
                {reconciliation.unbilledWork.map((w) => w.label).join(', ')}. Add a line so the
                bill matches what the customer asked for.
              </div>
            )}

            {reconciliation.quoteAmount !== undefined && !reconciliation.quoteMatches && (
              <label className="flex items-center gap-2 text-[11px] text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useQuotedTotal}
                  onChange={(e) => setUseQuotedTotal(e.target.checked)}
                  className="w-4 h-4 rounded text-[#05C147] bg-neutral-900 border-neutral-700 cursor-pointer accent-[#05C147]"
                />
                Charge exactly the agreed quote (£{reconciliation.quoteAmount.toFixed(2)}) as the
                invoice total
              </label>
            )}
          </div>

          {/* SECTION 1: Repair Completion & Safety Checklist */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold text-white">
                  1. Workshop Repair Completion &amp; Workshop Sign-Off Checklist
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAllChecklist(true)}
                  className="px-2 py-1 text-[11px] rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
                >
                  Check All
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllChecklist(false)}
                  className="px-2 py-1 text-[11px] rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 transition-colors cursor-pointer"
                >
                  Uncheck All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    item.completed
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-neutral-200'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => handleToggleChecklist(item.id)}
                    className="mt-0.5 w-4 h-4 rounded text-[#05C147] focus:ring-emerald-500 bg-neutral-900 border-neutral-700 cursor-pointer accent-[#05C147] shrink-0"
                  />
                  <div>
                    <div className={item.completed ? 'font-medium text-white' : 'text-neutral-400'}>
                      {item.label}
                    </div>
                    {item.notes && <div className="text-[10px] text-neutral-500">{item.notes}</div>}
                  </div>
                </label>
              ))}
            </div>

            {/* Add Custom Checklist Item */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newChecklistLabel}
                onChange={(e) => setNewChecklistLabel(e.target.value)}
                placeholder="Add custom task or inspection check performed..."
                className="flex-1 bg-[#090b0e] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCustomChecklistItem}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
              >
                + Add Check
              </button>
            </div>
          </div>

          {/* SECTION 2: Manual Line-Item Price Builder */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-sm font-bold text-white">
                  2. Parts &amp; Labour Pricing Builder (Auto-Calculated)
                </h3>
              </div>

              <button
                type="button"
                onClick={handleAddLineItem}
                className="px-3 py-1.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Part / Task</span>
              </button>
            </div>

            {/* Quick Preset Templates */}
            <div>
              <span className="text-[11px] font-mono uppercase text-neutral-400 block mb-1.5">
                Quick 1-Click Common Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REPAIR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span>{preset.name}</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      (£{preset.unitPrice.toFixed(2)})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-neutral-800 rounded-2xl overflow-hidden bg-neutral-950/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                  <thead className="bg-neutral-900/90 text-neutral-400 uppercase font-mono text-[10px] border-b border-neutral-800">
                    <tr>
                      <th className="py-2.5 px-3">Item / Work Description</th>
                      <th className="py-2.5 px-3 w-32">Type</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-28 text-right">Unit Price (£)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Total (£)</th>
                      <th className="py-2.5 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/80">
                    {lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-neutral-900/30">
                        {/* Description */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'description', e.target.value)
                            }
                            placeholder="e.g. Replace rear brake pads, True rear wheel, 9-speed chain..."
                            className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Category */}
                        <td className="py-2 px-3">
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleUpdateLineItem(item.id, 'category', e.target.value)
                            }
                            className="w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="Labour">Labour</option>
                            <option value="Part">Part</option>
                            <option value="Consumable">Consumable</option>
                            <option value="Diagnostic">Diagnostic</option>
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateLineItem(
                                item.id,
                                'quantity',
                                Math.max(1, parseInt(e.target.value, 10) || 1)
                              )
                            }
                            className="w-16 bg-[#090b0e] border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 font-mono">
                              £
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateLineItem(
                                  item.id,
                                  'unitPrice',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 bg-[#090b0e] border border-neutral-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white text-right font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </td>

                        {/* Line Total (Auto-calculated) */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                          £{item.total.toFixed(2)}
                        </td>

                        {/* Remove */}
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations Breakdown Panel */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 text-xs">
                <label className="block text-neutral-400 font-medium">
                  Lead Mechanic Sign-Off
                </label>
                <input
                  type="text"
                  value={leadMechanic}
                  onChange={(e) => setLeadMechanic(e.target.value)}
                  placeholder="e.g. Ben Stake - Lead Mechanic"
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />

                <label className="block text-neutral-400 font-medium pt-1">
                  Mechanic Completion Notes / Customer Advice
                </label>
                <textarea
                  rows={2}
                  value={mechanicNotes}
                  onChange={(e) => setMechanicNotes(e.target.value)}
                  placeholder="Specific adjustments made, bedding-in instructions for brake pads, etc..."
                  className="w-full bg-[#090b0e] border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-neutral-400">Payment Status:</span>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="bg-[#090b0e] border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="unpaid">Unpaid (Due on Collection)</option>
                    <option value="paid_card">Paid by Card</option>
                    <option value="paid_cash">Paid by Cash</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Auto-Calculated Totals */}
              <div className="bg-[#090b0e] p-4 rounded-xl border border-neutral-800 space-y-2 text-xs self-start">
                <div className="flex justify-between text-neutral-400">
                  <span>Labour Subtotal:</span>
                  <span className="font-mono text-white">£{totals.labourSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Parts &amp; Consumables:</span>
                  <span className="font-mono text-white">£{totals.partsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-300 font-semibold pt-1 border-t border-neutral-800">
                  <span>Subtotal:</span>
                  <span className="font-mono">£{totals.subtotal.toFixed(2)}</span>
                </div>

                {totals.voucherDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                    <span>Loyalty Voucher (£40 Credit):</span>
                    <span className="font-mono">-£{totals.voucherDiscount.toFixed(2)}</span>
                  </div>
                )}

                {/* Discount code — scan or type a code to auto-apply */}
                <div className="pt-2 border-t border-neutral-800 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (discountInput.trim()) applyInvoiceDiscount(discountInput.trim());
                        }
                      }}
                      placeholder="Discount code (scan or type)"
                      className="flex-1 rounded-lg border border-neutral-700 bg-black px-2 py-1.5 font-mono text-[11px] text-white outline-none focus:border-[#05C147]"
                    />
                    <button
                      type="button"
                      onClick={() => discountInput.trim() && applyInvoiceDiscount(discountInput.trim())}
                      className="rounded-lg bg-neutral-800 px-2.5 text-[11px] font-bold text-white hover:bg-neutral-700"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedDiscount && (
                    <div className="flex items-center justify-between text-emerald-400">
                      <span>
                        Code {appliedDiscount.code}
                        <button
                          type="button"
                          onClick={() => setAppliedDiscount(null)}
                          className="ml-2 text-rose-400 underline"
                        >
                          remove
                        </button>
                      </span>
                      <span className="font-mono">-£{appliedDiscount.amountOff.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t-2 border-neutral-800 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-white uppercase tracking-wide">
                    Grand Total Due:
                  </span>
                  <span className="font-mono text-2xl font-black text-[#05C147]">
                    £{totals.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Generating Invoice...'
                  : `Save & Build Professional Invoice (£${totals.grandTotal.toFixed(2)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
