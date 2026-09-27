import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Zap,
  ShieldCheck,
  VideoOff,
  Keyboard,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile } from '../types/bikeShop';
import { wheelAudio } from '../utils/wheelAudio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerScanned: (customer: UserProfile) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onCustomerScanned,
}) => {
  const { users } = useShop();
  const [scanQuery, setScanQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const customerList = users.filter((u) => u.role === 'customer');

  // Autofocus input whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setScanQuery('');
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  // Hardware barcode gun listener (rapid key sequence ending with Enter)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input element other than our scanner, let it be
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          processBarcode(buffer);
          buffer = '';
        }
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 120) {
        buffer = ''; // timeout between keys: reset buffer
      }
      lastKeyTime = now;

      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, users]);

  // Start Camera Feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);

      // Check for native BarcodeDetector API support
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'upc_a'],
          });

          const detectInterval = setInterval(async () => {
            if (!videoRef.current || !isCameraActive) {
              clearInterval(detectInterval);
              return;
            }
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  clearInterval(detectInterval);
                  processBarcode(detectedVal);
                }
              }
            } catch {
              // Frame scan error
            }
          }, 300);
        } catch {
          // BarcodeDetector not available
        }
      }
    } catch (err: any) {
      setCameraError(
        'Camera access was denied or is restricted in this window. You can type or click below to scan.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Process barcode input and resolve customer
  const processBarcode = (rawCode: string) => {
    setErrorMessage(null);
    const clean = rawCode.trim().toUpperCase();

    if (!clean) return;

    // Search customers by:
    // 1. Membership Number (e.g. STK-839201)
    // 2. Barcode value / clean alphanumeric match
    // 3. Customer UID
    // 4. Customer Email
    // 5. Customer Phone
    const found = users.find((u) => {
      if (u.role !== 'customer') return false;
      const mem = (u.membershipNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const searchClean = clean.replace(/[^A-Z0-9]/g, '');

      return (
        u.membershipNumber.toUpperCase() === clean ||
        (searchClean.length >= 4 && mem.includes(searchClean)) ||
        u.uid.toUpperCase() === clean ||
        u.email.toUpperCase() === clean ||
        (u.phoneNumber && u.phoneNumber.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, ''))
      );
    });

    if (found) {
      wheelAudio.playScannerBeep();
      stopCamera();
      onCustomerScanned(found);
      onClose();
    } else {
      wheelAudio.playScannerError();
      setErrorMessage(`No registered customer found matching barcode "${rawCode}".`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcode(scanQuery);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#05C147] to-emerald-400 flex items-center justify-center text-neutral-950 font-bold shadow-md shadow-emerald-500/15">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white tracking-tight">
                Scan Customer Barcode / Pass
              </h3>
              <p className="text-xs text-neutral-400">
                Point till scanner at member's phone or search by ID.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Camera Viewfinder or Camera Toggle */}
        <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 p-2">
          {isCameraActive ? (
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Target reticle */}
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_#05C147] animate-pulse" />
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold"
              >
                Stop Camera
              </button>
            </div>
          ) : (
            <div className="py-6 px-4 text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Camera className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Optical Camera Scanner
                </h4>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto mt-0.5">
                  Scan barcode directly using front or rear device camera.
                </p>
              </div>

              {cameraError && (
                <div className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800/60 max-w-sm mx-auto">
                  {cameraError}
                </div>
              )}

              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Start Camera Scanner</span>
              </button>
            </div>
          )}
        </div>

        {/* Barcode Search / Laser Input */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="block text-xs font-semibold text-neutral-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Barcode Value or Member ID</span>
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              Hardware Scanner Ready
            </span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={scanQuery}
                onChange={(e) => setScanQuery(e.target.value)}
                placeholder="Scan or type barcode (e.g. STK-839201)..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/20 shrink-0"
            >
              <Scan className="w-4 h-4" />
              <span>Scan</span>
            </button>
          </div>
        </form>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1-Click Fast Rider Barcodes (Instant Simulator) */}
        <div className="pt-2 border-t border-neutral-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quick Test Barcodes</span>
            </span>
            <span className="text-[10px] text-neutral-400">Click to simulate scan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {customerList.slice(0, 4).map((cust) => (
              <button
                key={cust.uid}
                type="button"
                onClick={() => processBarcode(cust.membershipNumber)}
                className="p-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 text-left transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="font-bold text-white text-xs group-hover:text-emerald-300">
                    {cust.displayName}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-400">
                    {cust.membershipNumber}
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 text-emerald-400 border border-neutral-800">
                    {cust.stamps || 0}/10 🎟️
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
