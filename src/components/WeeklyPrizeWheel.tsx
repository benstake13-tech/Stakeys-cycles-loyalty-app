import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Award,
  Clock,
  CheckCircle2,
  Lock,
  RotateCcw,
  Zap,
  Gift,
  Wrench,
  ArrowRight,
  Flame,
  Info,
  Volume2,
  VolumeX,
  Trophy,
  Tag,
  Coffee,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { PrizeWheelSegment, CollectedVoucher } from '../types/bikeShop';
import { checkSpinEligibility, pickWinningSegmentIndex } from '../utils/prizeWheelHelper';
import { wheelAudio } from '../utils/wheelAudio';
import { StakeysLogo } from './StakeysLogo';

interface WeeklyPrizeWheelProps {
  onGoToStamps?: () => void;
  onGoToBooking?: () => void;
}

export const WeeklyPrizeWheel: React.FC<WeeklyPrizeWheelProps> = ({
  onGoToStamps,
  onGoToBooking,
}) => {
  const {
    currentUser,
    activeWheel,
    awardWeeklyWheelPrize,
    collectFullCardReward,
    resetUserSpinCooldown,
  } = useShop();

  // Curated, workshop-authentic 8-segment prize wheel
  const defaultSegments: PrizeWheelSegment[] = useMemo(() => {
    if (activeWheel && activeWheel.segments && activeWheel.segments.length > 0) {
      return activeWheel.segments;
    }
    return [
      {
        id: 'seg-stamp-1',
        label: '+1 Loyalty Stamp',
        color: '#05C147',
        probability: 0.28,
        prizeId: 'prize-stamp-1',
        rewardType: 'stamp',
        stampsAmount: 1,
      },
      {
        id: 'seg-gear-10',
        label: '£10 Off Gear',
        color: '#0284c7',
        probability: 0.18,
        prizeId: 'prize-gear-10',
        rewardType: 'discount',
        rewardValue: '£10 Off In-Store Accessories',
      },
      {
        id: 'seg-stamp-2',
        label: '+2 Stamps',
        color: '#10b981',
        probability: 0.16,
        prizeId: 'prize-stamp-2',
        rewardType: 'stamp',
        stampsAmount: 2,
      },
      {
        id: 'seg-cleaner',
        label: 'Muc-Off Cleaner',
        color: '#7c3aed',
        probability: 0.12,
        prizeId: 'prize-cleaner',
        rewardType: 'merch',
        rewardValue: 'Complimentary Muc-Off Bike Cleaner',
      },
      {
        id: 'seg-stamp-3',
        label: '+3 Stamps Jackpot!',
        color: '#d97706',
        probability: 0.08,
        prizeId: 'prize-stamp-3',
        rewardType: 'stamp',
        stampsAmount: 3,
      },
      {
        id: 'seg-tube',
        label: 'Free Inner Tube',
        color: '#0891b2',
        probability: 0.08,
        prizeId: 'prize-tube',
        rewardType: 'merch',
        rewardValue: 'Free Presta/Schrader Inner Tube at Till',
      },
      {
        id: 'seg-points-50',
        label: '+50 Store Points',
        color: '#db2777',
        probability: 0.05,
        prizeId: 'prize-points-50',
        rewardType: 'points',
        rewardValue: '50 Bonus Loyalty Points',
      },
      {
        id: 'seg-espresso',
        label: 'Free Workshop Coffee',
        color: '#ea580c',
        probability: 0.05,
        prizeId: 'prize-coffee',
        rewardType: 'service',
        rewardValue: 'Free Barista Coffee while bike is serviced',
      },
    ];
  }, [activeWheel]);

  const wheelConfig = useMemo(() => {
    return activeWheel
      ? { ...activeWheel, ticketCost: 0, segments: defaultSegments }
      : { id: 'wheel-main-01', title: "Stakey's Weekly Prize Wheel", active: true, ticketCost: 0, segments: defaultSegments };
  }, [activeWheel, defaultSegments]);

  const eligibility = useMemo(() => {
    return checkSpinEligibility(currentUser, wheelConfig);
  }, [currentUser, wheelConfig]);

  // Audio mute toggle state
  const [isMuted, setIsMuted] = useState(() => wheelAudio.getIsMuted());

  const handleToggleSound = () => {
    const nextMuted = wheelAudio.toggleMute();
    setIsMuted(nextMuted);
  };

  // Wheel Physics & Animation State
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [needleAngle, setNeedleAngle] = useState(0);
  const [wonSegment, setWonSegment] = useState<PrizeWheelSegment | null>(null);
  const [celebrationResult, setCelebrationResult] = useState<{
    stampsAwarded?: number;
    isFull?: boolean;
    voucher?: CollectedVoucher;
    message: string;
  } | null>(null);

  // Full Card Reward Collection State
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectedVoucherSuccess, setCollectedVoucherSuccess] = useState<CollectedVoucher | null>(null);

  // Odds table disclosure state
  const [showOddsTable, setShowOddsTable] = useState(false);

  // Stamp animation state
  const [displayedStamps, setDisplayedStamps] = useState(currentUser?.stamps || 0);

  useEffect(() => {
    if (!isSpinning) {
      setDisplayedStamps(currentUser?.stamps || 0);
    }
  }, [currentUser?.stamps, isSpinning]);

  const numSegments = defaultSegments.length;
  const sliceAngle = 360 / numSegments;

  // Animation frame reference
  const animRef = useRef<number | null>(null);
  const lastPegIndexRef = useRef<number>(-1);

  // Stop animation cleanly on unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Spin Initiation Handler
  const handleStartSpin = useCallback(() => {
    if (isSpinning) return;
    if (!eligibility.canSpin) return;

    // Pick target winning segment
    const winningIdx = pickWinningSegmentIndex(defaultSegments);
    const winningSeg = defaultSegments[winningIdx];
    setWonSegment(winningSeg);
    setCelebrationResult(null);
    setIsSpinning(true);

    // Calculate final rotation angle
    // Top pointer is at 12 o'clock (-90° / 270° from 3 o'clock).
    // Slice i spans [i * sliceAngle, (i + 1) * sliceAngle], with center at (i + 0.5) * sliceAngle.
    // When wheel rotates by angle R, slice i center is at: ((i + 0.5) * sliceAngle + R) % 360.
    // Setting this to 270° gives: R % 360 = (270 - (winningIdx + 0.5) * sliceAngle) % 360.
    const sliceCenterAngle = (winningIdx + 0.5) * sliceAngle;
    const targetNormalized = ((270 - sliceCenterAngle) % 360 + 360) % 360;

    // Random jitter within +/- 30% of slice half-width to feel authentic
    const jitter = (Math.random() - 0.5) * (sliceAngle * 0.6);

    const currentMod = ((wheelRotation % 360) + 360) % 360;
    let delta = targetNormalized + jitter - currentMod;
    if (delta < 0) delta += 360;

    // Add 6 full revolutions for dramatic suspense (duration ~5.2 seconds)
    const fullSpins = 6 * 360;
    const startAngle = wheelRotation;
    const finalAngle = startAngle + fullSpins + delta;

    const duration = 5200; // ms
    const startTime = performance.now();
    lastPegIndexRef.current = -1;

    // Smooth cubic bezier easing function (starts fast, long suspenseful deceleration)
    // easeOutCubic with a touch of quartic curve
    const easeOutSpin = (t: number): number => {
      const p = 1 - t;
      return 1 - p * p * p * p * (1 + 0.5 * p);
    };

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutSpin(progress);
      const currentAngle = startAngle + (finalAngle - startAngle) * eased;

      setWheelRotation(currentAngle);

      // Track peg crossing for mechanical needle flick & audio ratchet click
      // 24 pegs total: 8 segment boundary pegs + 16 subdivisions
      const numPegs = numSegments * 2;
      const pegAngleStep = 360 / numPegs;
      const currentPegIndex = Math.floor((currentAngle % 360 + 360) % 360 / pegAngleStep);

      if (currentPegIndex !== lastPegIndexRef.current) {
        lastPegIndexRef.current = currentPegIndex;
        const speedRatio = 1 - progress;
        wheelAudio.playRatchetClick(speedRatio);

        // Needle flick animation
        setNeedleAngle(-18 * Math.max(0.2, speedRatio));
        setTimeout(() => setNeedleAngle(0), 40);
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        // Spin finished!
        setWheelRotation(finalAngle);
        setNeedleAngle(0);
        setIsSpinning(false);
        wheelAudio.playWinChime();

        // Celebration confetti burst
        try {
          confetti({
            particleCount: 110,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#05C147', '#10b981', '#f59e0b', '#0284c7', '#ffffff'],
          });
          setTimeout(() => {
            confetti({
              particleCount: 60,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
            });
            confetti({
              particleCount: 60,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
            });
          }, 250);
        } catch {}

        // Award prize to customer profile
        if (currentUser && winningSeg) {
          awardWeeklyWheelPrize(currentUser.uid, winningSeg).then((res) => {
            setCelebrationResult({
              stampsAwarded: res.stampsAwarded,
              isFull: res.isFull,
              voucher: res.voucher,
              message: res.message,
            });
            if (res.stampsAwarded) {
              setDisplayedStamps((prev) => Math.min(10, prev + (res.stampsAwarded || 0)));
            }
          });
        }
      }
    };

    animRef.current = requestAnimationFrame(step);
  }, [
    isSpinning,
    eligibility.canSpin,
    defaultSegments,
    numSegments,
    sliceAngle,
    wheelRotation,
    currentUser,
    awardWeeklyWheelPrize,
  ]);

  // Handle Full Card £40 Service Voucher Collection
  const handleCollectReward = async () => {
    if (!currentUser) return;
    setIsCollecting(true);
    try {
      const res = await collectFullCardReward(currentUser.uid);
      if (res.success && res.voucher) {
        setCollectedVoucherSuccess(res.voucher);
        setDisplayedStamps(0);
        wheelAudio.playWinChime();
        try {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#05C147', '#eab308', '#38bdf8', '#ffffff'],
          });
        } catch {}
      }
    } finally {
      setIsCollecting(false);
    }
  };

  const currentStamps = currentUser?.stamps || 0;
  const isCardFull = currentStamps >= 10;

  // Icon mapping for slice labels
  const getSliceIcon = (rewardType?: string) => {
    switch (rewardType) {
      case 'stamp':
        return <Award className="w-3.5 h-3.5 inline mr-1 text-emerald-300" />;
      case 'discount':
        return <Tag className="w-3.5 h-3.5 inline mr-1 text-sky-300" />;
      case 'merch':
        return <Gift className="w-3.5 h-3.5 inline mr-1 text-purple-300" />;
      case 'service':
        return <Coffee className="w-3.5 h-3.5 inline mr-1 text-amber-300" />;
      case 'points':
        return <Sparkles className="w-3.5 h-3.5 inline mr-1 text-pink-300" />;
      default:
        return <Award className="w-3.5 h-3.5 inline mr-1 text-emerald-300" />;
    }
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. FULL CARD COLLECT CALLOUT - HIGHEST VISIBILITY */}
      {isCardFull && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-[#0d1e13] to-neutral-950 border-2 border-[#05C147] p-6 sm:p-8 shadow-[0_0_40px_rgba(5,193,71,0.25)] animate-fade-in text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 fill-emerald-400" />
                <span>10/10 Stamps Full · Reward Ready!</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                Your Loyalty Card is Complete!
              </h2>
              <p className="text-sm text-emerald-100/90 leading-relaxed font-medium">
                Press collect below to claim your reward. You are{' '}
                <strong className="text-white underline decoration-emerald-400 font-bold">
                  eligible for a £40 service (labour only, parts not included)
                </strong>
                .
              </p>
              <div className="text-xs text-neutral-400 flex items-center gap-2 pt-1">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Valid on any bicycle tune-up or electric scooter service at our workshop atelier.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCollectReward}
              disabled={isCollecting}
              className="px-6 py-4 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-2xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Award className="w-5 h-5 fill-neutral-950" />
              <span>{isCollecting ? 'Claiming Voucher...' : 'Press to Collect £40 Service'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. SUCCESS BANNER WHEN CLAIMED */}
      {collectedVoucherSuccess && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-[#09150d] p-6 sm:p-8 space-y-4 shadow-2xl animate-fade-in text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Voucher Claimed Successfully
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-black text-white">
                  Eligible for £40 service (labour only, parts not included)
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollectedVoucherSuccess(null)}
              className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800"
            >
              Dismiss
            </button>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-neutral-400 block mb-0.5">Voucher Code:</span>
              <span className="font-mono text-base font-black text-[#05C147] tracking-wider">
                {collectedVoucherSuccess.code}
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Reward Value:</span>
              <span className="font-bold text-white text-sm">
                £40 Labour Credit (Parts not included)
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Card Status:</span>
              <span className="text-neutral-300">
                10 stamps redeemed. Fresh 10-stamp card initiated!
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {onGoToBooking && (
              <button
                type="button"
                onClick={onGoToBooking}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>Book Workshop Service With Voucher</span>
              </button>
            )}
            {onGoToStamps && (
              <button
                type="button"
                onClick={onGoToStamps}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs border border-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>View My Digital Garage &amp; Pass</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN BESPOKE HIGH-QUALITY WHEEL CARD */}
      <div className="bg-[#0b0e14] border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient atmospheric lighting */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header Strip */}
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Free Weekly Customer Reward · 1 Spin Every 7 Days</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Weekly Prize Wheel
            </h2>
            <p className="text-xs text-neutral-300 mt-1 max-w-xl">
              Spin once a week to win loyalty stamps or store rewards. Fill 10 stamps to press collect for your{' '}
              <strong className="text-emerald-400 font-semibold">
                £40 service (labour only, parts not included)
              </strong>
              .
            </p>
          </div>

          {/* Stamp Card Mini Progress Pill + Sound Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleSound}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 text-xs font-medium ${
                isMuted
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/20'
              }`}
              title={isMuted ? 'Unmute Mechanical Sound FX' : 'Mute Wheel Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Audio ON'}</span>
            </button>

            <div className="bg-[#090b0e] border border-neutral-800 rounded-2xl p-3.5 flex items-center gap-4">
              <div>
                <div className="text-[11px] text-neutral-400">Stamp Progress</div>
                <div className="font-mono text-lg font-bold text-[#05C147]">
                  {displayedStamps} <span className="text-xs font-normal text-neutral-500">/ 10</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Wheel Arena */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-8">
          {/* Wheel Display Canvas Column */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            {/* Wheel Outer Housing with Machined Alloy Bezel */}
            <div
              className={`relative flex items-center justify-center p-3 rounded-full transition-all duration-700 select-none ${
                isSpinning
                  ? 'shadow-[0_0_50px_rgba(5,193,71,0.35),0_0_90px_rgba(245,158,11,0.15)] ring-4 ring-emerald-500/40'
                  : 'shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(5,193,71,0.1)] ring-2 ring-neutral-700/60'
              }`}
              style={{
                background: 'radial-gradient(circle, #1a202c 0%, #0d1117 70%, #06090e 100%)',
              }}
            >
              {/* Outer Precision Bicycle Rim with 24 Brass Spoke Nipples / Chrome Rivets */}
              <div
                className="relative w-76 h-76 sm:w-96 sm:h-96 md:w-104 md:h-104 rounded-full overflow-hidden border-8 border-[#222730] shadow-inner flex items-center justify-center"
                style={{
                  boxShadow: 'inset 0 0 25px rgba(0,0,0,0.9), 0 0 0 4px #d97706',
                }}
              >
                {/* 24 Perimeter Studs / Rivet Markers */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i * 360) / 24;
                  return (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full pointer-events-none z-20 shadow-md"
                      style={{
                        backgroundColor: i % 3 === 0 ? '#f59e0b' : '#94a3b8',
                        top: '50%',
                        left: '50%',
                        transform: `rotate(${angle}deg) translate(0, -${142}px) translate(-50%, -50%)`,
                        boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                      }}
                    />
                  );
                })}

                {/* The Rotating Wheel Assembly */}
                <div
                  className="w-full h-full rounded-full relative"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transformOrigin: 'center center',
                    willChange: 'transform',
                  }}
                >
                  <svg
                    viewBox="0 0 400 400"
                    className="w-full h-full filter drop-shadow-md"
                  >
                    <defs>
                      {/* Rich Radial Metallic Gradients per slice */}
                      <radialGradient id="grad-green" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#0a5c24" />
                        <stop offset="90%" stopColor="#05C147" />
                        <stop offset="100%" stopColor="#048a33" />
                      </radialGradient>
                      <radialGradient id="grad-cobalt" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#0a3d62" />
                        <stop offset="90%" stopColor="#0284c7" />
                        <stop offset="100%" stopColor="#0369a1" />
                      </radialGradient>
                      <radialGradient id="grad-mint" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#064e3b" />
                        <stop offset="90%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#047857" />
                      </radialGradient>
                      <radialGradient id="grad-purple" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#3b0764" />
                        <stop offset="90%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#6d28d9" />
                      </radialGradient>
                      <radialGradient id="grad-amber" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#78350f" />
                        <stop offset="90%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#b45309" />
                      </radialGradient>
                      <radialGradient id="grad-cyan" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#083344" />
                        <stop offset="90%" stopColor="#0891b2" />
                        <stop offset="100%" stopColor="#0e7490" />
                      </radialGradient>
                      <radialGradient id="grad-rose" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#500724" />
                        <stop offset="90%" stopColor="#db2777" />
                        <stop offset="100%" stopColor="#be185d" />
                      </radialGradient>
                      <radialGradient id="grad-orange" cx="50%" cy="50%" r="50%">
                        <stop offset="25%" stopColor="#7c2d12" />
                        <stop offset="90%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#c2410c" />
                      </radialGradient>
                    </defs>

                    {/* Slices Rendering */}
                    {defaultSegments.map((seg, idx) => {
                      const startAng = (idx * sliceAngle * Math.PI) / 180;
                      const endAng = ((idx + 1) * sliceAngle * Math.PI) / 180;
                      const midAng = ((idx + 0.5) * sliceAngle * Math.PI) / 180;

                      const cx = 200;
                      const cy = 200;
                      const r = 194;

                      const x1 = cx + r * Math.cos(startAng);
                      const y1 = cy + r * Math.sin(startAng);
                      const x2 = cx + r * Math.cos(endAng);
                      const y2 = cy + r * Math.sin(endAng);

                      const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

                      const gradientIds = [
                        'grad-green',
                        'grad-cobalt',
                        'grad-mint',
                        'grad-purple',
                        'grad-amber',
                        'grad-cyan',
                        'grad-rose',
                        'grad-orange',
                      ];
                      const gradId = gradientIds[idx % gradientIds.length];

                      // Text positioning: along the radial bisector
                      const textRadius = 125;
                      const tx = cx + textRadius * Math.cos(midAng);
                      const ty = cy + textRadius * Math.sin(midAng);
                      const textRotation = (midAng * 180) / Math.PI;

                      return (
                        <g key={seg.id || idx}>
                          {/* Segment Wedge */}
                          <path
                            d={pathData}
                            fill={`url(#${gradId})`}
                            stroke="#171923"
                            strokeWidth="2.5"
                          />

                          {/* Inner Radial Divider Pin Accent */}
                          <line
                            x1={cx}
                            y1={cy}
                            x2={x1}
                            y2={y1}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            opacity="0.3"
                          />

                          {/* Segment Label along ray */}
                          <text
                            x={tx}
                            y={ty}
                            fill="#ffffff"
                            fontSize={seg.label.length > 18 ? '10.5' : '12'}
                            fontWeight="800"
                            fontFamily="Plus Jakarta Sans, sans-serif"
                            textAnchor="middle"
                            dominantBaseline="central"
                            transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                            style={{
                              textShadow: '0 2px 4px rgba(0,0,0,0.85)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {seg.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Convex Glass Dome Specular Reflection (Realistic Watch/Dial Crystal) */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none z-20"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 35%, transparent 55%)',
                  }}
                />

                {/* Multi-Tier CNC Center Hub Assembly */}
                <div
                  className="absolute z-30 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-2xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, #1f2937 0%, #111827 75%, #030712 100%)',
                    boxShadow: '0 0 25px rgba(0,0,0,0.9), inset 0 0 10px rgba(255,255,255,0.15)',
                    border: '3px solid #d97706',
                  }}
                >
                  {/* Knurled Outer Track */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-neutral-600 bg-neutral-950 flex items-center justify-center text-emerald-400 shadow-inner">
                    <StakeysLogo className="w-9 h-9 sm:w-10 sm:h-10 text-emerald-400 filter drop-shadow" />
                  </div>
                </div>
              </div>

              {/* Physical Brass Needle Flipper at 12 o'clock */}
              <div
                className="absolute -top-3 z-40 flex flex-col items-center pointer-events-none transition-transform duration-75"
                style={{
                  transform: `rotate(${needleAngle}deg)`,
                  transformOrigin: 'top center',
                }}
              >
                {/* Needle Mounting Bracket */}
                <div className="w-7 h-5 rounded-t-md bg-neutral-900 border border-neutral-700 shadow-md flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm border border-neutral-900" />
                </div>
                {/* Golden Aerodynamic Arrow Pointer */}
                <svg
                  width="26"
                  height="34"
                  viewBox="0 0 26 34"
                  className="filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] -mt-1"
                >
                  <polygon
                    points="13,34 0,4 26,4"
                    fill="#f59e0b"
                    stroke="#78350f"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="13,30 4,6 22,6"
                    fill="#fbbf24"
                  />
                  <circle cx="13" cy="11" r="3" fill="#b45309" />
                </svg>
              </div>
            </div>
          </div>

          {/* Controls & Eligibility Column */}
          <div className="lg:col-span-5 space-y-4">
            {/* Status Card */}
            <div className="bg-[#090b0e] border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Rider Membership:</span>
                <span className="font-mono text-white font-semibold">
                  {currentUser?.membershipNumber || 'STK-GUEST'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Spin Eligibility:</span>
                <span className="font-bold text-emerald-400 font-mono uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>1 Free Spin / Week</span>
                </span>
              </div>

              <div className="pt-3 border-t border-neutral-800/80">
                {eligibility.isWeeklyCooldownActive ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Weekly Spin Used</span>
                      </span>
                      <span className="font-mono text-white font-bold">
                        {eligibility.timeRemainingFormatted} left
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Returns every 7 days. Need an urgent service? Book online with our Cytech mechanics below.
                    </p>

                    {/* Developer/Shop Demo Reset Button */}
                    <button
                      type="button"
                      onClick={() => currentUser && resetUserSpinCooldown(currentUser.uid)}
                      className="mt-2 text-[10px] text-neutral-500 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Cooldown for Test (Demo Mode)</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                    <Zap className="w-4 h-4 fill-emerald-400 shrink-0" />
                    <span>Your weekly spin is ready! Press below to spin for stamps.</span>
                  </div>
                )}
              </div>
            </div>

            {/* PRIMARY HIGH-ENERGY SPIN BUTTON */}
            <button
              type="button"
              onClick={handleStartSpin}
              disabled={isSpinning || eligibility.isWeeklyCooldownActive}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer select-none ${
                isSpinning
                  ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700 animate-pulse'
                  : eligibility.isWeeklyCooldownActive
                  ? 'bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#05C147] via-emerald-400 to-[#05C147] text-neutral-950 shadow-[0_10px_30px_rgba(5,193,71,0.35)] hover:shadow-[0_15px_40px_rgba(5,193,71,0.5)] hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isSpinning ? (
                <>
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  <span>SPINNING ROULETTE...</span>
                </>
              ) : eligibility.isWeeklyCooldownActive ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>SPIN LOCKED ({eligibility.timeRemainingFormatted})</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 fill-neutral-950" />
                  <span>SPIN THE PRIZE WHEEL (FREE)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* WINNER CELEBRATION CARD */}
            {celebrationResult && wonSegment && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-neutral-950 border border-emerald-500/50 text-xs animate-fade-in space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Prize Won on Weekly Wheel!</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Claimed
                  </span>
                </div>

                <div className="text-xl font-black text-white flex items-center gap-2">
                  {getSliceIcon(wonSegment.rewardType)}
                  <span>{wonSegment.label}</span>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">
                  {celebrationResult.stampsAwarded && celebrationResult.stampsAwarded > 0 ? (
                    <>
                      <strong>+{celebrationResult.stampsAwarded} loyalty stamps</strong> credited to your digital pass! Your balance is now{' '}
                      <strong className="text-emerald-400 font-mono text-sm">
                        {displayedStamps}/10 stamps
                      </strong>
                      .
                    </>
                  ) : (
                    celebrationResult.message
                  )}
                </p>

                {/* Animated Stamp Meter */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>Card Progress</span>
                    <span className="text-emerald-400 font-mono font-bold">{displayedStamps} / 10</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-800">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-[#05C147] h-full rounded-full transition-all duration-700"
                      style={{ width: `${(displayedStamps / 10) * 100}%` }}
                    />
                  </div>
                </div>

                {celebrationResult.isFull && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/30 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-400" />
                      <span>10/10 Full! Reward Unlocked.</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCollectReward}
                      className="px-3.5 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs cursor-pointer shadow-md shadow-emerald-500/20"
                    >
                      Collect £40 Service
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* COLLAPSIBLE FAIR PLAY BREAKDOWN & PROBABILITIES */}
            <div className="pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowOddsTable(!showOddsTable)}
                className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-white py-1.5 cursor-pointer"
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fair Play Probability &amp; Prize Table</span>
                </span>
                {showOddsTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showOddsTable && (
                <div className="mt-2.5 space-y-2 bg-[#090b0e] border border-neutral-800 rounded-xl p-3 animate-fade-in text-[11px]">
                  <div className="grid grid-cols-12 font-semibold text-neutral-400 border-b border-neutral-800 pb-1.5">
                    <span className="col-span-7">Prize Description</span>
                    <span className="col-span-3">Category</span>
                    <span className="col-span-2 text-right">Odds</span>
                  </div>
                  {defaultSegments.map((seg, i) => (
                    <div
                      key={seg.id || i}
                      className="grid grid-cols-12 items-center text-neutral-300 py-1 border-b border-neutral-900 last:border-0"
                    >
                      <div className="col-span-7 flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-medium truncate">{seg.label}</span>
                      </div>
                      <span className="col-span-3 text-neutral-400 capitalize">
                        {seg.rewardType || 'Reward'}
                      </span>
                      <span className="col-span-2 text-right font-mono text-emerald-400 font-bold">
                        {Math.round((seg.probability || 0.1) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 10-Stamp Journey Direct Preview & Collect Footer */}
        <div className="mt-8 pt-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-neutral-300">
            <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-white">
                How It Works: Collect 10 stamps → Press Collect → £40 Service Voucher
              </span>
              <p className="text-[11px] text-neutral-400">
                Eligible for £40 service (labour only, parts not included). Valid on cycle or scooter workshop bookings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isCardFull ? (
              <button
                type="button"
                onClick={handleCollectReward}
                className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Press Collect (£40 Service)
              </button>
            ) : onGoToStamps ? (
              <button
                type="button"
                onClick={onGoToStamps}
                className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                View Digital Pass ({currentStamps}/10)
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
