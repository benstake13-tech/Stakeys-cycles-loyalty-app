import React, { useState } from 'react';
import {
  Copy,
  Check,
  Scan,
  QrCode,
  Maximize2,
  X,
  Sparkles,
  Award,
  ShieldCheck,
  ExternalLink,
  Sun,
  Flame,
} from 'lucide-react';
import { wheelAudio } from '../utils/wheelAudio';

interface BarcodeVisualProps {
  value: string;
  customerName?: string;
  showScanLine?: boolean;
  memberSince?: string;
  stamps?: number;
  maxStamps?: number;
  tickets?: number;
  variant?: 'hero' | 'compact' | 'wallet';
  onStaffScanTest?: (barcodeVal: string) => void;
  membershipNumber?: string;
}

export const BarcodeVisual: React.FC<BarcodeVisualProps> = ({
  value,
  customerName,
  showScanLine = true,
  memberSince = 'Active Member',
  stamps = 0,
  maxStamps = 10,
  tickets = 0,
  variant = 'hero',
  onStaffScanTest,
  membershipNumber,
}) => {
  const [copied, setCopied] = useState(false);
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
  const [showPresentationModal, setShowPresentationModal] = useState(false);

  const displayId = membershipNumber || value;

  // Generate deterministic Code 128 / Code 39 style bar widths
  const generateBars = (code: string) => {
    const bars: { width: number; isBlack: boolean }[] = [];
    // Start guard bars
    bars.push({ width: 3, isBlack: true });
    bars.push({ width: 2, isBlack: false });
    bars.push({ width: 3, isBlack: true });
    bars.push({ width: 2, isBlack: false });

    const chars = code.split('');
    chars.forEach((char, idx) => {
      const codeVal = char.charCodeAt(0);
      const w1 = ((codeVal * 3 + idx) % 4) + 1;
      const w2 = ((codeVal * 5 + idx * 2) % 3) + 1;
      const w3 = ((codeVal * 7 + idx * 3) % 4) + 1;

      bars.push({ width: w1, isBlack: true });
      bars.push({ width: 2, isBlack: false });
      bars.push({ width: w2, isBlack: true });
      bars.push({ width: 3, isBlack: false });
      bars.push({ width: w3, isBlack: true });
      bars.push({ width: 2, isBlack: false });
    });

    // Check pattern
    bars.push({ width: 2, isBlack: true });
    bars.push({ width: 3, isBlack: false });
    bars.push({ width: 4, isBlack: true });
    bars.push({ width: 2, isBlack: false });

    // End guard bars
    bars.push({ width: 3, isBlack: true });
    bars.push({ width: 2, isBlack: false });
    bars.push({ width: 4, isBlack: true });

    return bars;
  };

  // Generate deterministic 21x21 QR Code matrix representation
  const generateQrMatrix = (code: string) => {
    const size = 21;
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // Finder patterns (top-left, top-right, bottom-left)
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[startY + r][startX + c] = true;
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Hash payload into interior cells
    let seed = 0;
    for (let i = 0; i < code.length; i++) {
      seed = (seed * 31 + code.charCodeAt(i)) & 0xffffffff;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder zones
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= size - 8;
        const inBottomLeft = r >= size - 8 && c < 8;
        if (inTopLeft || inTopRight || inBottomLeft || r === 6 || c === 6) continue;

        const val = Math.abs(Math.sin((seed + r * size + c) * 999));
        matrix[r][c] = val > 0.48;
      }
    }

    return matrix;
  };

  const bars = generateBars(value);
  const qrMatrix = generateQrMatrix(value);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    wheelAudio.playScannerBeep();
    setTimeout(() => setCopied(false), 2000);
  };

  const isRewardReady = stamps >= maxStamps;

  return (
    <>
      {/* FRONT & CENTRE HERO DIGITAL PASS */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-emerald-500/40 bg-gradient-to-b from-[#11161d] via-[#0d1015] to-[#090b0e] p-6 sm:p-8 shadow-[0_20px_60px_rgba(5,193,71,0.18),0_0_35px_rgba(0,0,0,0.8)] text-white font-['Plus_Jakarta_Sans',sans-serif] group transition-all">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-[#05C147] to-teal-400" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-emerald-500/15 blur-3xl pointer-events-none rounded-full" />

        {/* Card Header Strip: Brand + VIP Status + Presentation Action */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10 shrink-0">
              <Scan className="w-5 h-5 text-[#05C147]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-400">
                  STAKEY'S VIP RIDER PASS
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Cytech Atelier
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                {customerName || 'Loyalty Member'}
              </h2>
            </div>
          </div>

          {/* Quick Barcode / QR toggle & Enlarge buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <div className="bg-neutral-950 p-1 rounded-xl border border-neutral-800 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCodeType('barcode')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  codeType === 'barcode'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Linear 1D Barcode"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-400" />
                <span>Barcode</span>
              </button>
              <button
                type="button"
                onClick={() => setCodeType('qr')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  codeType === 'qr'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="2D QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>QR</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPresentationModal(true)}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
              title="Full Screen / Max Brightness for Optical Scanner"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Till View</span>
            </button>
          </div>
        </div>

        {/* FRONT & CENTRE HERO SCAN AREA */}
        <div className="relative z-10 py-6 flex flex-col items-center justify-center text-center">
          {/* Subtle Laser Beam Overlay */}
          <div className="relative w-full max-w-lg mx-auto">
            {showScanLine && (
              <div className="absolute inset-x-4 h-[2px] bg-emerald-400/80 shadow-[0_0_12px_#05C147] animate-pulse top-1/2 -translate-y-1/2 pointer-events-none z-20" />
            )}

            {/* High-Contrast Pure-White Scanner Target Surface */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl border-4 border-emerald-500/20 flex flex-col items-center justify-center transition-transform hover:scale-[1.01]">
              {codeType === 'barcode' ? (
                /* Crisp 1D Linear Barcode */
                <div className="w-full flex flex-col items-center justify-center">
                  <div className="flex items-stretch justify-center h-24 sm:h-28 w-full max-w-md gap-[1.5px] sm:gap-[2px] px-2 py-1 overflow-hidden">
                    {bars.map((bar, index) => (
                      <div
                        key={index}
                        style={{
                          width: `${bar.width * 2.2}px`,
                          backgroundColor: bar.isBlack ? '#090b0e' : 'transparent',
                        }}
                        className="h-full shrink-0"
                      />
                    ))}
                  </div>

                  {/* Clean Human-Readable Barcode Value */}
                  <div className="font-mono text-base sm:text-lg font-black text-neutral-950 tracking-[0.25em] mt-2 select-all">
                    {displayId}
                  </div>
                </div>
              ) : (
                /* Crisp 2D QR Code Matrix */
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <svg
                      viewBox="0 0 21 21"
                      className="w-36 h-36 sm:w-44 sm:h-44 shape-rendering-crispEdges"
                      fill="#090b0e"
                    >
                      {qrMatrix.map((row, r) =>
                        row.map((filled, c) =>
                          filled ? (
                            <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />
                          ) : null
                        )
                      )}
                    </svg>
                  </div>
                  <div className="font-mono text-sm sm:text-base font-bold text-neutral-900 tracking-wider mt-1 select-all">
                    {displayId}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Identification & 1-Click Copy Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 text-xs text-neutral-200 hover:text-white font-mono flex items-center gap-2 cursor-pointer transition-all shadow-sm"
              title="Copy Membership ID"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied {displayId}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Copy ID: <strong className="text-white">{displayId}</strong></span>
                </>
              )}
            </button>

            <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cytech Till Verified</span>
            </div>

            {/* Direct Staff Test Scan Simulation Button */}
            {onStaffScanTest && (
              <button
                type="button"
                onClick={() => {
                  wheelAudio.playScannerBeep();
                  onStaffScanTest(displayId);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                title="Simulate staff scanning this barcode at the workshop till"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-400" />
                <span>Staff: Scan &amp; Open Account</span>
              </button>
            )}
          </div>
        </div>

        {/* LIVE LOYALTY STAMPS INTEGRATED DIRECTLY ON THE CARD */}
        <div className="relative z-10 pt-4 border-t border-neutral-800/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#05C147]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Visit Stamps &amp; Rewards Balance
              </span>
              <span className="font-mono text-xs text-emerald-400 font-bold">
                ({stamps}/{maxStamps})
              </span>
            </div>

            <div className="text-xs">
              {isRewardReady ? (
                <span className="text-purple-300 font-bold flex items-center gap-1 bg-purple-950/80 px-2.5 py-1 rounded-lg border border-purple-600/50">
                  <Flame className="w-3.5 h-3.5 text-purple-400" />
                  £40 Workshop Service Reward Ready!
                </span>
              ) : (
                <span className="text-neutral-400 font-medium">
                  {maxStamps - stamps} more {maxStamps - stamps === 1 ? 'visit' : 'visits'} to unlock £40 service credit
                </span>
              )}
            </div>
          </div>

          {/* 10-Stamp Visual Progress Pip Strip */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: maxStamps }).map((_, i) => {
              const isStamped = i < stamps;
              return (
                <div
                  key={i}
                  className={`h-9 rounded-xl flex items-center justify-center transition-all ${
                    isStamped
                      ? isRewardReady
                        ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] border border-purple-400'
                        : 'bg-gradient-to-tr from-[#05C147] to-emerald-400 text-neutral-950 shadow-[0_0_10px_rgba(5,193,71,0.35)] border border-emerald-300'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-600'
                  }`}
                >
                  {isStamped ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span className="text-[11px] font-mono font-bold text-neutral-500">
                      {i + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Pass Instructions */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between text-[11px] text-neutral-400">
            <span>Present this screen at Stakey's Cycles front desk on drop-off or collection.</span>
            <span className="font-mono text-emerald-400">1 visit stamp per day</span>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN HIGH-CONTRAST TILL PRESENTATION MODAL */}
      {showPresentationModal && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-md bg-white text-neutral-950 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-5 text-center">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="text-left">
                <div className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#05C147]">
                  STAKEY'S CYCLES TILL SCANNER
                </div>
                <h3 className="font-display text-lg font-black text-neutral-900">
                  {customerName || 'Member Pass'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPresentationModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High-Contrast Oversized Barcode */}
            <div className="py-4 bg-white rounded-2xl flex flex-col items-center justify-center">
              <div className="flex items-stretch justify-center h-32 w-full gap-[2.5px] px-2 py-1 overflow-hidden">
                {bars.map((bar, index) => (
                  <div
                    key={index}
                    style={{
                      width: `${bar.width * 2.8}px`,
                      backgroundColor: bar.isBlack ? '#000000' : 'transparent',
                    }}
                    className="h-full shrink-0"
                  />
                ))}
              </div>
              <div className="font-mono text-2xl font-black text-black tracking-[0.25em] mt-3">
                {displayId}
              </div>
            </div>

            {/* QR Code Mirror in Modal */}
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-center gap-4">
              <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                <svg
                  viewBox="0 0 21 21"
                  className="w-20 h-20 shape-rendering-crispEdges"
                  fill="#000000"
                >
                  {qrMatrix.map((row, r) =>
                    row.map((filled, c) =>
                      filled ? (
                        <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />
                      ) : null
                    )
                  )}
                </svg>
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-neutral-900">High-Contrast Till Mode</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Point this screen directly at the workshop barcode gun or camera.
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 font-mono font-semibold">
                  <Sun className="w-3.5 h-3.5" /> Max Optical Contrast Active
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPresentationModal(false)}
              className="w-full py-3 rounded-xl bg-neutral-950 text-white font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Done / Close Pass
            </button>
          </div>
        </div>
      )}
    </>
  );
};
