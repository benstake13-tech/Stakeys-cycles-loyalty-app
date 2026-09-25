import React, { useRef, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { X, Sparkles, Trophy, RotateCcw } from 'lucide-react';
import { PrizeWheel, PrizeWheelSegment } from '../types/bikeShop';

interface PrizeWheelModalProps {
  wheel: PrizeWheel;
  isOpen: boolean;
  onClose: () => void;
  onPrizeWon: (segment: PrizeWheelSegment) => void;
  canSpin?: boolean;
}

export const PrizeWheelModal: React.FC<PrizeWheelModalProps> = ({
  wheel,
  isOpen,
  onClose,
  onPrizeWon,
  canSpin = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningSegment, setWinningSegment] = useState<PrizeWheelSegment | null>(null);
  const rotationAngleRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  const segments = wheel.segments || [];

  // Draw the wheel onto the canvas
  const drawWheel = (currentAngle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2 - 16;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (segments.length === 0) return;

    const sliceAngle = (2 * Math.PI) / segments.length;

    // Draw wheel segments
    segments.forEach((seg, i) => {
      const angle = currentAngle + i * sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
      ctx.closePath();

      ctx.fillStyle = seg.color || '#3b82f6';
      ctx.fill();

      ctx.strokeStyle = '#171717';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw segment text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(seg.label, radius - 24, 5);
      ctx.restore();
    });

    // Outer wheel rim (Bike Tire Tread Style)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#262626';
    ctx.stroke();

    // Wheel outer rim dots (studs)
    const numStuds = segments.length * 3;
    for (let s = 0; s < numStuds; s++) {
      const studAngle = (s * 2 * Math.PI) / numStuds;
      const sx = centerX + (radius + 2) * Math.cos(studAngle);
      const sy = centerY + (radius + 2) * Math.sin(studAngle);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }

    // Center Bicycle Hub Cap
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    ctx.fillStyle = '#171717';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#05C147';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#05C147';
    ctx.font = 'bold 10px monospace';
    ctx.fillText("STAKEY'S", centerX, centerY - 6);
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '8px sans-serif';
    ctx.fillText("CYCLES", centerX, centerY + 8);
  };

  useEffect(() => {
    if (isOpen) {
      setWinningSegment(null);
      setTimeout(() => drawWheel(rotationAngleRef.current), 50);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isOpen, segments]);

  const spin = () => {
    if (isSpinning || segments.length === 0) return;

    setIsSpinning(true);
    setWinningSegment(null);

    // Pick target segment based on weights
    const totalWeight = segments.reduce((sum, s) => sum + (s.probability || 1), 0);
    let randomNum = Math.random() * totalWeight;
    let chosenIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      if (randomNum < (segments[i].probability || 1)) {
        chosenIndex = i;
        break;
      }
      randomNum -= segments[i].probability || 1;
    }

    const sliceAngle = (2 * Math.PI) / segments.length;
    // Top needle points at 270 degrees (3 * Math.PI / 2)
    const pointerAngle = 1.5 * Math.PI;

    // Calculate final angle so chosenIndex center stops right under pointer
    const segmentCenter = chosenIndex * sliceAngle + sliceAngle / 2;
    const baseTargetAngle = pointerAngle - segmentCenter;

    // Add 5 to 7 full rotations for excitement
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const totalRotation = fullSpins * 2 * Math.PI + baseTargetAngle;

    const startAngle = rotationAngleRef.current % (2 * Math.PI);
    const targetAngle = startAngle + totalRotation;
    const duration = 4800; // 4.8 seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Custom smooth deceleration easing
      const easeOut = 1 - Math.pow(1 - progress, 3.5);
      const current = startAngle + (targetAngle - startAngle) * easeOut;

      rotationAngleRef.current = current;
      drawWheel(current);

      if (progress < 1) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        const won = segments[chosenIndex];
        setWinningSegment(won);
        onPrizeWon(won);

        // Confetti explosion!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#05C147', '#10b981', '#0ea5e9', '#ec4899', '#ffffff'],
        });
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSpinning}
          className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {wheel.title}
          </div>
          <h3 className="text-2xl font-black text-white">Spin & Win Rewards</h3>
          <p className="text-xs text-neutral-400 mt-1">
            Free tune-ups, extra prize tickets, and exclusive gear discounts!
          </p>
        </div>

        {/* Wheel Container with Pointer Pin */}
        <div className="relative flex justify-center items-center my-2">
          {/* Top Indicator Needle */}
          <div className="absolute top-0 z-20 -mt-2.5 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-emerald-400 filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]" />
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-300 -mt-1 shadow-md border-2 border-neutral-900" />
          </div>

          <canvas
            ref={canvasRef}
            width={380}
            height={380}
            className="max-w-full aspect-square drop-shadow-2xl"
          />
        </div>

        {/* Prize Notification */}
        {winningSegment && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 border border-emerald-500/40 text-center animate-bounce-short">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wide">
              <Trophy className="w-4 h-4" />
              Congratulations Rider!
            </div>
            <div className="text-xl font-black text-white mt-1">
              {winningSegment.label}
            </div>
            <div className="text-xs text-neutral-300 mt-0.5">
              {winningSegment.rewardValue || 'Reward applied to your account!'}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={spin}
            disabled={isSpinning || !canSpin}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
              isSpinning || !canSpin
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 shadow-emerald-500/25 active:scale-95 cursor-pointer'
            }`}
          >
            {isSpinning ? (
              <>
                <RotateCcw className="w-5 h-5 animate-spin" />
                Spinning the Wheel...
              </>
            ) : winningSegment ? (
              <>
                <Sparkles className="w-5 h-5" />
                Spin Again
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Spin The Wheel Now!
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
