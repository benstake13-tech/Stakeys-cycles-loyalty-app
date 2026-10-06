import React, { useEffect, useMemo, useState } from 'react';
import {
  Scan,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Tag,
  UserCheck,
  BadgePercent,
  Ticket,
  Award,
  Sparkles,
  Check,
  AlertCircle,
  FileText,
  Clock,
  ThumbsUp,
  ThumbsDown,
  CreditCard,
  Send,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useWebsiteContent, updateWebsiteContent } from '../context/WebsiteContentStore';
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
import { normalizeScannedCode, resolveCustomer, membershipBalance, MembershipBalance } from '../utils/membershipCode';

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
    createSaleQuote,
    updateSaleQuote,
    approveSale,
    declineSale,
    processSale,
    redeemServiceVoucher,
    resolveScannedMember,
  } = useShop();

  const [lines, setLines] = useState<SaleLineItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  // Balances carried on the scanned pass, shown until the roster refreshes.
  const [scannedBalance, setScannedBalance] = useState<MembershipBalance | null>(null);
  const [discount, setDiscount] = useState<SaleDiscountState | null>(null);
  const [discountMessage, setDiscountMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [vatRate, setVatRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('card');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleTransaction | null>(null);

  // Live shop stock, so staff can sell a real product at the till and the
  // storefront quantity is decremented when the sale is processed.
  const webContent = useWebsiteContent();
  const stockProducts = webContent.products;

  const qtyInBasket = (productId: string) =>
    lines
      .filter((l) => l.productId === productId)
      .reduce((sum, l) => sum + l.quantity, 0);

  const addStockProduct = (product: (typeof stockProducts)[number]) => {
    const remaining = product.stock - qtyInBasket(product.id);
    if (remaining <= 0) {
      setDiscountMessage({ ok: false, text: `Only ${product.stock} × ${product.name} in stock.` });
      return;
    }
    const existing = lines.find((l) => l.productId === product.id);
    if (existing) {
      setLines((prev) =>
        prev.map((l) => (l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l))
      );
    } else {
      addLine({
        description: product.name,
        category: 'Part',
        quantity: 1,
        unitPrice: product.price,
        productId: product.id,
      });
    }
    setDiscountMessage(null);
  };

  // Quote workflow state — a till basket becomes a quote, and staff can reopen
  // that quote to edit/approve/process it. Mirrors the booking flow.
  const [activeQuote, setActiveQuote] = useState<SaleTransaction | null>(null);
  const [quoteNote, setQuoteNote] = useState('');
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuotePanel, setShowQuotePanel] = useState(false);

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
        .map((l) => {
          if (l.id !== id) return l;
          const next = Math.max(0, l.quantity + delta);
          // Never let the till oversell the shelf: cap stock-backed lines.
          if (delta > 0 && l.productId) {
            const product = stockProducts.find((p) => p.id === l.productId);
            const others = prev
              .filter((o) => o.id !== id && o.productId === l.productId)
              .reduce((sum, o) => sum + o.quantity, 0);
            if (product && others + next > product.stock) {
              setDiscountMessage({ ok: false, text: `Only ${product.stock} × ${product.name} in stock.` });
              return l;
            }
          }
          return { ...l, quantity: next };
        })
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
  const handleCustomer = (
    customer: UserProfile,
    opts?: { autoApply?: boolean; balance?: MembershipBalance }
  ) => {
    setSelectedCustomer(customer);
    setLastSale(null);
    setScannedBalance(opts?.balance ?? null);
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
  const handleScannedCode = async (raw: string) => {
    const clean = normalizeScannedCode(raw);
    // Prefer a server-backed member lookup so a barcode always attaches the sale
    // to the right account even if this till hasn't cached the customer yet.
    const member = await resolveScannedMember(raw);
    if (member) {
      handleCustomer(member);
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
    void handleScannedCode(manualCode.trim());
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
    setActiveQuote(null);
    setQuoteNote('');
    setShowQuotePanel(false);
  };

  /** Open quotes awaiting the customer's go-ahead (newest first). */
  const openQuotes = useMemo(
    () => sales.filter((s) => s.status === 'quote' || s.status === 'approved'),
    [sales]
  );

  /** Assemble the current basket into a sale record. */
  const buildSale = (extra: Partial<SaleTransaction> = {}): SaleTransaction => ({
    id: `sale-${Date.now()}`,
    saleNumber: '',
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
    discountSource: effectiveDiscount?.source,
    discountVoucherId: effectiveDiscount?.voucherId,
    grandTotal: totals.grandTotal,
    paymentMethod,
    staffUid: currentUser?.uid,
    staffName: currentUser?.displayName,
    createdAt: new Date(),
    ...extra,
  });

  /** Step 1: give the customer a quote — no payment taken yet. */
  const sendQuote = async () => {
    if (lines.length === 0) {
      setDiscountMessage({ ok: false, text: 'Add at least one item before quoting the customer.' });
      return;
    }
    setIsSendingQuote(true);
    try {
      const res = await createSaleQuote(buildSale({ quote: { amount: totals.grandTotal, note: quoteNote, sentAt: new Date() } }));
      if (res.sale) setActiveQuote(res.sale);
      setLastSale(res.sale || null);
      setDiscountMessage({ ok: res.success, text: res.message || '' });
      setLines([]);
      setSelectedCustomer(null);
      setDiscount(null);
      setQuoteNote('');
    } finally {
      setIsSendingQuote(false);
    }
  };

  /** Step 2: the customer is happy with the price. */
  const markApproved = async (sale: SaleTransaction) => {
    const res = await approveSale(sale.id);
    setActiveQuote((prev) => (prev && prev.id === sale.id ? { ...prev, status: 'approved' } : prev));
    setDiscountMessage({ ok: res.success, text: res.message || '' });
  };

  /** Reopen an existing quote to adjust the basket or price. */
  const loadQuoteIntoBasket = (sale: SaleTransaction) => {
    setLines(sale.items);
    setActiveQuote(sale);
    setSelectedCustomer(null);
    setDiscount(null);
    setVatRate(sale.vatRate || 0);
    setQuoteNote(sale.quote?.note || '');
    setShowQuotePanel(true);
    setDiscountMessage({ ok: true, text: `Editing quote ${sale.saleNumber} (£${sale.grandTotal.toFixed(2)}).` });
  };

  /** Adjust an existing quote's price to the current basket total. */
  const requote = async () => {
    if (!activeQuote) return;
    const res = await updateSaleQuote(activeQuote.id, { amount: totals.grandTotal, note: quoteNote });
    if (res.success) setActiveQuote({ ...activeQuote, grandTotal: totals.grandTotal, status: 'quote' });
    setDiscountMessage({ ok: res.success, text: res.message || '' });
  };

  /** Step 3: process — take payment and close the sale. */
  const process = async (sale: SaleTransaction) => {
    setIsProcessing(true);
    try {
      const res = await processSale(sale.id, paymentMethod);
      // Decrement live storefront stock for every product line sold, so the
      // shop and the till never disagree on what is actually on the shelf.
      if (res.success) {
        const soldByProduct = sale.items.reduce<Record<string, number>>((acc, l) => {
          if (l.productId) acc[l.productId] = (acc[l.productId] || 0) + l.quantity;
          return acc;
        }, {});
        if (Object.keys(soldByProduct).length > 0) {
          const products = webContent.products.map((p) =>
            soldByProduct[p.id] ? { ...p, stock: Math.max(0, p.stock - soldByProduct[p.id]) } : p
          );
          updateWebsiteContent({ products });
        }
      }
      if (res.success && sale.discountCode) {
        const voucherMatch = (selectedCustomer?.serviceVouchers || []).find(
          (v) => v.code === sale.discountCode && v.status === 'available'
        );
        if (voucherMatch && sale.customerId) {
          await redeemServiceVoucher(sale.customerId, sale.discountCode, currentUser?.uid);
        }
      }
      setDiscountMessage({ ok: res.success, text: res.message || '' });
      if (res.success) {
        setActiveQuote(null);
        setLastSale({ ...sale, status: 'completed', paymentMethod });
      }
    } finally {
      setIsProcessing(false);
    }
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

        {selectedCustomer && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-sky-200">
              <UserCheck className="w-3.5 h-3.5" />
              {selectedCustomer.displayName}
              <span className="font-mono font-normal text-sky-300/80">
                · {selectedCustomer.membershipNumber}
              </span>
            </span>
            {(() => {
              // Prefer the live profile; fall back to the balances on the scanned pass.
              const bal = membershipBalance(selectedCustomer);
              const shown = bal.stamps || bal.tickets || bal.points ? bal : scannedBalance;
              if (!shown) return null;
              return (
                <span className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 font-mono font-bold text-emerald-300">
                    <Award className="w-3 h-3" /> {shown.stamps}/10
                  </span>
                  <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 font-mono font-bold text-amber-300">
                    <Ticket className="w-3 h-3" /> {shown.tickets}
                  </span>
                  <span className="flex items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-0.5 font-mono font-bold text-sky-300">
                    <Sparkles className="w-3 h-3" /> {shown.points}
                  </span>
                </span>
              );
            })()}
          </div>
        )}

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

        {/* Live storefront stock — sell a real product so the shop stays accurate */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Shop stock ({stockProducts.length})
            </span>
            <span className="text-[10px] text-neutral-600">Selling decrements the storefront</span>
          </div>
          {stockProducts.length === 0 ? (
            <p className="py-4 text-center text-xs text-neutral-600">
              No products set up yet. Add them in Staff Station → Website → Shop &amp; Stock.
            </p>
          ) : (
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {stockProducts.map((p) => {
                const remaining = p.stock - qtyInBasket(p.id);
                const soldOut = remaining <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => addStockProduct(p)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs ${
                      soldOut
                        ? 'cursor-not-allowed border-neutral-900 bg-neutral-950 text-neutral-600'
                        : 'border-neutral-800 bg-black text-neutral-300 hover:border-emerald-500/40 hover:text-white'
                    }`}
                  >
                    <span className="min-w-0 pr-2">
                      <span className="block truncate">{p.name}</span>
                      <span className={`block text-[10px] ${soldOut ? 'text-rose-400' : 'text-neutral-500'}`}>
                        {soldOut ? 'Out of stock' : `${remaining} available`}
                      </span>
                    </span>
                    <span className="font-mono font-semibold text-emerald-400">£{p.price.toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
          )}
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

          {activeQuote ? (
            /* -------- ACTIVE QUOTE: approve then process -------- */
            <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <FileText className="w-3.5 h-3.5" /> {activeQuote.saleNumber}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  <Clock className="w-3 h-3" />
                  {activeQuote.status === 'approved' ? 'CUSTOMER ACCEPTED' : 'QUOTE SENT'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-amber-200/80">
                <span>{activeQuote.customerName}</span>
                <span className="font-mono font-black text-amber-300">£{activeQuote.grandTotal.toFixed(2)}</span>
              </div>

              {activeQuote.status !== 'approved' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => markApproved(activeQuote)}
                    className="pressable flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-neutral-950 hover:bg-emerald-400"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Customer happy
                  </button>
                  <button
                    type="button"
                    onClick={() => declineSale(activeQuote.id).then(() => setActiveQuote(null))}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-800 bg-rose-950/40 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-950/70"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Declined
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
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
                    onClick={() => process(activeQuote)}
                    disabled={isProcessing}
                    className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {isProcessing ? 'Processing…' : `Process sale · £${activeQuote.grandTotal.toFixed(2)}`}
                  </button>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLines(activeQuote.items)}
                  className="rounded-xl border border-neutral-700 py-2 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800"
                >
                  Edit basket
                </button>
                <button
                  type="button"
                  onClick={requote}
                  disabled={lines.length === 0}
                  className="rounded-xl border border-neutral-700 py-2 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
                >
                  Re-quote at £{totals.grandTotal.toFixed(2)}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuote(null)}
                className="w-full text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Start a new basket
              </button>
            </div>
          ) : (
            /* -------- NEW BASKET: quote it -------- */
            <>
              <textarea
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                rows={2}
                placeholder="Note to customer (optional) — e.g. 'Includes new inner tube and labour.'"
                className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 resize-none"
              />
              <button
                type="button"
                onClick={sendQuote}
                disabled={lines.length === 0 || isSendingQuote}
                className="pressable flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-black text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {isSendingQuote ? 'Sending quote…' : `Give quote · £${totals.grandTotal.toFixed(2)}`}
              </button>
              <p className="text-center text-[10px] text-neutral-500">
                Customer reviews the price first — no payment is taken until they accept.
              </p>
            </>
          )}

          {lastSale && !activeQuote && (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-[11px] text-emerald-300">
              <div className="font-bold">
                {lastSale.saleNumber} · £{lastSale.grandTotal.toFixed(2)} ·{' '}
                {lastSale.status === 'completed'
                  ? 'processed'
                  : lastSale.status === 'approved'
                  ? 'accepted — ready to process'
                  : 'quote sent'}
              </div>
              {lastSale.discount > 0 && (
                <div>Discount {lastSale.discountCode} applied: -£{lastSale.discount.toFixed(2)}</div>
              )}
            </div>
          )}
        </div>

        {/* Open quotes awaiting the customer's go-ahead */}
        {openQuotes.length > 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Open quotes ({openQuotes.length})
              </span>
              <button
                type="button"
                onClick={() => setShowQuotePanel((v) => !v)}
                className="text-[11px] text-sky-400 hover:text-sky-300"
              >
                {showQuotePanel ? 'Hide' : 'Show'}
              </button>
            </div>
            {showQuotePanel &&
              openQuotes.slice(0, 6).map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-black px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">
                      <span className="font-mono text-emerald-400">{q.saleNumber}</span> · {q.customerName}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {q.status === 'approved' ? 'Customer accepted' : 'Awaiting customer'} · £
                      {q.grandTotal.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {q.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => markApproved(q)}
                        title="Customer is happy with the price"
                        className="rounded-lg bg-emerald-500/90 p-1.5 text-neutral-950 hover:bg-emerald-400"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadQuoteIntoBasket(q)}
                      title="Reopen quote"
                      className="rounded-lg border border-neutral-700 p-1.5 text-neutral-300 hover:bg-neutral-800"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Scanner — both members and discount codes route through here */}
      <QRCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCustomerScanned={(customer, balance) => handleCustomer(customer, { balance })}
        onDiscountCodeScanned={(code) => applyDiscountCode(code)}
      />
    </div>
  );
};
