import React, { useState, useMemo } from 'react';
import { Wheel } from 'react-custom-roulette';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Ticket,
  Clock,
  Edit3,
  Award,
  CheckCircle2,
  Lock,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import { PrizeWheel as PrizeWheelType, PrizeWheelSegment } from '../shared/types/bikeShop';
import { useShop } from '../shared/context/ShopContext';
import { checkSpinEligibility, pickWinningSegmentIndex } from '../shared/utils/prizeWheelHelper';
import { WheelEditorModal } from './WheelEditorModal';

interface PrizeWheelProps {
  wheel?: PrizeWheelType | null;
  onPrizeWon?: (segment: PrizeWheelSegment) => void;
  className?: string;
}

export const PrizeWheel: React.FC<PrizeWheelProps> = ({
  wheel: propWheel,
  onPrizeWon,
  className = '',
}) => {
  const { currentUser, activeWheel, updateWheel, awardPrizeToUser } = useShop();

  const currentWheel = propWheel || activeWheel;

  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [winningSegment, setWinningSegment] = useState<PrizeWheelSegment | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Check eligibility for the logged in user
  const eligibility = useMemo(() => {
    return checkSpinEligibility(currentUser, currentWheel);
  }, [currentUser, currentWheel]);

  if (!currentWheel || !currentWheel.segments || currentWheel.segments.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center text-neutral-400">
        <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-2 animate-bounce" />
        <p className="font-semibold text-white">No active Prize Wheel found.</p>
        <p className="text-xs text-neutral-500 mt-1">
          Create or activate a prize wheel in the Staff Terminal.
        </p>
      </div>
    );
  }

  // Format data for react-custom-roulette
  const rouletteData = useMemo(() => {
    return currentWheel.segments.map((seg) => {
      // Shorten label if too long for slice
      const shortLabel =
        seg.label.length > 20 ? `${seg.label.substring(0, 18)}…` : seg.label;
      return {
        option: shortLabel,
        style: {
          backgroundColor: seg.color || '#05C147',
          textColor: '#ffffff',
          fontSize: seg.label.length > 15 ? 11 : 13,
          fontWeight: 700,
        },
      };
    });
  }, [currentWheel.segments]);

  // Handle spin initiation
  const handleStartSpin = () => {
    if (mustSpin) return;
    if (!eligibility.canSpin) return;

    // Pick winning segment based on weighted probabilities
    const winningIdx = pickWinningSegmentIndex(currentWheel.segments);
    setPrizeNumber(winningIdx);
    setWinningSegment(currentWheel.segments[winningIdx]);
    setMustSpin(true);
    setShowCelebration(false);
  };

  // Handle spin completion
  const handleStopSpinning = () => {
    setMustSpin(false);
    setShowCelebration(true);

    const won = winningSegment || currentWheel.segments[prizeNumber];

    // Trigger celebratory confetti fireworks!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#05C147', '#eab308', '#0ea5e9', '#10b981', '#ec4899'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 250);
    } catch {
      // Confetti fallback
    }

    if (currentUser && won) {
      let extraTickets = 0;
      if (won.rewardType === 'ticket') {
        if (won.label.includes('3')) extraTickets = 3;
        else extraTickets = 1;
      }

      // Net tickets calculation: deduct cost and add won extra tickets
      const ticketCost = currentWheel.ticketCost ?? 1;
      const netTicketChange = extraTickets - ticketCost;

      // Award prize and update lastSpunAt timestamp for the 1-spin-per-week rate limit
      awardPrizeToUser(currentUser.uid, won.label, netTicketChange);
    }

    if (onPrizeWon && won) {
      onPrizeWon(won);
    }
  };

  const handleSaveWheelEdits = (updatedData: Partial<PrizeWheelType>) => {
    if (currentWheel) {
      updateWheel(currentWheel.id, updatedData);
    }
  };

  const ticketCost = currentWheel.ticketCost ?? 1;

  const isStaff = currentUser?.role === 'staff' || currentUser?.role === 'admin';

  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] ${className}`}
    >
      {/* Background glow effects */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Weekly Loyalty Reward</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
            {currentWheel.title}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              1 spin per week per rider
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-300 font-mono font-bold">
              <Ticket className="w-3.5 h-3.5 text-emerald-400" />
              {ticketCost} ticket{ticketCost > 1 ? 's' : ''} per spin
            </span>
          </div>
        </div>

        {/* Staff Only Wheel Editing */}
        {isStaff ? (
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Staff Only: Customize wheel slices, colors, probabilities & ticket cost"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Wheel (Staff)</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 font-medium">
            <Lock className="w-3.5 h-3.5 text-neutral-500" />
            <span>Configured by Stakey's Staff</span>
          </div>
        )}
      </div>

      {/* Main Wheel Arena */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 my-2">
        {/* Roulette Wheel Display */}
        <div className="relative flex items-center justify-center p-3 rounded-full bg-gradient-to-b from-neutral-800 to-neutral-950 border-4 border-emerald-500/30 shadow-2xl shadow-emerald-500/10">
          {/* Wheel Bezel Rim */}
          <div className="overflow-hidden flex items-center justify-center scale-90 sm:scale-100 transition-transform">
            <Wheel
              mustStartSpinning={mustSpin}
              prizeNumber={prizeNumber}
              data={rouletteData}
              onStopSpinning={handleStopSpinning}
              spinDuration={0.7}
              outerBorderColor="#eab308"
              outerBorderWidth={6}
              innerRadius={18}
              innerBorderColor="#171717"
              innerBorderWidth={6}
              radiusLineColor="#171717"
              radiusLineWidth={2}
              textDistance={58}
              perpendicularText={true}
            />
          </div>

          {/* Center Hub Bicycle Emblem Badge */}
          <div className="absolute pointer-events-none w-14 h-14 rounded-full bg-neutral-950 border-2 border-emerald-400 flex items-center justify-center shadow-lg text-emerald-400">
            <Zap className="w-6 h-6 fill-emerald-400" />
          </div>
        </div>

        {/* Right Status & Action Panel */}
        <div className="w-full lg:max-w-md space-y-4">
          {/* Rider's Current Balance & Cooldown Card */}
          <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-medium">My Draw Tickets:</span>
              <span className="font-mono font-black text-base text-emerald-400 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-emerald-500" />
                {currentUser?.tickets || 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-medium">Spin Ticket Cost:</span>
              <span className="font-mono font-bold text-white">
                {ticketCost} ticket{ticketCost > 1 ? 's' : ''}
              </span>
            </div>

            {/* Weekly Cooldown Status */}
            <div className="pt-3 border-t border-neutral-800/80">
              {eligibility.isWeeklyCooldownActive ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Weekly Cooldown Active
                    </span>
                    <span className="font-mono text-neutral-300 font-bold">
                      {eligibility.timeRemainingFormatted} left
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-tight">
                    Riders are limited to 1 spin per 7 days. Your next weekly spin opens on{' '}
                    <strong className="text-neutral-300">
                      {eligibility.nextEligibleDate?.toLocaleDateString()} at{' '}
                      {eligibility.nextEligibleDate?.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </strong>
                    .
                  </p>
                </div>
              ) : !eligibility.hasEnoughTickets ? (
                <div className="space-y-1">
                  <div className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Need More Tickets
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    You need {eligibility.ticketsNeeded} more ticket
                    {eligibility.ticketsNeeded > 1 ? 's' : ''} to spin. Fill your 10-stamp
                    loyalty card on in-store visits to earn tickets!
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Eligible to spin! Weekly spin ready and tickets available.</span>
                </div>
              )}
            </div>
          </div>

          {/* Spin Trigger Button */}
          <button
            onClick={handleStartSpin}
            disabled={!eligibility.canSpin || mustSpin}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
              eligibility.canSpin && !mustSpin
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 shadow-emerald-500/25 active:scale-95'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
            }`}
          >
            {mustSpin ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                <span>SPINNING FOR GLORY...</span>
              </>
            ) : !eligibility.hasEnoughTickets ? (
              <>
                <Lock className="w-4 h-4" />
                <span>INSUFFICIENT TICKETS ({currentUser?.tickets || 0}/{ticketCost})</span>
              </>
            ) : eligibility.isWeeklyCooldownActive ? (
              <>
                <Clock className="w-4 h-4" />
                <span>SPIN LOCKED ({eligibility.timeRemainingFormatted})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>SPIN WHEEL (-{ticketCost} TICKET{ticketCost > 1 ? 'S' : ''})</span>
              </>
            )}
          </button>

          {/* Celebration Winner Banner */}
          {showCelebration && winningSegment && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/40 text-xs animate-fade-in space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
                <Award className="w-4 h-4" />
                <span>Congratulations! You Won:</span>
              </div>
              <div className="text-lg font-black text-white">
                {winningSegment.label}
              </div>
              <p className="text-[11px] text-neutral-300">
                Reward applied to your account and recorded in your visit history! Your weekly
                spin resets in 7 days.
              </p>
            </div>
          )}

          {/* Live Segment Legend Preview */}
          <div className="pt-2">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Wheel Prizes & Slices
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {currentWheel.segments.map((seg, i) => (
                <div
                  key={seg.id || i}
                  className="flex items-center gap-2 bg-neutral-950/60 p-2 rounded-xl border border-neutral-800/80"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-neutral-300 truncate font-medium">
                    {seg.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editable Wheel Modal */}
      <WheelEditorModal
        wheel={currentWheel}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveWheelEdits}
      />
    </div>
  );
};
