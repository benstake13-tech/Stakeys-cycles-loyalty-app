import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  PhoneCall,
  Globe,
  Users,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BusinessPerformanceTab } from './BusinessPerformanceTab';
import {
  weeklyServiceRequests,
  callLog,
  summarizePerformance,
} from '../utils/performanceTracker';

const cardCls = 'bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl';

const DeltaPill: React.FC<{ value: number }> = ({ value }) => {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
        up
          ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
          : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
      }`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}
      {value}%
    </span>
  );
};

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
  tone?: string;
}> = ({ icon, label, value, sub, delta, tone = 'text-emerald-400' }) => (
  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
    <div className="flex items-center justify-between gap-2">
      <span className={`w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center ${tone}`}>
        {icon}
      </span>
      {delta !== undefined && <DeltaPill value={delta} />}
    </div>
    <p className="text-[11px] uppercase tracking-wider text-neutral-400 mt-3">{label}</p>
    <p className="text-2xl font-black text-white mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
  </div>
);

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/**
 * Performance Tracker — one place to see workshop demand (weekly service
 * requests), how customers reach the shop (online vs phone call logs) and the
 * reach/engagement pulled from Google & Meta. Replaces the standalone Growth tab.
 */
export const PerformanceTracker: React.FC = () => {
  const { bookings, users } = useShop();
  const [showGrowth, setShowGrowth] = useState(true);

  const week = useMemo(() => weeklyServiceRequests(bookings), [bookings]);
  const summary = useMemo(() => summarizePerformance(bookings), [bookings]);
  const calls = useMemo(() => callLog(bookings), [bookings]);

  const activeCustomers = useMemo(
    () => users.filter((u) => u.role === 'customer' && (u.stamps || 0) > 0).length,
    [users]
  );
  const totalCustomers = useMemo(() => users.filter((u) => u.role === 'customer').length, [users]);

  const chartData = week.map((d) => ({ name: d.name, online: d.online, phone: d.phone }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cardCls}>
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Gauge className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Performance Tracker</h2>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
              Workshop demand, how customers reach the shop, and your Google &amp; Meta reach — in one
              view. Weekly service requests are split by channel, and every phone booking is logged as
              a call.
            </p>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Service Requests (7d)"
            value={summary.requests7d}
            sub={`${summary.online7d} online · ${summary.phone7d} phone`}
            delta={summary.requestsDelta}
          />
          <KpiCard
            icon={<PhoneCall className="w-4 h-4" />}
            label="Calls Logged (7d)"
            value={summary.phone7d}
            sub={`${summary.callsLogged} all-time phone bookings`}
            delta={summary.phoneDelta}
            tone="text-sky-400"
          />
          <KpiCard
            icon={<Target className="w-4 h-4" />}
            label="Call → Work"
            value={`${summary.callConversionPct}%`}
            sub="phone calls approved or completed"
            tone="text-amber-400"
          />
          <KpiCard
            icon={<Users className="w-4 h-4" />}
            label="Active Riders"
            value={activeCustomers}
            sub={`${totalCustomers} members total`}
            tone="text-violet-400"
          />
        </div>
      </div>

      {/* Weekly requests + channel split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardCls} lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-sm font-bold text-neutral-200">Weekly Service Requests</h3>
            <div className="flex items-center gap-3 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Phone
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="name" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#404040' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="online" stackId="a" fill="#05C147" radius={[0, 0, 0, 0]} name="Online" />
                <Bar dataKey="phone" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Phone">
                  {chartData.map((entry, index) => (
                    <Cell key={`c-${index}`} fill="#38bdf8" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel breakdown */}
        <div className={cardCls}>
          <h3 className="text-sm font-bold text-neutral-200 mb-4">Channel Mix (7d)</h3>
          <div className="space-y-4">
            <ChannelBar
              icon={<Globe className="w-4 h-4 text-emerald-400" />}
              label="Online requests"
              count={summary.online7d}
              total={summary.requests7d}
              bar="bg-emerald-500"
            />
            <ChannelBar
              icon={<PhoneCall className="w-4 h-4 text-sky-400" />}
              label="Phone calls"
              count={summary.phone7d}
              total={summary.requests7d}
              bar="bg-sky-400"
            />
          </div>
          <div className="mt-5 pt-4 border-t border-neutral-800 text-xs text-neutral-400">
            <p>
              Last week: <span className="text-white font-semibold">{summary.requestsPrior7d}</span>{' '}
              requests
              {summary.requestsPrior7d > 0 && (
                <span className="ml-1">
                  ({summary.phonePrior7d} by phone)
                </span>
              )}
              .
            </p>
          </div>
        </div>
      </div>

      {/* Call log */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-sky-400" />
            Call Log
          </h3>
          <span className="text-[11px] text-neutral-500">{calls.length} phone booking(s)</span>
        </div>
        {calls.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">
            No phone bookings logged yet. Use Bookings → Phone to log a call.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                  <th className="py-2 pr-3 font-bold">Customer</th>
                  <th className="py-2 pr-3 font-bold">Phone</th>
                  <th className="py-2 pr-3 font-bold">Service</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 font-bold">Converted</th>
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 12).map((c) => (
                  <tr key={c.id} className="border-b border-neutral-900 last:border-0">
                    <td className="py-2 pr-3 text-white font-semibold">{c.customerName}</td>
                    <td className="py-2 pr-3 text-neutral-300 font-mono">{c.customerPhone}</td>
                    <td className="py-2 pr-3 text-neutral-300">{c.serviceTitle}</td>
                    <td className="py-2 pr-3 text-neutral-300">
                      {STATUS_LABEL[c.status] || c.status}
                    </td>
                    <td className="py-2">
                      {c.converted ? (
                        <span className="text-emerald-400 font-bold">Yes</span>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {calls.length > 12 && (
              <p className="text-[11px] text-neutral-500 mt-2">Showing the 12 most recent calls.</p>
            )}
          </div>
        )}
      </div>

      {/* Growth: Google & Meta */}
      <div className={cardCls}>
        <button
          type="button"
          onClick={() => setShowGrowth((s) => !s)}
          className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-neutral-200">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Growth — Google &amp; Meta
          </span>
          {showGrowth ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </button>
        {showGrowth && (
          <div className="mt-5">
            <BusinessPerformanceTab />
          </div>
        )}
      </div>
    </div>
  );
};

const ChannelBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  total: number;
  bar: string;
}> = ({ icon, label, count, total, bar }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-2 text-neutral-300 font-semibold">
          {icon}
          {label}
        </span>
        <span className="text-neutral-400">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default PerformanceTracker;
