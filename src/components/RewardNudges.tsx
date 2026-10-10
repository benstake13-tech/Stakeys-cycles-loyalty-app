import React from 'react';
import { Bell, ArrowRight, Flame, AlertTriangle, Clock } from 'lucide-react';
import { UserProfile } from '../types/bikeShop';
import { buildRewardNudges, NudgeTarget, RewardNudge } from '../utils/rewardNudges';

interface RewardNudgesProps {
  user: UserProfile;
  /** Route a nudge's call-to-action to the relevant customer tab. */
  onNavigate: (target: NudgeTarget) => void;
}

const TONE: Record<RewardNudge['tone'], { wrap: string; icon: string; button: string; Icon: typeof Flame }> = {
  emerald: {
    wrap: 'from-emerald-950 via-[#0d1e13] to-neutral-900 border-emerald-500/60',
    icon: 'text-emerald-400',
    button: 'bg-[#05C147] hover:bg-emerald-400 text-neutral-950',
    Icon: Flame,
  },
  amber: {
    wrap: 'from-amber-950 via-[#1e1509] to-neutral-900 border-amber-500/60',
    icon: 'text-amber-400',
    button: 'bg-amber-400 hover:bg-amber-300 text-neutral-950',
    Icon: Clock,
  },
  rose: {
    wrap: 'from-rose-950 via-[#1e0b0f] to-neutral-900 border-rose-500/60',
    icon: 'text-rose-400',
    button: 'bg-rose-400 hover:bg-rose-300 text-neutral-950',
    Icon: AlertTriangle,
  },
};

/**
 * Compact proactive banner surfacing the customer's most urgent "almost there"
 * reward nudge. Renders nothing when there is nothing worth interrupting for.
 */
export const RewardNudges: React.FC<RewardNudgesProps> = ({ user, onNavigate }) => {
  const nudges = buildRewardNudges(user);
  if (nudges.length === 0) return null;

  const [top, ...rest] = nudges;
  const t = TONE[top.tone];

  return (
    <div className="space-y-2" data-testid="reward-nudges">
      <div className={`p-4 rounded-xl bg-gradient-to-r ${t.wrap} border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white`}>
        <div className="flex items-center gap-3">
          <t.Icon className={`w-5 h-5 shrink-0 ${t.icon}`} />
          <div>
            <span className="font-bold text-sm block flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" />
              {top.title}
            </span>
            <span className="text-xs text-neutral-300">{top.detail}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(top.target)}
          className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-md flex items-center gap-1.5 ${t.button}`}
        >
          {top.cta}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onNavigate(n.target)}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 text-neutral-300 hover:text-white cursor-pointer flex items-center gap-1.5"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${n.tone === 'amber' ? 'bg-amber-400' : n.tone === 'rose' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              {n.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RewardNudges;
