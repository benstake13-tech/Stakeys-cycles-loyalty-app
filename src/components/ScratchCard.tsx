import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Gift,
  Clock,
  CheckCircle2,
  Lock,
  Ticket,
  Info,
  Trophy,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { CollectedVoucher, ScratchPrize } from '../types/bikeShop';
import {
  checkScratchEligibility,
  pickScratchPrizeIndex,
  scratchPrizeAmountLabel,
  scratchPrizeProbability,
} from '../utils/scratchCardHelper';

interface ScratchCardProps {
  onGoToStamps?: () => void;
  onGoToBooking?: () => void;
}

/** Fraction of the foil that must be scratched off before the prize is awarded. */
const REVEAL_THRESHOLD = 0.5;
const BRUSH_RADIUS = 30;

export const ScratchCard: React.FC<ScratchCardProps> = ({ onGoToStamps, onGoToBooking }) => {
  const { currentUser, scratchCard, awardScratchCardPrize } = useShop();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isPointerDownRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [isScratching, setIsScratching] = useState(false);
  const [revealedPrize, setRevealedPrize] = useState<ScratchPrize | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [voucher, setVoucher] = useState<CollectedVoucher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOdds, setShowOdds] = useState(false);

  const eligibility = useMemo(
    () => checkScratchEligibility(currentUser, scratchCard),
    [currentUser, scratchCard]
  );

  const prizes = scratchCard?.prizes ?? [];

  // Paint the opaque foil layer whenever a fresh card is offered. Drawn to the
  // canvas's device-pixel size so the reveal sampling is accurate on retina.
  const paintFoil = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#9ca3af');
    grad.addColorStop(0.35, '#e5e7eb');
    grad.addColorStop(0.55, '#6b7280');
    grad.addColorStop(1, '#d1d5db');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(17,24,39,0.65)';
    ctx.font = `bold ${Math.round(18 * dpr)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH HERE', canvas.width / 2, canvas.height / 2);
  }, []);

  useEffect(() => {
    // Repaint on eligibility change (new card / cooldown reset / first load).
    if (eligibility.canPlay && !isRevealing && !revealedPrize) {
      paintFoil();
    }
  }, [eligibility.canPlay, isRevealing, revealedPrize, paintFoil]);

  useEffect(() => {
    const onResize = () => {
      if (eligibility.canPlay && !isRevealing && !revealedPrize) paintFoil();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [eligibility.canPlay, isRevealing, revealedPrize, paintFoil]);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_RADIUS * dpr, 0, Math.PI * 2);
    ctx.fill();

    const last = lastPointRef.current;
    if (last) {
      // Interpolate between samples so a fast swipe leaves a continuous trail.
      const dist = Math.hypot(x - last.x, y - last.y);
      const steps = Math.max(1, Math.floor(dist / (BRUSH_RADIUS * dpr)));
      for (let i = 1; i < steps; i++) {
        const ix = last.x + ((x - last.x) * i) / steps;
        const iy = last.y + ((y - last.y) * i) / steps;
        ctx.beginPath();
        ctx.arc(ix, iy, BRUSH_RADIUS * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    lastPointRef.current = { x, y };
  };

  /** Samples the foil's alpha channel to estimate how much is scratched off. */
  const estimateRevealed = (): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    const { width, height } = canvas;
    if (width === 0 || height === 0) return 0;
    const sampleStep = Math.max(4, Math.floor(Math.min(width, height) / 48));
    const data = ctx.getImageData(0, 0, width, height).data;
    let transparent = 0;
    let total = 0;
    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        total++;
        if (data[(y * width + x) * 4 + 3] < 32) transparent++;
      }
    }
    return total === 0 ? 0 : transparent / total;
  };

  const finalizeReveal = useCallback(
    async (prize: ScratchPrize) => {
      if (isRevealing) return;
      setIsRevealing(true);
      setError(null);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }

      const res = await awardScratchCardPrize(currentUser!.uid, prize);
      if (!res.success) {
        setError(res.message);
        setIsRevealing(false);
        return;
      }

      setRevealedPrize(prize);
      setVoucher(res.voucher ?? null);
      setIsScratching(false);

      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {
        /* confetti is best-effort */
      }
    },
    [awardScratchCardPrize, currentUser, isRevealing]
  );

  // The prize is chosen the moment the rider starts scratching, then hidden
  // under the foil until enough is removed.
  const pendingPrizeRef = useRef<ScratchPrize | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!eligibility.canPlay || isRevealing || revealedPrize) return;
    const idx = pickScratchPrizeIndex(prizes);
    if (idx < 0) return;
    pendingPrizeRef.current = prizes[idx];
    isPointerDownRef.current = true;
    lastPointRef.current = null;
    setIsScratching(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    scratchAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || !eligibility.canPlay || revealedPrize) return;
    scratchAt(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const prize = pendingPrizeRef.current;
    if (prize && estimateRevealed() >= REVEAL_THRESHOLD) {
      finalizeReveal(prize);
    }
  };

  const resetLocal = () => {
    pendingPrizeRef.current = null;
    setRevealedPrize(null);
    setVoucher(null);
    setIsRevealing(false);
    setIsScratching(false);
    setError(null);
    lastPointRef.current = null;
    paintFoil();
  };

  if (!scratchCard || !scratchCard.enabled) {
    return (
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-10 text-center space-y-3">
        <Lock className="w-8 h-8 text-neutral-500 mx-auto" />
        <h3 className="text-white font-bold">Scratch card unavailable</h3>
        <p className="text-sm text-neutral-400">
          The shop has this feature switched off right now. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-[#0e1217] to-[#141b23] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Gift className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-tight">{scratchCard.title}</h2>
              <p className="text-xs text-neutral-400">
                Reveal your hidden prize — scratch off the silver panel below.
              </p>
            </div>
          </div>
          {scratchCard.ticketCost > 0 && (
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg flex items-center gap-1">
              <Ticket className="w-3 h-3" />
              {scratchCard.ticketCost} ticket{scratchCard.ticketCost > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!eligibility.canPlay && !revealedPrize ? (
          <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-2">
            <Clock className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-sm text-neutral-200 font-semibold">
              {eligibility.cooldownActive ? 'Next scratch card unlocks soon' : 'Not available yet'}
            </p>
            <p className="text-xs text-neutral-400">{eligibility.reason}</p>
            {eligibility.cooldownActive && (
              <p className="text-emerald-400 font-mono text-sm pt-1">
                {eligibility.timeRemainingFormatted} remaining
              </p>
            )}
            {eligibility.nextEligibleDate && (
              <p className="text-[11px] text-neutral-500">
                Available from {eligibility.nextEligibleDate.toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Scratch surface: prize sits under a canvas foil */}
            <div
              ref={containerRef}
              className="relative w-full h-56 rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 via-neutral-900 to-emerald-950/30 flex items-center justify-center select-none"
            >
              <div className="text-center px-6 space-y-2 pointer-events-none">
                {revealedPrize ? (
                  <>
                    <Trophy className="w-9 h-9 text-amber-400 mx-auto animate-bounce" />
                    <p className="text-white font-black text-xl">{revealedPrize.label}</p>
                    <p className="text-emerald-300 text-sm">{scratchPrizeAmountLabel(revealedPrize)}</p>
                    {voucher && (
                      <p className="text-[11px] font-mono text-neutral-300 pt-1">
                        Voucher: {voucher.code}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-9 h-9 text-emerald-400 mx-auto" />
                    <p className="text-neutral-300 font-bold">A prize is hidden here!</p>
                    <p className="text-neutral-500 text-xs">Scratch to reveal</p>
                  </>
                )}
              </div>

              {!revealedPrize && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              )}
            </div>

            {isScratching && !revealedPrize && (
              <p className="text-center text-[11px] text-emerald-400 animate-pulse">
                Keep scratching…
              </p>
            )}
            {error && <p className="text-center text-xs text-rose-400">{error}</p>}

            {revealedPrize && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <p className="text-sm text-emerald-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Prize added to your account!
                </p>
                {onGoToStamps && (
                  <button
                    type="button"
                    onClick={onGoToStamps}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    View my loyalty card
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {revealedPrize && scratchCard.cooldownHours > 0 && (
              <p className="text-center text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
                <Clock className="w-3 h-3" />
                You can play again in {scratchCard.cooldownHours} hour
                {scratchCard.cooldownHours === 1 ? '' : 's'}.
              </p>
            )}
          </>
        )}

        {/* Prize table (staff-configured odds) */}
        <div className="pt-4 border-t border-neutral-800 space-y-2">
          <button
            type="button"
            onClick={() => setShowOdds((v) => !v)}
            className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            {showOdds ? 'Hide' : 'Show'} possible prizes
          </button>
          {showOdds && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {prizes.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-neutral-200">{p.label}</span>
                  <span className="font-mono text-emerald-400">
                    {Math.round(scratchPrizeProbability(p, prizes) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {revealedPrize && (
          <button
            type="button"
            onClick={resetLocal}
            className="mx-auto text-[11px] text-neutral-500 hover:text-neutral-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset card view
          </button>
        )}
      </div>
    </div>
  );
};
