import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Facebook,
  Instagram,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Tag,
  Wrench,
  Loader2,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { fetchMetaTimeline, MetaTimelineResult } from '../utils/businessInsights';
import {
  windowTotals,
  pctChange,
  campaignRoi,
  summarizeShop,
} from '../utils/performanceInsights';

const cardCls = 'bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl';

const fmt = (n: number | undefined | null): string => {
  if (n == null || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

const money = (n: number): string => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const shortDay = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const DeltaPill: React.FC<{ value: number | null }> = ({ value }) => {
  if (value == null) return <span className="text-[11px] text-neutral-500">—</span>;
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

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
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
  confirmed: 'Confirmed',
  approved: 'Approved',
  in_progress: 'In progress',
  ready_for_pickup: 'Ready',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/**
 * Business Stats — the detailed, charted view: Meta reach over time (Facebook +
 * Instagram), and the shop's own numbers (revenue, campaign ROI, top services,
 * booking pipeline) side by side so reach can be read against takings.
 */
export const BusinessStats: React.FC = () => {
  const { sales, bookings, discountCodes, promotions } = useShop();

  const [meta, setMeta] = useState<MetaTimelineResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchMetaTimeline();
    setMeta(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = meta?.timeline ?? [];
  const { current, previous } = useMemo(() => windowTotals(timeline, 28), [timeline]);

  const chartData = useMemo(
    () =>
      timeline.map((p) => ({
        day: shortDay(p.date),
        mediaViews: p.mediaViews,
        pageViews: p.pageViews,
        engagements: p.engagements,
        uniqueViewers: p.uniqueViewers,
        follows: p.follows,
      })),
    [timeline]
  );

  const roi = useMemo(() => campaignRoi(discountCodes, sales), [discountCodes, sales]);
  const shop = useMemo(() => summarizeShop(sales, bookings), [sales, bookings]);
  const activePromos = useMemo(
    () => promotions.filter((p) => p.status === 'active').length,
    [promotions]
  );

  return (
    <div className="space-y-6">
      {/* Meta reach */}
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-800">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">Reach &amp; Engagement</h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
                Daily Facebook Page activity and your linked Instagram audience, read from the
                server-side Meta token — no login required.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="pressable px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {!meta ? (
          <p className="text-xs text-neutral-500 mt-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading Meta data…
          </p>
        ) : !meta.connected ? (
          <p className="text-xs text-neutral-500 mt-4">{meta.message || 'Meta is not connected.'}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
              <StatCard
                icon={<Facebook className="w-4 h-4" />}
                label="Facebook Followers"
                value={fmt(meta.followers)}
                sub={meta.pageName}
                tone="text-blue-400"
              />
              <StatCard
                icon={<Instagram className="w-4 h-4" />}
                label="Instagram Followers"
                value={fmt(meta.igFollowers)}
                sub={meta.igUsername ? `@${meta.igUsername} · ${fmt(meta.igMediaCount)} posts` : 'No linked account'}
                tone="text-fuchsia-400"
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Media Views (28d)"
                value={fmt(current.mediaViews)}
                sub={`prev ${fmt(previous.mediaViews)}`}
                delta={pctChange(current.mediaViews, previous.mediaViews)}
              />
              <StatCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="Engagements (28d)"
                value={fmt(current.engagements)}
                sub={`prev ${fmt(previous.engagements)}`}
                delta={pctChange(current.engagements, previous.engagements)}
                tone="text-amber-400"
              />
            </div>

            {chartData.length === 0 ? (
              <p className="text-[11px] text-neutral-500 mt-4">{meta.message || 'No daily data returned.'}</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                <div>
                  <p className="text-xs font-bold text-neutral-300 mb-2">Views per day</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="mediaViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#05C147" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#05C147" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="pageViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis dataKey="day" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040' }} itemStyle={{ color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="mediaViews" name="Media Views" stroke="#05C147" fill="url(#mediaViews)" />
                        <Area type="monotone" dataKey="pageViews" name="Page Views" stroke="#38bdf8" fill="url(#pageViews)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-300 mb-2">Engagement &amp; unique viewers</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                        <XAxis dataKey="day" stroke="#666" fontSize={11} />
                        <YAxis stroke="#666" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040' }} itemStyle={{ color: '#fff' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="engagements" name="Engagements" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="uniqueViewers" name="Unique Viewers" stroke="#a78bfa" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="follows" name="Followers" stroke="#f472b6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Shop-side takings */}
      <div className={cardCls}>
        <div className="flex items-start gap-3 pb-4 border-b border-neutral-800">
          <Wallet className="w-6 h-6 text-emerald-500 shrink-0" />
          <div>
            <h3 className="text-lg font-bold text-white">Shop Performance</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Takings, campaign ROI and the workshop pipeline from your own till and booking data.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <StatCard icon={<Wallet className="w-4 h-4" />} label="Revenue (all-time)" value={money(shop.revenue)} sub={`${shop.salesCount} sales`} />
          <StatCard icon={<Receipt className="w-4 h-4" />} label="Average Order" value={money(shop.averageOrderValue)} tone="text-sky-400" />
          <StatCard icon={<Tag className="w-4 h-4" />} label="Discount Given" value={money(shop.discountTotal)} tone="text-amber-400" />
          <StatCard
            icon={<Wrench className="w-4 h-4" />}
            label="Bookings"
            value={String(shop.bookingsTotal)}
            sub={`${activePromos} active promotion(s)`}
            tone="text-violet-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Campaign ROI */}
          <div>
            <h4 className="text-sm font-bold text-neutral-200 mb-3">Campaign ROI</h4>
            {roi.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">No discount codes yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                      <th className="py-2 pr-3 font-bold">Code</th>
                      <th className="py-2 pr-3 font-bold">Used</th>
                      <th className="py-2 pr-3 font-bold">Revenue</th>
                      <th className="py-2 font-bold">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roi.slice(0, 8).map((r) => (
                      <tr key={r.code} className="border-b border-neutral-900 last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-mono text-white font-semibold">{r.code}</span>
                          <span className="block text-[10px] text-neutral-500">{r.title}</span>
                        </td>
                        <td className="py-2 pr-3 text-neutral-300 tabular-nums">
                          {r.timesUsed}
                          {r.usageLimit ? <span className="text-neutral-500">/{r.usageLimit}</span> : ''}
                        </td>
                        <td className="py-2 pr-3 text-emerald-300 tabular-nums font-semibold">{money(r.revenue)}</td>
                        <td className="py-2 text-amber-300 tabular-nums">{money(r.discountGiven)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Booking pipeline */}
          <div>
            <h4 className="text-sm font-bold text-neutral-200 mb-3">Booking pipeline</h4>
            {shop.bookingsByStatus.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">No bookings yet.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shop.bookingsByStatus.map((b) => ({ name: STATUS_LABEL[b.status] || b.status, count: b.count }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis type="number" stroke="#666" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#666" fontSize={11} width={90} />
                    <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#404040' }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="count" name="Bookings" fill="#05C147" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Top services */}
        <div className="mt-6">
          <h4 className="text-sm font-bold text-neutral-200 mb-3">Top services</h4>
          {shop.topServices.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">No service bookings yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {shop.topServices.map((s) => (
                <div key={s.title} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-neutral-200 truncate">{s.title}</span>
                  <span className="text-xs text-neutral-400 shrink-0 tabular-nums">
                    {s.count}× · {money(s.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessStats;
