import React, { useState } from 'react';
import { Copy, Check, Scan } from 'lucide-react';

interface BarcodeVisualProps {
  value: string;
  customerName?: string;
  showScanLine?: boolean;
}

export const BarcodeVisual: React.FC<BarcodeVisualProps> = ({
  value,
  customerName,
  showScanLine = true,
}) => {
  const [copied, setCopied] = useState(false);

  // Generate deterministic bar widths based on input string characters
  const generateBars = (code: string) => {
    const bars: { width: number; isBlack: boolean }[] = [];
    // Start guard bars
    bars.push({ width: 3, isBlack: true });
    bars.push({ width: 2, isBlack: false });
    bars.push({ width: 3, isBlack: true });

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

    // End guard bars
    bars.push({ width: 3, isBlack: true });
    bars.push({ width: 2, isBlack: false });
    bars.push({ width: 3, isBlack: true });

    return bars;
  };

  const bars = generateBars(value);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-[#0d1015] text-neutral-100 p-6 rounded-2xl shadow-2xl border border-neutral-800 overflow-hidden">
      {/* Subtle laser alignment beam */}
      {showScanLine && (
        <div className="absolute inset-x-0 h-[1.5px] bg-emerald-400/70 shadow-[0_0_8px_#10b981] animate-pulse top-1/2 pointer-events-none" />
      )}

      {/* Card Header */}
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-2">
          <Scan className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-white">Digital Member Pass</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded cursor-pointer"
          title="Copy Barcode Value"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy ID'}</span>
        </button>
      </div>

      {/* High-Contrast Crisp Barcode graphic */}
      <div className="flex justify-center items-center h-20 px-3 bg-white rounded-lg py-2 my-2 shadow-inner">
        <div className="flex items-stretch h-full gap-[1.5px]">
          {bars.map((bar, index) => (
            <div
              key={index}
              style={{
                width: `${bar.width * 2}px`,
                backgroundColor: bar.isBlack ? '#090b0e' : 'transparent',
              }}
              className="h-full"
            />
          ))}
        </div>
      </div>

      {/* Unboxed Metadata & Pass Info */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div>
          <div className="font-mono text-sm font-bold tracking-widest text-white">
            {value}
          </div>
          {customerName && (
            <div className="text-[11px] text-neutral-400 mt-0.5">
              {customerName} <span aria-hidden="true" className="text-neutral-600">·</span> Stakey's Club
            </div>
          )}
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
            Scan at register
          </span>
        </div>
      </div>
    </div>
  );
};
