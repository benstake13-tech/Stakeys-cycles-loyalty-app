import React, { useEffect, useMemo, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Download,
  TrendingUp,
  ShoppingCart,
  Wrench,
  Store,
  Clock,
  Printer,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  buildFinancialLedger,
  summarizeLedger,
  financialLedgerCsv,
  financialSummaryCsv,
  workshopPaymentLabel,
  formatPeriodLabel,
  type FinancialChannel,
  type FinancialLedgerRow,
  type PaymentState,
} from '../utils/financials';
import { StakeysLogo } from './StakeysLogo';

interface ShopOrder {
  id: string;
  customer_name: string;
  contact: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
  created_at: string;
}

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * One ledger across every place money comes in:
 *  - Till (counter sales processed at the workshop)
 *  - Workshop bookings (completed jobs with an invoice)
 *  - Online shop orders (click & collect from the website)
 *
 * Each row is tagged paid or unpaid (from the invoice / sale payment method),
 * split into net + VAT, and summarised so the figures can be handed to the
 * accountant or printed. Quotes and declined/unsigned work are excluded but
 * surfaced separately so nothing silently disappears from the totals.
 */
export const FinancialReportingTab: React.FC = () => {
  const { bookings, sales } = useShop();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ordersState, setOrdersState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [channel, setChannel] = useState<'all' | FinancialChannel>('all');
  const [payment, setPayment] = useState<'all' | PaymentState>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('id, customer_name, contact, total, items, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        console.warn('[FINANCIALS] Online orders unavailable:', error.message);
        setOrdersState('unavailable');
        return;
      }
      setOrders((data as ShopOrder[]) || []);
      setOrdersState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullLedger = useMemo(
    () => buildFinancialLedger({ sales, bookings, orders, start: startDate, end: endDate }),
    [sales, bookings, orders, startDate, endDate]
  );

  const ledger = useMemo(
    () =>
      fullLedger
        .filter((r) => channel === 'all' || r.channel === channel)
        .filter((r) => payment === 'all' || r.paymentState === payment),
    [fullLedger, channel, payment]
  );

  const totals = useMemo(() => summarizeLedger(ledger), [ledger]);
  const periodSummary = useMemo(() => summarizeLedger(fullLedger), [fullLedger]);

  const pendingQuotes = useMemo(
    () => (sales || []).filter((s) => s.status === 'quote' || s.status === 'approved'),
    [sales]
  );

  const download = (contents: string, filename: string) => {
    const blob = new Blob([contents], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () =>
    download(financialLedgerCsv(ledger), `financial_ledger_${startDate}_to_${endDate}.csv`);

  const handleExportSummary = () =>
    download(financialSummaryCsv(periodSummary), `financial_summary_${startDate}_to_${endDate}.csv`);

  const handlePrint = () => window.print();

  const paymentBadge = (row: FinancialLedgerRow) =>
    row.paymentState === 'paid' ? (
      <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 font-bold text-amber-400">
        <AlertCircle className="w-3.5 h-3.5" /> Unpaid
      </span>
    );

  // How the money was actually taken, so the printed report reads as a cash
  // book rather than a single headline number.
  const methodBreakdown = useMemo(() => {
    const acc: Record<string, { count: number; gross: number }> = {};
    ledger.forEach((r) => {
      const key = r.method || 'unpaid';
      if (!acc[key]) acc[key] = { count: 0, gross: 0 };
      acc[key].count += 1;
      acc[key].gross += r.total;
    });
    return Object.entries(acc)
      .map(([method, v]) => ({ method, count: v.count, gross: Math.round(v.gross * 100) / 100 }))
      .sort((a, b) => b.gross - a.gross);
  }, [ledger]);

  const methodLabel = (m: string) => {
    switch ((m || 'unpaid').toLowerCase()) {
      case 'unpaid':
        return 'Unpaid / on account';
      case 'card':
      case 'paid_card':
        return 'Card';
      case 'cash':
      case 'paid_cash':
        return 'Cash';
      case 'online':
      case 'paid_online':
        return 'Online';
      default:
        return workshopPaymentLabel(m);
    }
  };

  const channelMeta: Record<FinancialChannel, { label: string; icon: React.ReactNode; tone: string }> = {
    till: { label: 'Till', icon: <ShoppingCart className="w-4 h-4" />, tone: 'text-emerald-400' },
    workshop: { label: 'Workshop', icon: <Wrench className="w-4 h-4" />, tone: 'text-sky-400' },
    online: { label: 'Online', icon: <Store className="w-4 h-4" />, tone: 'text-amber-400' },
  };

  const periodLabel = formatPeriodLabel(startDate, endDate);
  const generatedAt = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  // The workshop is call-out-only, so the printed document carries the public
  // postcode only — never a customer's name, address or contact details.
  const BUSINESS = {
    name: "Stakey's Cycles",
    tagline: 'Bicycle & Scooter Workshop · Repairs, Servicing & Parts',
    location: 'Salford, Greater Manchester M6 6QS',
    phone: '+44 7388 209102',
    email: 'workshop@stakeyscycles.co.uk',
    vat: 'GB 892 1049 82',
  };

  const card = 'p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1';

  return (
    <div className="space-y-6">
      {/* Print-only branded letterhead. Screen chrome (filters, buttons) is
          dropped by the `no-print` rule; this is the reverse. */}
      <div className="print-only hidden">
        <div className="flex items-start justify-between gap-6 border-b-4 border-black pb-4">
          <div className="flex items-center gap-3">
            <StakeysLogo className="w-14 h-14" />
            <div>
              <div className="text-2xl font-black tracking-tight uppercase text-black">{BUSINESS.name}</div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-black">{BUSINESS.tagline}</div>
            </div>
          </div>
          <div className="text-right text-[11px] font-mono text-black leading-relaxed">
            <div>{BUSINESS.location}</div>
            <div>{BUSINESS.phone}</div>
            <div>{BUSINESS.email}</div>
            <div>VAT Reg: {BUSINESS.vat}</div>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-6">
          <div>
            <div className="text-xl font-black uppercase tracking-tight text-black">Financial Report</div>
            <div className="text-sm text-black">Income ledger &amp; tax summary</div>
          </div>
          <div className="text-right text-[11px] font-mono text-black leading-relaxed">
            <div>Period: {periodLabel}</div>
            <div>Generated: {generatedAt}</div>
            <div>Channel: {channel === 'all' ? 'All channels' : channelMeta[channel].label} · Payment: {payment === 'all' ? 'All' : payment}</div>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as 'all' | FinancialChannel)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs">
              <option value="all">All channels</option>
              <option value="till">Till</option>
              <option value="workshop">Workshop</option>
              <option value="online">Online shop</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">Payment</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value as 'all' | PaymentState)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs">
              <option value="all">All payments</option>
              <option value="paid">Paid only</option>
              <option value="unpaid">Unpaid only</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleExportSummary} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer">
            <Download className="w-4 h-4" /> Tax Summary
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase">Gross Income</div>
          <div className="text-xl font-bold text-[#05C147]">{money(totals.gross)}</div>
          <div className="text-[10px] text-neutral-500">{totals.count} transactions</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase">Net of VAT</div>
          <div className="text-xl font-bold text-white">{money(totals.net)}</div>
          <div className="text-[10px] text-neutral-500">excl. VAT</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase">VAT Collected</div>
          <div className="text-xl font-bold text-white">{money(totals.vat)}</div>
          <div className="text-[10px] text-neutral-500">to report &amp; pay</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${card} border-emerald-500/30`}>
          <div className="text-[10px] text-emerald-400 uppercase flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Paid</div>
          <div className="text-xl font-bold text-emerald-400">{money(totals.paid)}</div>
          <div className="text-[10px] text-neutral-500">{totals.count - totals.unpaidCount} settled transactions</div>
        </div>
        <div className={`${card} border-amber-500/30`}>
          <div className="text-[10px] text-amber-400 uppercase flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Outstanding</div>
          <div className="text-xl font-bold text-amber-400">{money(totals.unpaid)}</div>
          <div className="text-[10px] text-neutral-500">{totals.unpaidCount} awaiting payment</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#05C147]" /> Net Paid (excl. VAT)</div>
          <div className="text-xl font-bold text-white">{money(totals.netPaid)}</div>
          <div className="text-[10px] text-neutral-500">cash received basis</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['till', 'workshop', 'online'] as FinancialChannel[]).map((ch) => (
          <div key={ch} className={card}>
            <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1.5">
              <span className={channelMeta[ch].tone}>{channelMeta[ch].icon}</span> {channelMeta[ch].label}
            </div>
            <div className="text-xl font-bold text-white">{money(totals.byChannel[ch].gross)}</div>
            <div className="text-[10px] text-neutral-500">
              {ch === 'online' && ordersState === 'loading'
                ? 'Loading orders…'
                : ch === 'online' && ordersState === 'unavailable'
                ? 'Order table not set up'
                : `${totals.byChannel[ch].count} transactions · VAT ${money(totals.byChannel[ch].vat)}`}
              {totals.byChannel[ch].unpaid > 0 && (
                <span className="text-amber-400"> · {money(totals.byChannel[ch].unpaid)} unpaid</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {methodBreakdown.length > 0 && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-neutral-800 text-neutral-300">
            <TrendingUp className="w-4 h-4 text-[#05C147]" />
            <span className="text-xs font-bold uppercase tracking-wider">Takings by payment method</span>
            <span className="text-[10px] text-neutral-500 ml-auto">money received basis</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800">
            {methodBreakdown.map((m) => (
              <div key={m.method} className="p-4 bg-neutral-900 space-y-1">
                <div className="text-[10px] text-neutral-400 uppercase">{methodLabel(m.method)}</div>
                <div className="text-lg font-bold text-white">{money(m.gross)}</div>
                <div className="text-[10px] text-neutral-500">{m.count} transaction{m.count === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingQuotes.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {pendingQuotes.length} till {pendingQuotes.length === 1 ? 'quote is' : 'quotes are'} awaiting approval
            ({money(pendingQuotes.reduce((s, q) => s + q.grandTotal, 0))}). These are not counted as revenue until processed.
          </span>
        </div>
      )}

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-neutral-800 text-neutral-300">
          <TrendingUp className="w-4 h-4 text-[#05C147]" />
          <span className="text-xs font-bold uppercase tracking-wider">Income ledger</span>
          <span className="text-[10px] text-neutral-500 ml-auto">{startDate} → {endDate}</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-neutral-400 uppercase">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Date</th>
              <th className="p-3">Channel</th>
              <th className="p-3 no-print">Customer</th>
              <th className="p-3">Detail</th>
              <th className="p-3">Payment</th>
              <th className="p-3 text-right">Net</th>
              <th className="p-3 text-right">VAT</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {ledger.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-neutral-500">
                  <FileText className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No income recorded in this period.
                </td>
              </tr>
            )}
            {ledger.map((r) => (
              <tr key={`${r.channel}-${r.id}`} className="text-neutral-300">
                <td className="p-3 font-mono">{r.id}</td>
                <td className="p-3">{r.date}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 font-bold ${channelMeta[r.channel].tone}`}>
                    {channelMeta[r.channel].icon} {channelMeta[r.channel].label}
                  </span>
                </td>
                <td className="p-3 no-print">{r.customer}</td>
                <td className="p-3 text-neutral-500">{r.detail}</td>
                <td className="p-3 whitespace-nowrap">
                  {paymentBadge(r)}
                  {r.channel === 'workshop' && r.method && (
                    <span className="block text-[10px] text-neutral-500">{workshopPaymentLabel(r.method)}</span>
                  )}
                </td>
                <td className="p-3 font-mono text-right">{money(r.net)}</td>
                <td className="p-3 font-mono text-right">{money(r.vat)}</td>
                <td className="p-3 font-mono text-[#05C147] text-right font-bold">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Print-only recap and notes: the paper copy must stand alone, so it
          repeats the headline figures and explains every term and exclusion. */}
      <div className="print-only hidden space-y-4">
        <div className="border-2 border-black">
          <div className="bg-black text-white print-solid px-3 py-2 text-xs font-black uppercase tracking-widest">
            Period totals
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-2 font-bold">Gross income (VAT inclusive)</td>
                <td className="p-2 text-right font-mono">{money(totals.gross)}</td>
                <td className="p-2 font-bold border-l border-black">Transactions</td>
                <td className="p-2 text-right font-mono">{totals.count}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2">Net of VAT</td>
                <td className="p-2 text-right font-mono">{money(totals.net)}</td>
                <td className="p-2 border-l border-black">Paid</td>
                <td className="p-2 text-right font-mono">{money(totals.paid)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-2">VAT collected</td>
                <td className="p-2 text-right font-mono">{money(totals.vat)}</td>
                <td className="p-2 border-l border-black">Outstanding ({totals.unpaidCount})</td>
                <td className="p-2 text-right font-mono">{money(totals.unpaid)}</td>
              </tr>
              <tr>
                <td className="p-2">Net paid (cash received basis)</td>
                <td className="p-2 text-right font-mono">{money(totals.netPaid)}</td>
                <td className="p-2 border-l border-black">&nbsp;</td>
                <td className="p-2">&nbsp;</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="border border-black">
            <div className="px-2 py-1 font-black uppercase tracking-wider border-b border-black">By channel</div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase">
                  <th className="p-1.5">Channel</th>
                  <th className="p-1.5 text-right">Gross</th>
                  <th className="p-1.5 text-right">VAT</th>
                  <th className="p-1.5 text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {(['till', 'workshop', 'online'] as FinancialChannel[]).map((ch) => (
                  <tr key={ch} className="border-b border-black/40">
                    <td className="p-1.5">{channelMeta[ch].label}</td>
                    <td className="p-1.5 text-right font-mono">{money(totals.byChannel[ch].gross)}</td>
                    <td className="p-1.5 text-right font-mono">{money(totals.byChannel[ch].vat)}</td>
                    <td className="p-1.5 text-right font-mono">{money(totals.byChannel[ch].unpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-black">
            <div className="px-2 py-1 font-black uppercase tracking-wider border-b border-black">By payment method</div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase">
                  <th className="p-1.5">Method</th>
                  <th className="p-1.5 text-right">Gross</th>
                  <th className="p-1.5 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {methodBreakdown.length === 0 && (
                  <tr>
                    <td className="p-1.5" colSpan={3}>No takings in this period.</td>
                  </tr>
                )}
                {methodBreakdown.map((m) => (
                  <tr key={m.method} className="border-b border-black/40">
                    <td className="p-1.5">{methodLabel(m.method)}</td>
                    <td className="p-1.5 text-right font-mono">{money(m.gross)}</td>
                    <td className="p-1.5 text-right font-mono">{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-black p-3 text-[10px] leading-relaxed">
          <div className="font-black uppercase tracking-wider mb-1">Notes &amp; basis of preparation</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Figures cover the period <strong>{periodLabel}</strong> ({startDate} to {endDate}) and the filters shown above.</li>
            <li>Counted when the work or sale is completed: till sales marked completed, workshop jobs with a signed-off invoice, and placed online shop orders. Quotes, declined and unsigned work are excluded.</li>
            <li>Paid means settled at the time of the sale; outstanding is invoiced or sold on account and still to be collected.</li>
            <li>VAT is taken from the stored amount where present, otherwise derived from the sale rate. Net = gross − VAT.</li>
            {pendingQuotes.length > 0 && (
              <li>{pendingQuotes.length} till {pendingQuotes.length === 1 ? 'quote is' : 'quotes are'} awaiting approval ({money(pendingQuotes.reduce((s, q) => s + q.grandTotal, 0))}) and is not included above.</li>
            )}
            <li>This printed copy is anonymised — customer names, addresses and contact details appear only in the CSV export, never on paper.</li>
          </ul>
        </div>

        <div className="border-t-2 border-black pt-2 flex items-center justify-between text-[10px] font-mono">
          <span>{BUSINESS.name} · {BUSINESS.location} · VAT {BUSINESS.vat}</span>
          <span>Generated {generatedAt} · Page report</span>
        </div>
      </div>
    </div>
  );
};
