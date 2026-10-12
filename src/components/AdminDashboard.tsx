import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, ArrowUpRight, CalendarDays, CheckCircle2, Users } from 'lucide-react';
import { useShop } from '../context/ShopContext';

export const AdminDashboard: React.FC = () => {
  const { bookings, users } = useShop();

  const metrics = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const recentBookings = bookings.filter((booking) => {
      const date = new Date(booking.createdAt);
      return !Number.isNaN(date.getTime()) && date >= weekStart;
    });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index));
      return {
        label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: date.toDateString(),
      };
    });
    const dailyData = days.map((day) => ({
      name: day.label,
      count: recentBookings.filter((booking) => new Date(booking.createdAt).toDateString() === day.date).length,
    }));

    return {
      dailyData,
      weeklyBookings: recentBookings.length,
      pendingBookings: bookings.filter((booking) => booking.status === 'pending' || booking.approvalStatus === 'pending_approval').length,
      totalCustomers: users.filter((user) => user.role === 'customer').length,
      activeCustomers: users.filter((user) => user.role === 'customer' && (user.stamps || 0) > 0).length,
    };
  }, [bookings, users]);

  const summaries = [
    { title: 'New this week', value: metrics.weeklyBookings, subtitle: 'Workshop requests', icon: CalendarDays },
    { title: 'Needs attention', value: metrics.pendingBookings, subtitle: 'Pending requests', icon: Activity },
    { title: 'Loyalty members', value: metrics.totalCustomers, subtitle: `${metrics.activeCustomers} with earned stamps`, icon: Users },
  ];

  return (
    <section aria-label="Workshop overview" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="uppercase tracking-[0.2em] text-[10px] font-black text-emerald-400">Operations overview</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-1">Your workshop at a glance.</h2>
          <p className="text-sm text-neutral-400 mt-1">Bookings and loyalty activity, without the clutter.</p>
        </div>
        <div className="text-xs font-medium text-emerald-300 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 border border-emerald-500/20 self-start sm:self-auto">
          <CheckCircle2 className="h-4 w-4" /> Updated from app records
        </div>
      </div>

      <div className="rounded-[28px] overflow-hidden border border-white/10 bg-[#10161c] shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {summaries.map(({ title, value, subtitle, icon: Icon }) => (
            <div key={title} className="relative p-6 sm:p-7 group">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="uppercase text-[10px] font-black tracking-widest">{title}</span>
                <Icon className="w-4 h-4 text-emerald-400/80" />
              </div>
              <div className="font-display text-4xl font-black text-white mt-4 tabular-nums">{value}</div>
              <p className="text-xs text-neutral-400 mt-2">{subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#10161c] p-5 sm:p-7 shadow-xl">
        <div className="flex justify-between items-start gap-4 mb-7">
          <div>
            <div className="font-display font-bold text-xl text-white">Workshop activity</div>
            <p className="text-xs text-neutral-400 mt-1">New booking requests over the past seven days</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20"><ArrowUpRight className="h-4 w-4" /></div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.dailyData} margin={{ top: 6, right: 2, left: -24, bottom: 2 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 5" stroke="#2a343c" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#89949e" fontSize={11} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke="#89949e" fontSize={11} />
              <Tooltip cursor={{ fill: 'rgba(16,185,129,.06)' }}
                contentStyle={{ backgroundColor: '#0b1317', border: '1px solid #2d4540', borderRadius: '12px', color: '#fff' }}
                labelStyle={{ color: '#fff' }} />
              <Bar dataKey="count" name="Bookings" fill="#05C147" radius={[7, 7, 3, 3]} maxBarSize={62}>
                {metrics.dailyData.map((entry, index) => (
                  <Cell key={index} fill={entry.count ? '#36d793' : '#253b32'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
