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
  type FinancialChannel,
  type FinancialLedgerRow,
  type PaymentState,
} from '../utils/financials';

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

  const channelMeta: Record<FinancialChannel, { label: string; icon: React.ReactNode; tone: string }> = {
    till: { label: 'Till', icon: <ShoppingCart className="w-4 h-4" />, tone: 'text-emerald-400' },
    workshop: { label: 'Workshop', icon: <Wrench className="w-4 h-4" />, tone: 'text-sky-400' },
    online: { label: 'Online', icon: <Store className="w-4 h-4" />, tone: 'text-amber-400' },
  };

  const card = 'p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1';

  return (
    <div className="space-y-6">
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
              <th className="p-3">Customer</th>
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
                <td className="p-3">{r.customer}</td>
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
    </div>
  );
};
