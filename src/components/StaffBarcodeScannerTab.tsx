/**
 * Dedicated Staff Barcode Scanning Interface (`src/components/StaffBarcodeScannerTab.tsx`)
 * Listens for hardware barcode scanner input events (keyboard wedge) and camera scans 
 * to automatically fetch and display a customer's profile, bypassing manual search.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Scan, UserCheck, Search, CheckCircle, AlertCircle, Camera, Barcode, ArrowRight, Shield } from 'lucide-react';
import { UserProfile } from '../types/bikeShop';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface StaffBarcodeScannerTabProps {
  users: UserProfile[];
  onSelectCustomer: (customer: UserProfile) => void;
}

export const StaffBarcodeScannerTab: React.FC<StaffBarcodeScannerTabProps> = ({
  users,
  onSelectCustomer,
}) => {
  const safeUsers = users || [];
  const [scanInput, setScanInput] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'listening' | 'success' | 'error'>('listening');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<UserProfile | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Keyboard wedge listener for physical barcode scanners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Scanners type very quickly (< 50ms per key). If typing is slow, reset buffer.
      if (timeDiff > 100) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const scannedCode = bufferRef.current.trim();
        if (scannedCode.length >= 3) {
          processScannedCode(scannedCode);
        }
        bufferRef.current = '';
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [safeUsers]);

  const processScannedCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    setLastScannedCode(clean);

    const found = safeUsers.find(
      (u) =>
        u.role === 'customer' &&
        (u.membershipNumber?.toUpperCase() === clean ||
          u.uid.toUpperCase() === clean ||
          u.email.toUpperCase() === clean)
    );

    if (found) {
      setMatchedCustomer(found);
      setScanStatus('success');
      setErrorMessage(null);
      onSelectCustomer(found);
    } else {
      setMatchedCustomer(null);
      setScanStatus('error');
      setErrorMessage(`No customer found matching barcode/membership "${clean}".`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanInput.trim()) {
      processScannedCode(scanInput);
      setScanInput('');
    }
  };

  const handleCameraScanSuccess = (code: string) => {
    setIsCameraScannerOpen(false);
    processScannedCode(code);
  };

  return (
    <div className="space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Scan className="w-48 h-48 text-emerald-400" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Active Barcode &amp; Membership Scanner Station
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Instant Customer Profile Lookup
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Ready for live scanning. Point your USB/Bluetooth barcode scanner at customer membership cards, or use device camera scanning to automatically pull up accounts without manual typing.
          </p>
        </div>
      </div>

      {/* Main Scanner Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input & Wedge Status */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Barcode className="w-5 h-5 text-emerald-400" />
                Hardware Wedge &amp; Manual Scanner
              </h3>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Listening for Scans
              </div>
            </div>

            <p className="text-xs text-neutral-400">
              Laser/CCD barcode readers will automatically populate and trigger customer lookup upon scan. You can also test by typing or pasting a membership number below:
            </p>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan barcode or enter STK-XXXXXX..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-2xl pl-10 pr-24 py-3 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 shadow-inner"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all"
                >
                  Lookup
                </button>
              </div>
            </form>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setIsCameraScannerOpen(true)}
                className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border border-neutral-700 shadow-lg"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Open Device Camera Barcode Scanner</span>
              </button>
            </div>
          </div>

          {/* Quick Test Barcodes */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2.5">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Quick Test Membership Barcodes:
            </div>
            <div className="flex flex-wrap gap-2">
              {safeUsers.filter((u) => u.role === 'customer').slice(0, 4).map((c) => (
                <button
                  key={c.uid}
                  onClick={() => processScannedCode(c.membershipNumber)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Barcode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{c.membershipNumber}</span>
                  <span className="text-neutral-400 text-[10px]">({c.displayName.split(' ')[0]})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Scan Result & Customer Preview */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                Scan Result &amp; Target Profile
              </h3>
              {lastScannedCode && (
                <span className="text-xs font-mono text-neutral-400">
                  Last Code: <strong className="text-white">{lastScannedCode}</strong>
                </span>
              )}
            </div>

            {scanStatus === 'listening' && !matchedCustomer && (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto text-neutral-400 animate-pulse">
                  <Scan className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="text-sm font-bold text-neutral-300">Awaiting Barcode Scan...</div>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                  Scan a customer barcode card with your laser reader or click one of the quick test barcodes on the left.
                </p>
              </div>
            )}

            {scanStatus === 'error' && (
              <div className="py-8 px-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                <div className="text-sm font-bold text-red-300">Scan Unrecognized</div>
                <p className="text-xs text-red-400/90">{errorMessage}</p>
              </div>
            )}

            {scanStatus === 'success' && matchedCustomer && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Customer Successfully Matched &amp; Loaded</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                    Active Session
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-black text-white">{matchedCustomer.displayName}</h4>
                      <p className="text-xs font-mono text-emerald-400">{matchedCustomer.membershipNumber}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-white">
                        {matchedCustomer.stamps || 0} / 10 Stamps
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        {matchedCustomer.tickets || 0} Prize Tickets
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800 text-xs">
                    <div>
                      <span className="text-neutral-500 block">Email:</span>
                      <span className="text-neutral-300 font-mono truncate">{matchedCustomer.email}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Phone:</span>
                      <span className="text-neutral-300 font-mono">{matchedCustomer.phoneNumber || 'Not provided'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCustomer(matchedCustomer)}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <span>Open Full Account Dossier &amp; Add Stamps</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 text-center text-[11px] text-neutral-500 font-mono">
            Hardware wedge listener active on all keystrokes.
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      {isCameraScannerOpen && (
        <BarcodeScannerModal
          isOpen={isCameraScannerOpen}
          onClose={() => setIsCameraScannerOpen(false)}
          onCustomerScanned={(cust) => {
            setIsCameraScannerOpen(false);
            processScannedCode(cust.membershipNumber);
          }}
        />
      )}
    </div>
  );
};
