import React, { useState } from 'react';
import { Bike, Award, Sparkles, Check, Clock, Lock, ArrowRight, CheckCircle2, Wrench, Flame } from 'lucide-react';
import { UserProfile, CollectedVoucher } from '../types/bikeShop';
import { useShop } from '../context/ShopContext';
import { STAMPS_PER_CARD, stampEligibility, canStampToday } from '../utils/loyaltyCard';
import confetti from 'canvas-confetti';

interface StampCardProps {
  user: UserProfile;
  onApplyStamp?: () => void;
  isStaffMode?: boolean;
  onGoToBooking?: () => void;
}

export const StampCard: React.FC<StampCardProps> = ({
  user,
  onApplyStamp,
  isStaffMode = false,
  onGoToBooking,
}) => {
  const { collectFullCardReward } = useShop();
  const currentStamps = user.stamps || 0;
  const rateLimitStatus = stampEligibility(user.lastStampedAt);
  const eligibleToday = canStampToday(user.lastStampedAt);
  const slots = Array.from({ length: STAMPS_PER_CARD }, (_, i) => i + 1);

  const [isCollecting, setIsCollecting] = useState(false);
  const [justCollectedVoucher, setJustCollectedVoucher] = useState<CollectedVoucher | null>(null);

  const isFull = currentStamps >= STAMPS_PER_CARD;
  const progressPct = Math.min(100, Math.round((currentStamps / STAMPS_PER_CARD) * 100));

  const handleCollect = async () => {
    if (isCollecting) return;
    setIsCollecting(true);
    try {
      const res = await collectFullCardReward(user.uid);
      if (res.success && res.voucher) {
        setJustCollectedVoucher(res.voucher);
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#05C147', '#eab308', '#0284c7', '#ffffff'],
          });
        } catch {
          // confetti is decorative; never let it break the collection flow
        }
      }
    } finally {
      setIsCollecting(false);
    }
  };

  const vouchers = user.serviceVouchers || [];

  return (
    <div className="space-y-6">
      {/* 10-Stamp Card Main Box */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0d1015] p-6 sm:p-8 border border-neutral-800 shadow-2xl text-white">
        {/* Subtle architectural grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80">
          <div>
            {/* Zero-Pill Unboxed Metadata */}
            <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-1">
              <span className="text-emerald-400 font-semibold tracking-wider uppercase">
                Loyalty Pass
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>{user.membershipNumber}</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span>1 Visit Per Day</span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              10-Visit Stamp Journey
            </h2>
            <p className="text-xs text-neutral-300 mt-1 max-w-md">
              Collect {STAMPS_PER_CARD} stamps to unlock your <strong className="text-emerald-400 font-semibold">£40 service (labour only, parts not included)</strong> voucher!
            </p>
          </div>

          {/* Counter Metric */}
          <div className="flex items-center gap-3 bg-[#090b0e] px-4 py-2.5 rounded-xl border border-neutral-800 shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-neutral-400 font-medium">Stamps Earned</div>
              <div className="font-mono text-xl font-bold text-[#05C147] tabular-nums">
                {currentStamps} <span className="text-xs font-normal text-neutral-500">/ {STAMPS_PER_CARD}</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* REWARD COLLECT CALLOUT WHEN STAMPS FULL */}
        {isFull && (
          <div className="relative z-10 my-5 p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#0d1e13] to-neutral-950 border-2 border-[#05C147] shadow-[0_0_25px_rgba(5,193,71,0.2)] animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4 fill-emerald-400" />
                <span>{STAMPS_PER_CARD} Stamps Full · Ready to Collect!</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Eligible for £40 service (labour only, parts not included)
              </h3>
              <p className="text-xs text-neutral-300">
                Press collect to claim your voucher and start your next card.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCollect}
              disabled={isCollecting}
              className="px-5 py-3 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Award className="w-4 h-4 fill-neutral-950" />
              <span>{isCollecting ? 'Claiming...' : 'Press to Collect'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 10-Stamp Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 my-6">
          {slots.map((slotNum) => {
            const isStamped = slotNum <= Math.min(currentStamps, STAMPS_PER_CARD);
            const isTenth = slotNum === STAMPS_PER_CARD;

            return (
              <div
                key={slotNum}
                className={`relative rounded-xl p-3.5 flex flex-col items-center justify-center transition-all duration-300 min-h-[100px] border ${
                  isStamped
                    ? isTenth
                      ? 'bg-gradient-to-b from-emerald-500/25 to-emerald-600/10 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(5,193,71,0.2)]'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(5,193,71,0.1)]'
                    : isTenth
                    ? 'bg-neutral-900/60 border-dashed border-emerald-500/40 text-emerald-400/80 hover:border-emerald-400'
                    : 'bg-neutral-900/40 border-dashed border-neutral-800 text-neutral-500 hover:border-neutral-700'
                }`}
              >
                {/* Slot Index */}
                <span className="absolute top-2 left-2.5 font-mono text-[10px] text-neutral-500">
                  {slotNum.toString().padStart(2, '0')}
                </span>

                {/* Icon */}
                <div className="my-1.5 flex items-center justify-center">
                  {isStamped ? (
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-400">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : isTenth ? (
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
                      <Award className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-neutral-900/80 border border-neutral-800 flex items-center justify-center text-neutral-600">
                      <Bike className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <span className="text-[11px] font-medium text-center tracking-tight">
                  {isTenth ? (isStamped ? '£40 Service Ready!' : '£40 Service') : isStamped ? 'Verified' : 'Stamp'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="relative z-10 space-y-1.5">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Card Completion</span>
            <span className="font-mono tabular-nums text-emerald-400">{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#05C147] transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Daily Rate Limit & Action Footer */}
        <div className="relative z-10 mt-6 pt-5 border-t border-neutral-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            {eligibleToday ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Eligible for today's visit stamp. Present your barcode at counter.
              </span>
            ) : (
              <span className="text-neutral-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                Daily stamp logged today. Next stamp unlocks tomorrow.
              </span>
            )}
          </div>

          {isStaffMode && onApplyStamp ? (
            <button
              type="button"
              onClick={onApplyStamp}
              disabled={!rateLimitStatus.allowed}
              className={`w-full md:w-auto px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                rateLimitStatus.allowed
                  ? 'bg-[#05C147] hover:bg-emerald-400 text-neutral-950 shadow-md shadow-emerald-500/20 active:scale-95'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Staff: Add Visit Stamp (+1)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>Staff stamped at register</span>
            </div>
          )}
        </div>
      </div>

      {/* RECENTLY COLLECTED SUCCESS CARD */}
      {justCollectedVoucher && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-[#09150d] p-5 sm:p-6 space-y-3 animate-fade-in text-white">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-bold text-white text-base">
                Eligible for £40 service (labour only, parts not included)
              </h4>
              <p className="text-xs text-neutral-300">
                Voucher <span className="font-mono font-bold text-emerald-400">{justCollectedVoucher.code}</span> added to your profile!
              </p>
            </div>
          </div>
          {onGoToBooking && (
            <button
              type="button"
              onClick={onGoToBooking}
              className="mt-2 px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Book Service With This Voucher</span>
            </button>
          )}
        </div>
      )}

      {/* MY ACTIVE VOUCHERS LIST */}
      {vouchers.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>My Collected Rewards &amp; Vouchers ({vouchers.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-emerald-400">Valid in Workshop &amp; Till</span>
          </div>

          <div className="space-y-3">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-neutral-800 bg-[#090b0e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{v.title}</span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                        v.status === 'available'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-neutral-800 text-neutral-500'
                      }`}
                    >
                      {v.status === 'available' ? 'Active' : 'Redeemed'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/90 font-medium">
                    {v.description || 'Eligible for £40 service (labour only, parts not included)'}
                  </p>
                  <div className="text-[11px] font-mono text-neutral-400">
                    Code: <strong className="text-white">{v.code}</strong> · {v.terms}
                  </div>
                </div>

                {v.status === 'available' && onGoToBooking && (
                  <button
                    type="button"
                    onClick={onGoToBooking}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Apply to Booking</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
