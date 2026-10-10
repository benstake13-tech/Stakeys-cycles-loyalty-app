/**
 * Financial reporting core.
 *
 * One ledger across every place money comes in — the till, the workshop and
 * the online shop — that separates money actually received from money still
 * owed, and summarises VAT so the figures can be handed straight to the
 * accountant (or printed).
 *
 * Everything here is pure so it can be unit-tested without a database. The
 * React reporting tab is a thin view over these helpers.
 */
import { roundMoney } from './discountService';

export type FinancialChannel = 'till' | 'workshop' | 'online';

export type PaymentState = 'paid' | 'unpaid';

export type WorkshopPaymentStatus = 'unpaid' | 'paid_card' | 'paid_cash' | 'paid_online';

export interface FinancialLedgerRow {
  id: string;
  /** Source record id (sale / booking / order), used to delete the row's record. */
  recordId?: string;
  date: string; // YYYY-MM-DD
  channel: FinancialChannel;
  customer: string;
  detail: string;
  /** Gross (VAT-inclusive) amount the customer owes/paid. */
  total: number;
  /** Net of VAT. */
  net: number;
  /** VAT component of `total`. */
  vat: number;
  paymentState: PaymentState;
  /** How it was paid, when known (e.g. 'cash', 'card', 'online', 'unpaid'). */
  method?: string;
}

export interface VatSummary {
  net: number;
  vat: number;
  gross: number;
}

export interface ChannelTotals {
  gross: number;
  net: number;
  vat: number;
  paid: number;
  unpaid: number;
  count: number;
}

export interface FinancialSummary {
  gross: number;
  net: number;
  vat: number;
  /** Money actually received in the period. */
  paid: number;
  /** Net (excl. VAT) of the money actually received. */
  netPaid: number;
  /** Money still owed in the period. */
  unpaid: number;
  count: number;
  /** How many of `count` are unpaid. */
  unpaidCount: number;
  byChannel: Record<FinancialChannel, ChannelTotals>;
}

/** Safely render any date-ish value (ISO string, Date, Firestore timestamp) as ISO. */
export const toIso = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'seconds' in (value as Record<string, unknown>)) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return '';
};

/** Inclusive date-range test on the YYYY-MM-DD slice. */
export const inRange = (date: string, start: string, end: string): boolean => {
  const d = (date || '').slice(0, 10);
  return d >= start && d <= end;
};

const parseIsoDay = (value: string): Date | null => {
  const [y, m, d] = (value || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
};

/** Human period label for a report, e.g. '1 – 31 October 2026'. */
export function formatPeriodLabel(start: string, end: string): string {
  const a = parseIsoDay(start);
  const b = parseIsoDay(end);
  if (!a || !b) return `${start} → ${end}`;
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  const full = (d: Date) => `${d.getUTCDate()} ${month(d)} ${d.getUTCFullYear()}`;
  if (start === end) return full(a);
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${month(b)} ${b.getUTCFullYear()}`;
  }
  return `${full(a)} – ${full(b)}`;
}

export const isPaidWorkshopStatus = (status?: WorkshopPaymentStatus | string): boolean =>
  status === 'paid_card' || status === 'paid_cash' || status === 'paid_online';

/** Human label for a workshop invoice payment status, e.g. 'Paid · Card'. */
export function workshopPaymentLabel(status?: WorkshopPaymentStatus | string): string {
  switch (status) {
    case 'paid_card':
      return 'Paid · Card';
    case 'paid_cash':
      return 'Paid · Cash';
    case 'paid_online':
      return 'Paid · Online';
    default:
      return 'Unpaid';
  }
}

interface TillSaleLike {
  id: string;
  saleNumber?: string;
  customerName: string;
  items?: unknown[];
  createdAt: unknown;
  status?: string;
  discount?: number;
  grandTotal: number;
  vatAmount?: number;
  paymentMethod?: string;
}

interface WorkshopBookingLike {
  id: string;
  customerName: string;
  serviceTitle: string;
  vehicleModel: string;
  status?: string;
  preferredDate?: string;
  invoice?: {
    invoiceNumber?: string;
    completedAt?: unknown;
    grandTotal: number;
    vatAmount?: number;
    paymentStatus?: string;
  };
}

interface OnlineOrderLike {
  id: string;
  customer_name: string;
  items?: { name: string; qty: number; price: number }[];
  total: number;
  created_at: string;
}

const money = (n: number) => roundMoney(Number(n) || 0);

/**
 * Split a gross amount into net + VAT given a VAT rate. A legacy row without a
 * stored VAT amount is derived from the rate so it is never silently missed.
 */
function splitVat(gross: number, vatRate: number | undefined, storedVat?: number): VatSummary {
  const g = money(gross);
  const vat =
    storedVat !== undefined && storedVat !== null
      ? money(storedVat)
      : roundMoney(g - g / (1 + (vatRate || 0)));
  return { gross: g, vat, net: money(g - vat) };
}

const onlineIsPaid = (order: OnlineOrderLike): boolean => {
  const record = order as unknown as Record<string, unknown>;
  for (const key of ['paid', 'is_paid', 'payment_status']) {
    const value = record[key];
    if (value === true) return true;
    if (typeof value === 'string' && isPaidWorkshopStatus(value)) return true;
  }
  // Until the shop takes payment online, a placed click & collect order is
  // settled when the customer collects.
  return true;
};

export interface BuildFinancialLedgerInput {
  sales?: TillSaleLike[];
  bookings?: WorkshopBookingLike[];
  orders?: OnlineOrderLike[];
  start: string;
  end: string;
}

/**
 * Build the payment-aware income ledger for a date range. Completed till sales
 * and workshop jobs count; quotes / declined / unsigned work is excluded.
 */
export function buildFinancialLedger({
  sales,
  bookings,
  orders,
  start,
  end,
}: BuildFinancialLedgerInput): FinancialLedgerRow[] {
  const rows: FinancialLedgerRow[] = [];

  (sales || [])
    .filter((s) => s.status === 'completed' || s.status === undefined)
    .filter((s) => inRange(toIso(s.createdAt), start, end))
    .forEach((s) => {
      const method = s.paymentMethod || 'unpaid';
      const paid = method !== 'unpaid';
      const split = splitVat(s.grandTotal, s.vatAmount !== undefined && s.grandTotal ? s.vatAmount / s.grandTotal : 0, s.vatAmount);
      rows.push({
        id: s.saleNumber || s.id,
        recordId: s.id,
        date: toIso(s.createdAt).slice(0, 10),
        channel: 'till',
        customer: s.customerName,
        detail: `${(s.items || []).length} item${(s.items || []).length === 1 ? '' : 's'}${s.discount ? ` · discount −£${money(s.discount).toFixed(2)}` : ''}`,
        total: split.gross,
        net: split.net,
        vat: split.vat,
        paymentState: paid ? 'paid' : 'unpaid',
        method,
      });
    });

  (bookings || [])
    .filter((b) => b.status === 'completed' && b.invoice)
    .filter((b) => inRange(b.preferredDate || toIso(b.invoice?.completedAt), start, end))
    .forEach((b) => {
      const invoice = b.invoice!;
      const paid = isPaidWorkshopStatus(invoice.paymentStatus);
      const split = splitVat(invoice.grandTotal, invoice.vatAmount !== undefined && invoice.grandTotal ? invoice.vatAmount / invoice.grandTotal : 0, invoice.vatAmount);
      rows.push({
        id: invoice.invoiceNumber || b.id,
        recordId: b.id,
        date: (b.preferredDate || toIso(invoice.completedAt)).slice(0, 10),
        channel: 'workshop',
        customer: b.customerName,
        detail: `${b.serviceTitle} · ${b.vehicleModel}`,
        total: split.gross,
        net: split.net,
        vat: split.vat,
        paymentState: paid ? 'paid' : 'unpaid',
        method: invoice.paymentStatus,
      });
    });

  (orders || [])
    .filter((o) => inRange(o.created_at, start, end))
    .forEach((o) => {
      const split = splitVat(o.total, 0);
      rows.push({
        id: `WEB-${o.id.slice(0, 6).toUpperCase()}`,
        recordId: o.id,
        date: o.created_at.slice(0, 10),
        channel: 'online',
        customer: o.customer_name,
        detail: `${(o.items || []).length} item${(o.items || []).length === 1 ? '' : 's'} · click & collect`,
        total: split.gross,
        net: split.net,
        vat: split.vat,
        paymentState: onlineIsPaid(o) ? 'paid' : 'unpaid',
        method: onlineIsPaid(o) ? 'online' : 'unpaid',
      });
    });

  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const emptyChannel = (): ChannelTotals => ({
  gross: 0,
  net: 0,
  vat: 0,
  paid: 0,
  unpaid: 0,
  count: 0,
});

/** Aggregate a ledger into headline figures + a per-channel breakdown. */
export function summarizeLedger(rows: FinancialLedgerRow[]): FinancialSummary {
  const byChannel: Record<FinancialChannel, ChannelTotals> = {
    till: emptyChannel(),
    workshop: emptyChannel(),
    online: emptyChannel(),
  };
  const summary: FinancialSummary = {
    gross: 0,
    net: 0,
    vat: 0,
    paid: 0,
    netPaid: 0,
    unpaid: 0,
    count: 0,
    unpaidCount: 0,
    byChannel,
  };

  rows.forEach((r) => {
    summary.gross = money(summary.gross + r.total);
    summary.net = money(summary.net + r.net);
    summary.vat = money(summary.vat + r.vat);
    summary.count += 1;
    if (r.paymentState === 'paid') {
      summary.paid = money(summary.paid + r.total);
      summary.netPaid = money(summary.netPaid + r.net);
    } else {
      summary.unpaid = money(summary.unpaid + r.total);
      summary.unpaidCount += 1;
    }

    const c = byChannel[r.channel];
    c.gross = money(c.gross + r.total);
    c.net = money(c.net + r.net);
    c.vat = money(c.vat + r.vat);
    c.count += 1;
    if (r.paymentState === 'paid') c.paid = money(c.paid + r.total);
    else c.unpaid = money(c.unpaid + r.total);
  });

  return summary;
}
