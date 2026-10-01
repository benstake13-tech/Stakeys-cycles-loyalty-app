import React, { useState, useMemo } from 'react';
import { useShop } from '../context/ShopContext';
import { FileText, Download, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { ServiceBooking } from '../types/bikeShop';

export const FinancialReportingTab: React.FC = () => {
  const { bookings } = useShop();
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'completed' || !b.invoice) return false;
      const date = b.preferredDate; // Assuming preferredDate is in YYYY-MM-DD
      return date >= startDate && date <= endDate;
    });
  }, [bookings, startDate, endDate]);

  const totals = useMemo(() => {
    return filteredBookings.reduce(
      (acc, b) => {
        if (!b.invoice) return acc;
        acc.labour += b.invoice.labourSubtotal;
        acc.parts += b.invoice.partsSubtotal;
        acc.grandTotal += b.invoice.grandTotal;
        return acc;
      },
      { labour: 0, parts: 0, grandTotal: 0 }
    );
  }, [filteredBookings]);

  const handleExportCSV = () => {
    const headers = ['Booking ID', 'Date', 'Customer', 'Vehicle', 'Labour', 'Parts', 'Grand Total'];
    const rows = filteredBookings.map(b => [
      b.id,
      b.preferredDate,
      b.customerName,
      b.vehicleModel,
      b.invoice!.labourSubtotal.toFixed(2),
      b.invoice!.partsSubtotal.toFixed(2),
      b.invoice!.grandTotal.toFixed(2)
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_report_${startDate}_to_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] text-neutral-400 uppercase font-mono">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-2 py-1 text-xs" />
          </div>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 uppercase">Labour Revenue</div>
          <div className="text-xl font-bold text-white">£{totals.labour.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 uppercase">Parts Revenue</div>
          <div className="text-xl font-bold text-white">£{totals.parts.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-neutral-900 rounded-xl border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 uppercase">Grand Total</div>
          <div className="text-xl font-bold text-[#05C147]">£{totals.grandTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 text-neutral-400 uppercase">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filteredBookings.map(b => (
              <tr key={b.id} className="text-neutral-300">
                <td className="p-3 font-mono">#{b.id}</td>
                <td className="p-3">{b.preferredDate}</td>
                <td className="p-3">{b.customerName}</td>
                <td className="p-3 font-mono text-[#05C147]">£{b.invoice!.grandTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
