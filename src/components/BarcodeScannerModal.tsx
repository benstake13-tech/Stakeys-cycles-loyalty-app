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
import { Html5Qrcode } from 'html5-qrcode';

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
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const customerList = users.filter((u) => u.role === 'customer');

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setScanQuery('');
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const html5QrCode = new Html5Qrcode('reader');
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          processBarcode(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors during continuous scan
        }
      );
      
      setIsCameraActive(true);
    } catch (err: any) {
      setCameraError('Camera access was denied or is restricted.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setIsCameraActive(false);
  };

  const processBarcode = (rawCode: string) => {
    setErrorMessage(null);
    const clean = rawCode.trim().toUpperCase();

    if (!clean) return;

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

        <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 p-2">
          {isCameraActive ? (
            <div className="relative w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <div id="reader" className="w-full" />
              <button
                type="button"
                onClick={stopCamera}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-semibold z-10"
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

        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="block text-xs font-semibold text-neutral-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Barcode Value or Member ID</span>
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

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-200 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
