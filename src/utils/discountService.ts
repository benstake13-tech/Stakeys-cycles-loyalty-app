import {
  DiscountCode,
  SaleDiscountState,
  VehicleCategory,
  CollectedVoucher,
  ShopPromotion,
} from '../types/bikeShop';

/** Monetary rounding helper — keeps every £ figure to 2dp and never negative. */
export function roundMoney(n: number): number {
  const value = Number(n) || 0;
  // Exponential-shift trick avoids float artefacts like 1.005 * 100 === 100.4999...
  const rounded = Number(Math.round(Number(`${value}e2`)) + 'e-2');
  return Math.max(0, rounded);
}

export interface DiscountLine {
  category?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

export function lineTotal(line: DiscountLine): number {
  if (typeof line.total === 'number') return line.total;
  return roundMoney((line.quantity || 1) * (line.unitPrice || 0));
}

export interface DiscountEvaluation {
  ok: boolean;
  reason?: string;
  amountOff?: number;
}

/** Human-readable summary for a code, e.g. "10% off" or "£5.00 off". */
export function describeDiscountValue(type: DiscountCode['type'], value: number): string {
  return type === 'percent' ? `${value}% off` : `£${Number(value || 0).toFixed(2)} off`;
}

/**
 * Validates a discount code for a given basket / customer WITHOUT applying it.
 * Returns a reason string when the code cannot be used so the till can explain why.
 */
export function validateDiscountCode(
  code: DiscountCode | null | undefined,
  opts: {
    subtotal: number;
    lines?: DiscountLine[];
    customerUid?: string;
    customerMembership?: string;
    /** True when the basket belongs to a signed-in loyalty member. */
    isMember?: boolean;
    categories?: (VehicleCategory | string)[];
    now?: Date;
  }
): DiscountEvaluation {
  if (!code) return { ok: false, reason: 'Discount code not found.' };
  if (code.status === 'disabled') return { ok: false, reason: 'This code has been disabled.' };
  if (code.status === 'expired') return { ok: false, reason: 'This code has expired.' };

  // Member-only codes need a signed-in loyalty member. A code explicitly
  // assigned to someone already implies membership, so don't double-gate it.
  if (code.audience === 'member' && !code.assignedToUid && !opts.isMember) {
    return { ok: false, reason: 'This code is for loyalty members only — join or sign in to use it.' };
  }

  const now = opts.now || new Date();
  if (code.expiresAt) {
    const expiry = new Date(code.expiresAt);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime()) {
      return { ok: false, reason: 'This code has expired.' };
    }
  }

  if (code.assignedToUid) {
    const matches =
      (opts.customerUid && opts.customerUid === code.assignedToUid) ||
      (opts.customerMembership &&
        code.assignedToMembership &&
        opts.customerMembership.toUpperCase() === code.assignedToMembership.toUpperCase());
    if (!matches) {
      return {
        ok: false,
        reason: `This code is reserved for ${
          code.assignedToName || code.assignedToMembership || 'another member'
        }.`,
      };
    }
  }

  if (code.usageLimit && code.usageLimit > 0 && (code.timesUsed || 0) >= code.usageLimit) {
    return { ok: false, reason: 'This code has reached its usage limit.' };
  }

  const subtotal = roundMoney(opts.subtotal);
  if (code.minimumSpend && subtotal < code.minimumSpend) {
    return {
      ok: false,
      reason: `Requires a minimum spend of £${Number(code.minimumSpend).toFixed(2)} (basket is £${subtotal.toFixed(2)}).`,
    };
  }

  if (code.eligibleCategories && code.eligibleCategories.length > 0 && opts.categories) {
    const lowered = code.eligibleCategories.map((c) => String(c).toLowerCase());
    const anyEligible = opts.categories.some((c) => lowered.includes(String(c).toLowerCase()));
    if (!anyEligible) {
      return { ok: false, reason: 'This code does not apply to this kind of item.' };
    }
  }

  const amountOff = computeDiscountAmount(code, subtotal, opts.lines);
  if (amountOff <= 0) return { ok: false, reason: 'Nothing to discount on this basket.' };

  return { ok: true, amountOff };
}

/** Pure discount maths: percent applies to subtotal, fixed is capped at the subtotal. */
export function computeDiscountAmount(
  code: Pick<DiscountCode, 'type' | 'value'>,
  subtotal: number,
  _lines?: DiscountLine[]
): number {
  const base = roundMoney(subtotal);
  if (base <= 0) return 0;
  if (code.type === 'percent') {
    return roundMoney((base * (Number(code.value) || 0)) / 100);
  }
  return roundMoney(Math.min(Number(code.value) || 0, base));
}

/** Resolve a discount code string (case/format insensitive) against the catalogue. */
export function findDiscountCode(rawCode: string, codes: DiscountCode[]): DiscountCode | null {
  const clean = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!clean) return null;
  return (
    (codes || []).find(
      (c) => (c.code || '').toUpperCase().replace(/\s+/g, '') === clean
    ) || null
  );
}

/**
 * Turns a café/booking promotion code into a discount. Promotions carry either a
 * percentage or a flat amount and are treated as an open (unassigned) code.
 */
export function promotionToDiscountCode(promo: ShopPromotion): DiscountCode {
  const isPercent = !!(promo.discountPercentage && promo.discountPercentage > 0);
  return {
    id: `promo-${promo.id}`,
    code: promo.code,
    title: promo.title,
    description: promo.subtitle,
    type: isPercent ? 'percent' : 'fixed',
    value: isPercent ? promo.discountPercentage! : promo.discountAmount || 0,
    status: promo.status === 'active' ? 'active' : promo.status === 'expired' ? 'expired' : 'disabled',
    createdAt: new Date(),
    expiresAt: promo.endDate ? new Date(promo.endDate) : undefined,
    timesUsed: 0,
    usageLimit: 0,
    eligibleCategories: promo.eligibleCategories || [],
  };
}

/** Converts an unused service voucher into a spendable fixed discount. */
export function voucherToDiscountState(voucher: CollectedVoucher, subtotal: number): SaleDiscountState | null {
  const value = Number(voucher.value) || 0;
  if (value <= 0) return null;
  const amountOff = roundMoney(Math.min(value, roundMoney(subtotal)));
  if (amountOff <= 0) return null;
  return {
    code: voucher.code,
    label: voucher.title || 'Service credit',
    type: 'fixed',
    value,
    amountOff,
    source: 'voucher',
    voucherId: voucher.id,
  };
}

/** Combined basket total after a discount, never below zero. */
export function applyDiscountToTotal(subtotal: number, amountOff: number): number {
  return roundMoney(roundMoney(subtotal) - roundMoney(amountOff));
}

export interface SaleTotals {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  discount: number;
  grandTotal: number;
}

/** Full VAT-aware basket maths used by the till and counter sales. */
export function computeSaleTotals(
  lines: DiscountLine[],
  vatRate: number,
  discountAmount: number
): SaleTotals {
  const subtotal = roundMoney((lines || []).reduce((sum, l) => sum + lineTotal(l), 0));
  const vatAmount = roundMoney(subtotal * (vatRate || 0));
  const preDiscount = roundMoney(subtotal + vatAmount);
  const discount = roundMoney(Math.min(discountAmount || 0, preDiscount));
  const grandTotal = roundMoney(preDiscount - discount);
  return {
    subtotal,
    vatRate: vatRate || 0,
    vatAmount,
    discount,
    grandTotal,
  };
}
