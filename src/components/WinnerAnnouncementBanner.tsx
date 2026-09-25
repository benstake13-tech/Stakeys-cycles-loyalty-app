import React from 'react';
import { Trophy, Sparkles, X } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import confetti from 'canvas-confetti';

export const WinnerAnnouncementBanner: React.FC = () => {
  const { latestAnnouncement, dismissAnnouncement } = useShop();

  if (!latestAnnouncement) return null;

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.2 },
        colors: ['#05C147', '#10b981', '#34d399', '#ffffff'],
      });
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative overflow-hidden bg-[#0c1117] text-neutral-100 px-4 py-2.5 sm:py-3 border-b border-emerald-500/30 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 relative z-10">
        {/* Left: Trophy & Announcement */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-emerald-400">Prize Draw Broadcast</span>
              <span aria-hidden="true">·</span>
              <span>{latestAnnouncement.drawTitle}</span>
            </div>

            <div className="text-xs sm:text-sm text-neutral-200 mt-0.5">
              Congratulations <span className="font-bold text-white">{latestAnnouncement.winnerName}</span>{' '}
              <span className="text-xs text-neutral-400 font-mono">
                ({latestAnnouncement.winnerMembershipNumber || 'Member'})
              </span>
              ! Won:{' '}
              <span className="text-emerald-400 font-medium">
                {latestAnnouncement.prizeDescription}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            type="button"
            onClick={triggerCelebration}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Celebrate winner"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Celebrate</span>
          </button>

          <button
            type="button"
            onClick={dismissAnnouncement}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss announcement"
            aria-label="Dismiss announcement"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

