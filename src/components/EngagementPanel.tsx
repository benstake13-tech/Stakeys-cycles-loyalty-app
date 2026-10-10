import React, { useMemo } from 'react';
import { Users, Flame, UserPlus, UserMinus, Sparkles, Ticket, TrendingUp } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  memberActivity,
  featureUsage,
  mostEngagedMembers,
  promotionOverview,
} from '../utils/engagementTracker';

const cardCls = 'bg-[#0e1217] border border-neutral-800 rounded-3xl p-5 shadow-xl';

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string; tone?: string }> = ({
  icon,
  label,
  value,
  sub,
  tone = 'text-emerald-400',
}) => (
  <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4">
    <span className={`w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center ${tone}`}>
      {icon}
    </span>
    <p className="text-[11px] uppercase tracking-wider text-neutral-400 mt-3">{label}</p>
    <p className="text-2xl font-black text-white mt-0.5">{value}</p>
    {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
  </div>
);

/**
 * Engagement panel — member activity, which app features members actually use,
 * and how the shop's promotions/coupons are performing. Everything here is
 * derived from records the app already holds, so it adds no writes on login.
 */
export const EngagementPanel: React.FC = () => {
  const { users, stampLogs, bookings, draws, referrals, promotions, discountCodes } = useShop();

  const activity = useMemo(() => memberActivity(users), [users]);
  const features = useMemo(
    () => featureUsage({ users, stampLogs, bookings, draws, referrals }),
    [users, stampLogs, bookings, draws, referrals]
  );
  const engaged = useMemo(() => mostEngagedMembers(users, bookings, 5), [users, bookings]);
  const promo = useMemo(() => promotionOverview(promotions, discountCodes || []), [promotions, discountCodes]);

  const maxUsers = Math.max(1, ...features.map((f) => f.users));

  return (
    <div data-testid="engagement-panel" className="space-y-6">
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-neutral-200">Member Activity</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Users className="w-4 h-4" />} label="Members" value={activity.totalMembers} tone="text-violet-400" />
          <Stat
            icon={<Flame className="w-4 h-4" />}
            label="Active (30d)"
            value={activity.active30d}
            sub={`${activity.dormant30d} dormant`}
            tone="text-emerald-400"
          />
          <Stat icon={<UserPlus className="w-4 h-4" />} label="Joined (30d)" value={activity.joined30d} tone="text-sky-400" />
          <Stat
            icon={<UserMinus className="w-4 h-4" />}
            label="Never Visited"
            value={activity.neverVisited}
            sub="no stamps yet"
            tone="text-amber-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular features */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-neutral-200">Popular Features</h3>
          </div>
          <div className="space-y-3" data-testid="feature-usage">
            {features.map((f) => (
              <div key={f.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-300 font-semibold">{f.label}</span>
                  <span className="text-neutral-400">
                    {f.users} member{f.users === 1 ? '' : 's'} · {f.adoptionPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(f.users / maxUsers) * 100}%` }} />
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {f.events} {f.hint}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Promotion performance */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <Ticket className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-neutral-200">Promotion Performance</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-2">
              <p className="text-lg font-black text-white">{promo.active}</p>
              <p className="text-[10px] text-neutral-500">active</p>
            </div>
            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-2">
              <p className="text-lg font-black text-white">{promo.upcoming}</p>
              <p className="text-[10px] text-neutral-500">upcoming</p>
            </div>
            <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-2">
              <p className="text-lg font-black text-white">{promo.totalRedemptions}</p>
              <p className="text-[10px] text-neutral-500">redemptions</p>
            </div>
          </div>
          {promo.top ? (
            <div className="flex items-center gap-2 text-xs text-neutral-300">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Top code <span className="font-mono text-white">{promo.top.code}</span> — {promo.top.timesUsed} use
                {promo.top.timesUsed === 1 ? '' : 's'}
                {promo.top.redemptionPct != null ? ` (${promo.top.redemptionPct}% of limit)` : ''}
              </span>
            </div>
          ) : (
            <p className="text-xs text-neutral-500 italic">No coupon redemptions recorded yet.</p>
          )}
        </div>
      </div>

      {/* Most engaged members */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-neutral-200">Most Engaged Members</h3>
        </div>
        {engaged.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">No members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                  <th className="py-2 pr-3 font-bold">Member</th>
                  <th className="py-2 pr-3 font-bold">Membership</th>
                  <th className="py-2 pr-3 font-bold">Stamps</th>
                  <th className="py-2 pr-3 font-bold">Points</th>
                  <th className="py-2 font-bold">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {engaged.map((m) => (
                  <tr key={m.uid} className="border-b border-neutral-900 last:border-0">
                    <td className="py-2 pr-3 text-white font-semibold">{m.name}</td>
                    <td className="py-2 pr-3 text-neutral-400 font-mono">{m.membershipNumber}</td>
                    <td className="py-2 pr-3 text-neutral-300">{m.stamps}/10</td>
                    <td className="py-2 pr-3 text-neutral-300">{m.points}</td>
                    <td className="py-2 text-neutral-300">{m.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EngagementPanel;
