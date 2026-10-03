import React, { useEffect, useMemo, useState } from 'react';
import {
  Scan,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Tag,
  UserCheck,
  X,
  BadgePercent,
  Ticket,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  UserProfile,
  DiscountCode,
  SaleLineItem,
  SaleDiscountState,
  SalePaymentMethod,
  SaleTransaction,
  CollectedVoucher,
} from '../types/bikeShop';
import { QRCodeScannerModal } from './QRCodeScannerModal';
import {
  validateDiscountCode,
  computeSaleTotals,
  roundMoney,
  findDiscountCode,
  voucherToDiscountState,
  describeDiscountValue,
} from '../utils/discountService';
import { normalizeScannedCode, resolveCustomer } from '../utils/membershipCode';

const QUICK_ITEMS: Omit<SaleLineItem, 'id'>[] = [
  { description: 'Standard Workshop Labour (30 min)', category: 'Labour', quantity: 1, unitPrice: 30 },
  { description: 'Full Service Labour', category: 'Labour', quantity: 1, unitPrice: 60 },
  { description: 'Puncture Repair & Tube', category: 'Part', quantity: 1, unitPrice: 18 },
  { description: 'Hydraulic Brake Bleed', category: 'Labour', quantity: 1, unitPrice: 35 },
  { description: 'Inner Tube (Presta)', category: 'Part', quantity: 1, unitPrice: 6.5 },
  { description: 'Chain & Cassette Fitting', category: 'Labour', quantity: 1, unitPrice: 25 },
  { description: 'Muc-Off Bike Cleaner', category: 'Consumable', quantity: 1, unitPrice: 9.99 },
  { description: 'Safety Check & Tune', category: 'Labour', quantity: 1, unitPrice: 40 },
];

let lineSeq = 0;
const nextLineId = () => `line-${Date.now().toString(36)}-${lineSeq++}`;

export const CounterSaleTab: React.FC = () => {
  const {
    currentUser,
    users = [],
    discountCodes,
    sales,
    completeSale,
    recordDiscountUsage,
    redeemServiceVoucher,
  } = useShop();

  const [lines, setLines] = useState<SaleLineItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [discount, setDiscount] = useState<SaleDiscountState | null>(null);
  const [discountMessage, setDiscountMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [vatRate, setVatRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('card');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleTransaction | null>(null);

  const subtotal = useMemo(
    () => roundMoney(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)),
    [lines]
  );

  /**
   * The active discount is re-evaluated on every basket change, so the amount off
   * (and therefore the total) always matches what is actually in the basket.
   */
  const effectiveDiscount = useMemo<SaleDiscountState | null>(() => {
    if (!discount) return null;
    if (discount.source === 'discount_code' && discount.discountCodeId) {
      const code = discountCodes.find((c) => c.id === discount.discountCodeId);
      if (!code) return null;
      const res = validateDiscountCode(code, {
        subtotal,
        customerUid: selectedCustomer?.uid,
        customerMembership: selectedCustomer?.membershipNumber,
      });
      return res.ok ? { ...discount, amountOff: res.amountOff! } : null;
    }
    if (discount.source === 'voucher') {
      const amountOff = roundMoney(Math.min(discount.value, subtotal));
      return amountOff > 0 ? { ...discount, amountOff } : null;
    }
    return discount;
  }, [discount, subtotal, discountCodes, selectedCustomer]);

  const totals = useMemo(
    () => computeSaleTotals(lines, vatRate, effectiveDiscount?.amountOff || 0),
    [lines, vatRate, effectiveDiscount]
  );

  // If a minimum-spend threshold is later breached, drop the discount with an explanation.
  useEffect(() => {
    if (discount && !effectiveDiscount) {
      setDiscount(null);
      setDiscountMessage({
        ok: false,
        text: 'Discount removed — the basket no longer qualifies.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDiscount]);

  const addLine = (item: Omit<SaleLineItem, 'id'>) => {
    setLines((prev) => {
      const existing = prev.find(
        (l) => l.description === item.description && l.unitPrice === item.unitPrice
      );
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { ...item, id: nextLineId() }];
    });
    setLastSale(null);
  };

  const changeQty = (id: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const applyDiscountCode = (code: DiscountCode, customer?: UserProfile | null) => {
    const sub = roundMoney(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const cust = customer !== undefined ? customer : selectedCustomer;
    const res = validateDiscountCode(code, {
      subtotal: sub,
      customerUid: cust?.uid,
      customerMembership: cust?.membershipNumber,
    });
    if (!res.ok) {
      setDiscount(null);
      setDiscountMessage({ ok: false, text: `${code.code}: ${res.reason}` });
      return false;
    }
    setDiscount({
      code: code.code,
      label: code.title,
      type: code.type,
      value: code.value,
      amountOff: res.amountOff!,
      discountCodeId: code.id,
      source: 'discount_code',
    });
    setDiscountMessage({
      ok: true,
      text: `Applied ${code.code} — ${describeDiscountValue(code.type, code.value)} (-£${res.amountOff!.toFixed(2)}).`,
    });
    return true;
  };

  /** Try a member's own available voucher if the basket can use it. */
  const autoApplyMemberVoucher = (customer: UserProfile): boolean => {
    const vouchers = (customer.serviceVouchers || []).filter((v) => v.status === 'available');
    if (vouchers.length === 0) return false;
    const sub = roundMoney(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const best = vouchers
      .map((v: CollectedVoucher) => ({ v, state: voucherToDiscountState(v, sub) }))
      .filter((x): x is { v: CollectedVoucher; state: SaleDiscountState } => !!x.state)
      .sort((a, b) => b.state.amountOff - a.state.amountOff)[0];
    if (!best) return false;
    setDiscount(best.state);
    setDiscountMessage({
      ok: true,
      text: `Applied member voucher ${best.v.code} (-£${best.state.amountOff.toFixed(2)}).`,
    });
    return true;
  };

  /** A member was scanned or selected: load them and auto-apply their best discount. */
  const handleCustomer = (customer: UserProfile, opts?: { autoApply?: boolean }) => {
    setSelectedCustomer(customer);
    setLastSale(null);
    if (opts?.autoApply === false) return;

    const assigned = discountCodes
      .filter((c) => c.assignedToUid && c.assignedToUid === customer.uid)
      .sort((a, b) => b.value - a.value)[0];
    if (assigned && applyDiscountCode(assigned, customer)) return;
    if (autoApplyMemberVoucher(customer)) return;
    setDiscountMessage({
      ok: true,
      text: `${customer.displayName} loaded. No personal discount on file — scan or enter one.`,
    });
  };

  /** The heart of the feature: a scanned code is resolved and used automatically. */
  const handleScannedCode = (raw: string) => {
    const clean = normalizeScannedCode(raw);
    const member = resolveCustomer(raw, users);
    if (member.status === 'match') {
      handleCustomer(member.customer);
      return;
    }
    const code = findDiscountCode(clean, discountCodes);
    if (code) {
      applyDiscountCode(code);
      return;
    }
    setDiscountMessage({ ok: false, text: `No member or discount code matches "${clean}".` });
  };

  const handleManualCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedCode(manualCode.trim());
    setManualCode('');
  };

  const clearDiscount = () => {
    setDiscount(null);
    setDiscountMessage(null);
  };

  const clearSale = () => {
    setLines([]);
    setSelectedCustomer(null);
    setDiscount(null);
    setDiscountMessage(null);
    setLastSale(null);
  };

  const complete = async () => {
    if (lines.length === 0) {
      setDiscountMessage({ ok: false, text: 'Add at least one item before completing the sale.' });
      return;
    }
    const year = new Date().getFullYear();
    const saleNumber = `SALE-${year}-${String(sales.length + 1).padStart(4, '0')}`;
    const sale: SaleTransaction = {
      id: `sale-${Date.now()}`,
      saleNumber,
      customerId: selectedCustomer?.uid,
      membershipNumber: selectedCustomer?.membershipNumber,
      customerName: selectedCustomer?.displayName || 'Walk-in customer',
      items: lines,
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      discount: totals.discount,
      discountCode: effectiveDiscount?.code,
      discountLabel: effectiveDiscount?.label,
      grandTotal: totals.grandTotal,
      paymentMethod,
      staffUid: currentUser?.uid,
      staffName: currentUser?.displayName,
      createdAt: new Date(),
    };

    const res = await completeSale(sale);
    if (res.success && effectiveDiscount?.source === 'discount_code' && effectiveDiscount.discountCodeId) {
      await recordDiscountUsage(effectiveDiscount.discountCodeId);
    }
    if (res.success && effectiveDiscount?.source === 'voucher' && selectedCustomer && effectiveDiscount.code) {
      await redeemServiceVoucher(selectedCustomer.uid, effectiveDiscount.code, currentUser?.uid);
    }
    setLastSale(res.sale || sale);
    setDiscountMessage({ ok: res.success, text: res.message || '' });
    setLines([]);
    setSelectedCustomer(null);
    setDiscount(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      {/* LEFT: basket + quick add */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" /> Counter Sale / Till
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Scan a member barcode or a discount code — the discount is applied and the total updated automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="pressable flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-neutral-950 hover:bg-emerald-400"
            >
              <Scan className="w-4 h-4" /> Scan code
            </button>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={clearSale}
                className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Manual code entry */}
        <form onSubmit={handleManualCode} className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter or scan member ID / discount code"
              className="w-full rounded-xl border border-neutral-700 bg-black py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-neutral-800 px-4 text-xs font-bold text-white hover:bg-neutral-700"
          >
            Apply
          </button>
        </form>

        {/* Quick add grid */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Quick add
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_ITEMS.map((item) => (
              <button
                key={item.description}
                type="button"
                onClick={() => addLine(item)}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black px-3 py-2 text-left text-xs text-neutral-300 hover:border-emerald-500/40 hover:text-white"
              >
                <span className="pr-2">{item.description}</span>
                <span className="font-mono font-semibold text-emerald-400">£{item.unitPrice.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Basket */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Basket ({lines.length})
            </span>
            {selectedCustomer && (
              <span className="flex items-center gap-1 text-[11px] text-sky-300">
                <UserCheck className="w-3.5 h-3.5" />
                {selectedCustomer.displayName} · {selectedCustomer.membershipNumber}
              </span>
            )}
          </div>
          {lines.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-600">
              Basket is empty. Add items above or scan a code.
            </p>
          ) : (
            <div className="divide-y divide-neutral-900">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{l.description}</div>
                    <div className="text-[11px] text-neutral-500">
                      {l.category} · £{l.unitPrice.toFixed(2)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => changeQty(l.id, -1)}
                      className="rounded-lg bg-neutral-800 p-1 text-white hover:bg-neutral-700"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-white">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(l.id, 1)}
                      className="rounded-lg bg-neutral-800 p-1 text-white hover:bg-neutral-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-16 text-right font-mono text-sm text-white">
                    £{(l.quantity * l.unitPrice).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(l.id)}
                    className="rounded-lg p-1 text-rose-400 hover:bg-rose-950/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: totals */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Discount</span>
            {effectiveDiscount && (
              <button type="button" onClick={clearDiscount} className="text-[11px] text-rose-400 hover:text-rose-300">
                Remove
              </button>
            )}
          </div>

          {effectiveDiscount ? (
            <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300">
                  <BadgePercent className="w-4 h-4" /> {effectiveDiscount.code}
                </span>
                <span className="text-xs text-amber-200">
                  {effectiveDiscount.source === 'voucher' ? 'Voucher' : describeDiscountValue(effectiveDiscount.type, effectiveDiscount.value)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-amber-200/80">{effectiveDiscount.label}</div>
              <div className="mt-1 font-mono text-sm font-black text-amber-300">
                -£{totals.discount.toFixed(2)}
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              No discount applied. Scan a code or pick one below.
            </p>
          )}

          {discountMessage && (
            <div
              className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-[11px] ${
                discountMessage.ok
                  ? 'border border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : 'border border-rose-900 bg-rose-950/40 text-rose-300'
              }`}
            >
              {discountMessage.ok ? (
                <Check className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              )}
              <span>{discountMessage.text}</span>
            </div>
          )}

          {/* Available codes for one-tap apply */}
          {discountCodes.filter((c) => c.status === 'active').length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Active codes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {discountCodes
                  .filter((c) => c.status === 'active')
                  .slice(0, 8)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyDiscountCode(c)}
                      className="rounded-lg border border-neutral-800 bg-black px-2 py-1 font-mono text-[11px] text-neutral-300 hover:border-amber-500/50 hover:text-amber-300"
                    >
                      {c.code}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Member vouchers */}
          {selectedCustomer && (selectedCustomer.serviceVouchers || []).some((v) => v.status === 'available') && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                {selectedCustomer.displayName}'s vouchers
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedCustomer.serviceVouchers || [])
                  .filter((v) => v.status === 'available')
                  .map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        const state = voucherToDiscountState(v, totals.subtotal);
                        if (state) {
                          setDiscount(state);
                          setDiscountMessage({
                            ok: true,
                            text: `Applied voucher ${v.code} (-£${state.amountOff.toFixed(2)}).`,
                          });
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-black px-2 py-1 text-[11px] text-neutral-300 hover:border-emerald-500/50 hover:text-emerald-300"
                    >
                      <Ticket className="w-3 h-3" /> {v.title} (£{Number(v.value).toFixed(0)})
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
          <div className="flex justify-between text-sm text-neutral-400">
            <span>Subtotal</span>
            <span className="font-mono text-white">£{totals.subtotal.toFixed(2)}</span>
          </div>
          <label className="flex items-center justify-between text-sm text-neutral-400">
            <span>VAT rate (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(vatRate * 100)}
              onChange={(e) => setVatRate(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
              className="w-20 rounded-lg border border-neutral-700 bg-black px-2 py-1 text-right font-mono text-white outline-none focus:border-emerald-500"
            />
          </label>
          {totals.vatAmount > 0 && (
            <div className="flex justify-between text-sm text-neutral-400">
              <span>VAT</span>
              <span className="font-mono text-white">£{totals.vatAmount.toFixed(2)}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-amber-300">
              <span>Discount {effectiveDiscount ? `(${effectiveDiscount.code})` : ''}</span>
              <span className="font-mono">-£{totals.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-800 pt-2 text-lg font-black text-white">
            <span>Total</span>
            <span className="font-mono text-emerald-400">£{totals.grandTotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {(['card', 'cash', 'online', 'unpaid'] as SalePaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${
                  paymentMethod === m
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-neutral-700 bg-black text-neutral-400'
                }`}
              >
                {m === 'unpaid' ? 'On account' : m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={complete}
            disabled={lines.length === 0}
            className="pressable mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> Complete sale · £{totals.grandTotal.toFixed(2)}
          </button>

          {lastSale && (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-300">
              <div className="font-bold">{lastSale.saleNumber} completed</div>
              {lastSale.discount > 0 && (
                <div>
                  Discount {lastSale.discountCode} applied: -£{lastSale.discount.toFixed(2)}
                </div>
              )}
              <div>Total taken: £{lastSale.grandTotal.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Scanner — both members and discount codes route through here */}
      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCustomerScanned={(customer) => handleCustomer(customer)}
        onDiscountCodeScanned={(code) => applyDiscountCode(code)}
      />
    </div>
  );
};
