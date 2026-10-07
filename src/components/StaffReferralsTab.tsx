import React, { useMemo, useState } from 'react';
import { Gift, Users, PoundSterling, Share2, Search, TrendingUp } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { REFERRER_REWARD, FRIEND_REWARD } from '../utils/referral';

/**
 * Staff-side overview of the Refer a Friend programme: how many codes exist,
 * how many friends have been referred, how many rewards have actually paid out
 * and which customers are the most active referrers.
 */
export const StaffReferralsTab: React.FC = () => {
  const { referrals, users } = useShop();
  const [query, setQuery] = useState('');

  const stats = useMemo(() => {
    const totalFriends = referrals.reduce((sum, r) => sum + (r.referredFriends?.length || 0), 0);
    const rewarded = referrals.reduce(
      (sum, r) => sum + (r.referredFriends || []).filter((f) => f.rewardGranted).length,
      0
    );
    const creditsPaid = rewarded * REFERRER_REWARD;
    const shares = referrals.reduce((sum, r) => sum + (r.timesShared || 0), 0);
    return { codes: referrals.length, totalFriends, rewarded, creditsPaid, shares };
  }, [referrals]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...referrals].sort(
      (a, b) => (b.referredFriends?.length || 0) - (a.referredFriends?.length || 0)
    );
    if (!q) return sorted;
    return sorted.filter((r) => {
      const owner = users.find((u) => u.uid === r.ownerUid);
      return (
        r.ownerName.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (owner?.membershipNumber || '').toLowerCase().includes(q)
      );
    });
  }, [referrals, query, users]);

  const statCards = [
    { label: 'Active codes', value: stats.codes, icon: Gift, tone: 'text-emerald-400' },
    { label: 'Friends referred', value: stats.totalFriends, icon: Users, tone: 'text-sky-400' },
    { label: 'Rewards paid', value: stats.rewarded, icon: TrendingUp, tone: 'text-amber-400' },
    { label: `Credits paid (£${REFERRER_REWARD} each)`, value: `£${stats.creditsPaid}`, icon: PoundSterling, tone: 'text-emerald-400' },
    { label: 'Links shared', value: stats.shares, icon: Share2, tone: 'text-neutral-300' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-400" />
          Refer a Friend
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Friends get £{FRIEND_REWARD} off a full service; the referrer earns a £{REFERRER_REWARD} credit once that booking is approved.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
            <s.icon className={`w-5 h-5 ${s.tone}`} />
            <div className="mt-2 text-2xl font-black text-white">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer name, code or member ID…"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-900/70 text-[10px] uppercase tracking-wider text-neutral-400">
                <th className="text-left px-4 py-3 font-bold">Customer</th>
                <th className="text-left px-4 py-3 font-bold">Code</th>
                <th className="text-right px-4 py-3 font-bold">Shared</th>
                <th className="text-right px-4 py-3 font-bold">Friends</th>
                <th className="text-right px-4 py-3 font-bold">Rewards paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500 text-xs">
                    No referral activity yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const owner = users.find((u) => u.uid === r.ownerUid);
                const paid = (r.referredFriends || []).filter((f) => f.rewardGranted).length;
                return (
                  <tr key={r.id} className="text-neutral-200">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.ownerName}</div>
                      <div className="text-[11px] text-neutral-500 font-mono">
                        {owner?.membershipNumber || r.ownerMembership || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300 text-xs">{r.code}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.timesShared || 0}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.referredFriends?.length || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={paid > 0 ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                        {paid > 0 ? `£${paid * REFERRER_REWARD}` : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
