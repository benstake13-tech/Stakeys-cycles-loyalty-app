import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ArrowUpRight, CalendarDays, CheckCircle2, CircleDot, Users } from 'lucide-react';
import { useShop } from '../context/ShopContext';

/** This exact dashboard ships in the staff website and staff Android APK. */
export const AdminDashboard: React.FC = () => {
  const { bookings, users } = useShop();

  const metrics = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const recentBookings = bookings.filter((item) => {
      const date = new Date(item.createdAt);
      return Number.isFinite(date.getTime()) && date >= start;
    });
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
      return { label: day.toLocaleDateString('en-GB', { weekday: 'short' }), date: day.toDateString() };
    });
    const customerAccounts = users.filter((user) => user.role === 'customer');
    const activeCustomers = customerAccounts.filter((user) => (user.stamps || 0) > 0).length;
    const pendingBookings = bookings.filter((booking) => booking.status === 'pending' || booking.approvalStatus === 'pending_approval').length;

    return {
      dailyData: days.map((day) => ({
        name: day.label,
        count: recentBookings.filter((booking) => new Date(booking.createdAt).toDateString() === day.date).length,
      })),
      weeklyBookings: recentBookings.length,
      pendingBookings,
      totalCustomers: customerAccounts.length,
      activeCustomers,
      engagement: customerAccounts.length > 0 ? Math.round(activeCustomers / customerAccounts.length * 100) : 0,
    };
  }, [bookings, users]);

  const summaries = [
    { title: 'Workshop requests', value: metrics.weeklyBookings, subtitle: 'Added in the last seven days', icon: CalendarDays },
    { title: 'Awaiting attention', value: metrics.pendingBookings, subtitle: 'Bookings to review', icon: Activity },
    { title: 'Loyalty members', value: metrics.totalCustomers, subtitle: 'Registered customer accounts', icon: Users },
  ];

  return (
    <section aria-label="Workshop operations dashboard" className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-5">
        <div>
          <p className="atelier-eyebrow flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> WORKSHOP INTELLIGENCE</p>
          <h2 className="atelier-display text-[30px] sm:text-4xl text-white mt-2">The bigger picture.</h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-xl">Your riders, workshop demand and loyalty activity in one considered view.</p>
        </div>
        <div className="atelier-live" aria-label="Metrics calculated from app records">FROM APP RECORDS</div>
      </div>

      <div className="atelier-hero overflow-hidden text-white">
        <div className="p-6 sm:p-8 flex items-center justify-between gap-4 border-b border-white/10">
          <div>
            <p className="atelier-eyebrow text-emerald-100/60">OPERATIONAL SNAPSHOT</p>
            <h3 className="atelier-display text-2xl sm:text-[30px] mt-2">Everything in motion.</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-emerald-200/20 flex items-center justify-center text-emerald-100">
            <CircleDot className="w-6 h-6" />
          </div>
        </div>

        <div className="grid grid-cols-3">
          {summaries.map(({ title, value, subtitle, icon: Icon }) => (
            <div key={title} className="atelier-metric">
              <div className="flex items-start justify-between gap-2">
                <span className="atelier-metric-label leading-snug">{title}</span>
                <Icon className="w-4 h-4 text-emerald-200/65 hidden sm:block shrink-0" />
              </div>
              <div className="atelier-display mt-4 sm:mt-5 text-[34px] sm:text-5xl tabular-nums text-white">{value}</div>
              <div className="text-[10px] sm:text-xs text-emerald-100/60 mt-2 leading-snug">{subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="atelier-chart lg:col-span-8 p-5 sm:p-7 min-w-0">
          <div className="flex justify-between items-start gap-3 mb-6">
            <div>
              <p className="atelier-eyebrow">SEVEN-DAY PULSE</p>
              <h3 className="atelier-display text-xl sm:text-2xl text-white mt-2">Workshop activity</h3>
              <p className="text-xs text-neutral-400 mt-2">New repair bookings by day</p>
            </div>
            <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="h-[240px] sm:h-[280px] w-full" role="img" aria-label="Bar chart of seven days of workshop booking requests">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.dailyData} margin={{ top: 10, right: 8, left: -26, bottom: 2 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 7" stroke="#2a3a35" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#a2b5ac" fontSize={11} dy={7} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke="#a2b5ac" fontSize={11} />
                <Tooltip cursor={{ fill: 'rgba(55,227,151,.055)' }}
                  contentStyle={{ backgroundColor: '#11201c', border: '1px solid #39584a', borderRadius: '14px', color: '#fff', boxShadow: '0 18px 40px rgba(0,0,0,.25)' }}
                  labelStyle={{ color: '#fff' }} />
                <Bar dataKey="count" name="Bookings" radius={[9,9,2,2]} maxBarSize={60}>
                  {metrics.dailyData.map((item,index) => (
                    <Cell key={index} fill={item.count ? '#74e5ad' : '#2b4439'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="atelier-surface lg:col-span-4 p-6 sm:p-7 text-white flex flex-col justify-between gap-8">
          <div>
            <p className="atelier-eyebrow">CLUB HEALTH</p>
            <h3 className="atelier-display text-[24px] mt-2">Real riders.<br/>Real loyalty.</h3>
            <p className="mt-3 text-xs text-neutral-400 leading-relaxed">A clear view of how many registered members have earned at least one stamp.</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="h-48 w-48 rounded-full p-[12px] shadow-[0_15px_50px_-25px_rgba(67,225,149,.45)]"
              style={{ background: `conic-gradient(#79edb5 0% ${metrics.engagement}%, #2d4039 ${metrics.engagement}% 100%)` }}
              role="img" aria-label={`${metrics.engagement} percent of registered customers have loyalty stamps`}>
              <div className="w-full h-full rounded-full bg-[#141f1d] border border-emerald-200/10 flex flex-col justify-center items-center text-center">
                <span className="atelier-display text-[49px] leading-none">{metrics.engagement}<span className="text-xl text-emerald-300">%</span></span>
                <span className="text-[10px] text-neutral-400 uppercase tracking-[.12em] font-bold mt-2">Stamp earners</span>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.activeCustomers}</div>
              <div className="text-xs text-neutral-400 mt-1">Members with stamps</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </aside>
      </div>
    </section>
  );
};
