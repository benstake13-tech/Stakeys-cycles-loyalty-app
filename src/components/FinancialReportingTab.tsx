import React, { useEffect, useMemo, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { supabase } from '../lib/supabase';
import { FileText, Download, TrendingUp, ShoppingCart, Wrench, Store, Clock } from 'lucide-react';

interface ShopOrder {
  id: string;
  customer_name: string;
  contact: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
  created_at: string;
}

type Channel = 'till' | 'workshop' | 'online';

interface LedgerRow {
  id: string;
  date: string;
  channel: Channel;
  customer: string;
  detail: string;
  total: number;
}

const inRange = (date: string, start: string, end: string) => {
  const d = (date || '').slice(0, 10);
  return d >= start && d <= end;
};

const toDate = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'seconds' in (value as Record<string, unknown>)) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return '';
};

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * One ledger across every place money comes in:
 *  - Till (counter sales processed at the workshop)
 *  - Workshop bookings (completed jobs with an invoice)
 *  - Online shop orders (click & collect from the website)
 *
 * Figures are cash-in only: quotes and declined/unsigned work are excluded but
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
  const [channel, setChannel] = useState<'all' | Channel>('all');

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

  const tillRows = useMemo<LedgerRow[]>(
    () =>
      (sales || [])
        .filter((s) => s.status === 'completed' || s.status === undefined)
        .filter((s) => inRange(toDate(s.createdAt), startDate, endDate))
        .map((s) => ({
          id: s.saleNumber || s.id,
          date: toDate(s.createdAt).slice(0, 10),
          channel: 'till' as const,
          customer: s.customerName,
          detail: `${s.items.length} item${s.items.length === 1 ? '' : 's'}${s.discount > 0 ? ` · discount −${money(s.discount)}` : ''}`,
          total: s.grandTotal,
        })),
    [sales, startDate, endDate]
  );

  const workshopRows = useMemo<LedgerRow[]>(
    () =>
      (bookings || [])
        .filter((b) => b.status === 'completed' && b.invoice)
        .filter((b) => inRange(b.preferredDate || toDate(b.invoice?.completedAt), startDate, endDate))
        .map((b) => ({
          id: b.invoice!.invoiceNumber || b.id,
          date: (b.preferredDate || toDate(b.invoice?.completedAt)).slice(0, 10),
          channel: 'workshop' as const,
          customer: b.customerName,
          detail: `${b.serviceTitle} · ${b.vehicleModel}`,
          total: b.invoice!.grandTotal,
        })),
    [bookings, startDate, endDate]
  );

  const onlineRows = useMemo<LedgerRow[]>(
    () =>
      orders
        .filter((o) => inRange(o.created_at, startDate, endDate))
        .map((o) => ({
          id: `WEB-${o.id.slice(0, 6).toUpperCase()}`,
          date: o.created_at.slice(0, 10),
          channel: 'online' as const,
          customer: o.customer_name,
          detail: `${(o.items || []).length} item${(o.items || []).length === 1 ? '' : 's'} · click & collect`,
          total: Number(o.total) || 0,
        })),
    [orders, startDate, endDate]
  );

  const ledger = useMemo(() => {
    const all = [...tillRows, ...workshopRows, ...onlineRows];
    return all
      .filter((r) => channel === 'all' || r.channel === channel)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [tillRows, workshopRows, onlineRows, channel]);

  const totals = useMemo(
    () =>
      ledger.reduce(
        (acc, r) => {
          acc.total += r.total;
          acc[r.channel] += r.total;
          return acc;
        },
        { total: 0, till: 0, workshop: 0, online: 0 }
      ),
    [ledger]
  );

  const pendingQuotes = useMemo(
    () => (sales || []).filter((s) => s.status === 'quote' || s.status === 'approved'),
    [sales]
  );

  const handleExportCSV = () => {
    const headers = ['Reference', 'Date', 'Channel', 'Customer', 'Detail', 'Total'];
    const rows = ledger.map((r) => [r.id, r.date, r.channel, r.customer, r.detail, r.total.toFixed(2)]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_report_${startDate}_to_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const channelMeta: Record<Channel, { label: string; icon: React.ReactNode; tone: string }> = {
    till: { label: 'Till', icon: <ShoppingCart className="w-4 h-4" />, tone: 'text-emerald-400' },
    workshop: { label: 'Workshop', icon: <Wrench className="w-4 h-4" />, tone: 'text-sky-400' },
    online: { label: 'Online', icon: <Store className="w-4 h-4" />, tone: 'text-amber-400' },
  };

  const card = 'p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
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
            <select value={channel} onChange={(e) => setChannel(e.target.value as 'all' | Channel)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs">
              <option value="all">All channels</option>
              <option value="till">Till</option>
              <option value="workshop">Workshop</option>
              <option value="online">Online shop</option>
            </select>
          </div>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase">Grand Total</div>
          <div className="text-xl font-bold text-[#05C147]">{money(totals.total)}</div>
          <div className="text-[10px] text-neutral-500">{ledger.length} transactions</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5 text-emerald-400" /> Till</div>
          <div className="text-xl font-bold text-white">{money(totals.till)}</div>
          <div className="text-[10px] text-neutral-500">{tillRows.length} counter sales</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-sky-400" /> Workshop</div>
          <div className="text-xl font-bold text-white">{money(totals.workshop)}</div>
          <div className="text-[10px] text-neutral-500">{workshopRows.length} completed jobs</div>
        </div>
        <div className={card}>
          <div className="text-[10px] text-neutral-400 uppercase flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-amber-400" /> Online Shop</div>
          <div className="text-xl font-bold text-white">{money(totals.online)}</div>
          <div className="text-[10px] text-neutral-500">
            {ordersState === 'loading' ? 'Loading orders…' : ordersState === 'unavailable' ? 'Order table not set up' : `${onlineRows.length} web orders`}
          </div>
        </div>
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
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {ledger.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">
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
                <td className="p-3 font-mono text-[#05C147] text-right">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
