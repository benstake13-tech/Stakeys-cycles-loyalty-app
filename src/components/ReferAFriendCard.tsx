import React, { useEffect, useState } from 'react';
import { Gift, Copy, Check, Users, Share2 } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ShareMenu } from './ShareMenu';
import { PolicyDisclaimers } from './PolicyDisclaimers';
import { DISCOUNT_MIN_SPEND_DISCLAIMER } from '../utils/workshopPolicy';
import {
  REFERRER_REWARD,
  FRIEND_REWARD,
  buildReferralLink,
  describeFriendReward,
  describeReferrerReward,
} from '../utils/referral';
import { ReferralRecord } from '../types/bikeShop';
import toast from 'react-hot-toast';

interface ReferAFriendCardProps {
  /** Render on the dark customer app (default) or the light website. */
  isDark?: boolean;
  className?: string;
}

/**
 * "Refer a Friend" panel for a signed-in customer: their shareable code and
 * link, a share menu, the £5 / £15 reward rules and their referral history.
 */
export const ReferAFriendCard: React.FC<ReferAFriendCardProps> = ({ isDark = true, className = '' }) => {
  const { currentUser, ensureMyReferral, markReferralShared, referrals } = useShop();
  const [record, setRecord] = useState<ReferralRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void ensureMyReferral().then((r) => {
      if (!cancelled) setRecord(r);
    });
    return () => {
      cancelled = true;
    };
    // Re-run when the signed-in customer changes; ensureMyReferral is stable
    // enough for this purpose and creates the record once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Keep the shown record in sync with the store (rewards/referred friends).
  const liveRecord = record
    ? referrals.find((r) => r.id === record.id) || record
    : null;

  if (!currentUser) return null;

  const code = liveRecord?.code || '';
  const link = liveRecord?.link || (code ? buildReferralLink(code) : '');
  const rewardsEarned = liveRecord?.rewardsEarned || 0;
  const friends = liveRecord?.referredFriends || [];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      void markReferralShared(code);
    } catch {
      window.prompt('Copy your referral link:', link);
    }
  };

  const cardBg = isDark
    ? 'bg-gradient-to-br from-emerald-950/70 via-[#0d1e13] to-neutral-900 border-emerald-700/50'
    : 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 border-emerald-200';
  const heading = isDark ? 'text-white' : 'text-neutral-900';
  const sub = isDark ? 'text-emerald-100/80' : 'text-emerald-800/80';
  const codeBox = isDark
    ? 'bg-black/40 border-emerald-600/50 text-emerald-300'
    : 'bg-white border-emerald-300 text-emerald-700';

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${cardBg} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500 text-neutral-950 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
          <Gift className="w-6 h-6" />
        </div>
        <div>
          <h3 className={`font-display text-lg font-bold ${heading}`}>Refer a Friend</h3>
          <p className={`text-xs mt-0.5 leading-relaxed ${sub}`}>
            Share your code. Your friend gets <strong>£{FRIEND_REWARD} off a full service</strong>, and you earn a{' '}
            <strong>£{REFERRER_REWARD} credit</strong> once their booking is approved.
          </p>
        </div>
      </div>

      {/* Code + link */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`flex-1 rounded-xl border px-4 py-3 font-mono text-lg font-bold tracking-wider ${codeBox}`}>
            {code || 'Generating your code…'}
          </div>
          <button
            type="button"
            onClick={copyLink}
            disabled={!code}
            className="pressable px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[11px] font-mono truncate ${sub}`}>{link}</p>
          {code && (
            <ShareMenu
              isDark={isDark}
              title="Join Stakey's Cycles"
              text={`Use my referral code ${code} and get £${FRIEND_REWARD} off a full service at Stakey's Cycles!`}
              url={link}
              className="shrink-0"
            />
          )}
        </div>
      </div>

      {/* Reward rules */}
      <div className={`grid grid-cols-2 gap-2 text-center`}>
        <div className={`rounded-xl border p-3 ${isDark ? 'border-emerald-700/40 bg-black/20' : 'border-emerald-200 bg-white'}`}>
          <div className={`text-2xl font-black ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>£{REFERRER_REWARD}</div>
          <div className={`text-[10px] uppercase tracking-wide font-bold ${sub}`}>Your credit</div>
        </div>
        <div className={`rounded-xl border p-3 ${isDark ? 'border-emerald-700/40 bg-black/20' : 'border-emerald-200 bg-white'}`}>
          <div className={`text-2xl font-black ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>£{FRIEND_REWARD}</div>
          <div className={`text-[10px] uppercase tracking-wide font-bold ${sub}`}>Friend off full service</div>
        </div>
      </div>

      {/* Progress */}
      <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
        <Users className="w-4 h-4" />
        <span>
          {friends.length} friend{friends.length === 1 ? '' : 's'} referred · {rewardsEarned} reward
          {rewardsEarned === 1 ? '' : 's'} earned
        </span>
      </div>

      {friends.length > 0 && (
        <ul className={`space-y-1.5 text-xs ${sub}`}>
          {friends.slice(0, 5).map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.friendName || 'A friend'}</span>
              <span className={`shrink-0 font-bold ${f.rewardGranted ? 'text-emerald-400' : isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {f.rewardGranted ? `£${REFERRER_REWARD} earned` : 'Awaiting their booking'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <PolicyDisclaimers
        tone={isDark ? 'neutral' : 'neutral'}
        compact
        title="Offer terms"
        items={[
          DISCOUNT_MIN_SPEND_DISCLAIMER,
          `Your friend must be a new customer and book a full service to use ${describeFriendReward()}.`,
          `${describeReferrerReward()} is added once your friend's booking is approved. One reward per new customer.`,
        ]}
      />
    </div>
  );
};
