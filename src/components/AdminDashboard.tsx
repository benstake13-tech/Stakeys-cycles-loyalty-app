import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useShop } from '../context/ShopContext';
import { ServiceBooking } from '../types/bikeShop';

export const AdminDashboard: React.FC = () => {
  const { bookings, users } = useShop();

  const metrics = useMemo(() => {
    // 1. Weekly Service Requests (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentBookings = bookings.filter(b => new Date(b.createdAt) >= sevenDaysAgo);
    
    // Group by day name
    const dailyData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({
      name: day,
      count: recentBookings.filter(b => {
        const d = new Date(b.createdAt);
        return d.toLocaleDateString('en-US', { weekday: 'short' }) === day;
      }).length
    }));

    // 2. Loyalty Stats
    const totalCustomers = users.filter(u => u.role === 'customer').length;
    const activeCustomers = users.filter(u => u.role === 'customer' && (u.stamps || 0) > 0).length;

    return { dailyData, totalCustomers, activeCustomers };
  }, [bookings, users]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Chart Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-neutral-200 mb-6">Weekly Service Requests</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#171717', borderColor: '#404040' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="count" fill="#05C147" radius={[4, 4, 0, 0]}>
                {metrics.dailyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#05C147' : '#262626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-center">
          <p className="text-neutral-400 text-xs mb-1">Total Customers</p>
          <p className="text-3xl font-bold text-white">{metrics.totalCustomers}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-center">
          <p className="text-neutral-400 text-xs mb-1">Active Loyalty Users</p>
          <p className="text-3xl font-bold text-emerald-400">{metrics.activeCustomers}</p>
        </div>
      </div>
    </div>
  );
};
