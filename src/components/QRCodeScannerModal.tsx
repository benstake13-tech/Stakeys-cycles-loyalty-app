import React, { useEffect, useRef, useState } from 'react';
import { Scan, Camera, X, AlertCircle, Keyboard } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile } from '../types/bikeShop';
import { wheelAudio } from '../utils/wheelAudio';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerScanned: (customer: UserProfile) => void;
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onCustomerScanned,
}) => {
  const { users } = useShop();
  const [scanQuery, setScanQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handledRef = useRef(false);
  const usersRef = useRef(users);
  const callbackRef = useRef(onCustomerScanned);
  const onCloseRef = useRef(onClose);

  usersRef.current = users;
  callbackRef.current = onCustomerScanned;
  onCloseRef.current = onClose;

  const processCode = (rawCode: string) => {
    if (handledRef.current) return;
    const code = rawCode.trim().toUpperCase();
    setErrorMessage(null);
    if (!code) {
      setErrorMessage('Please enter a membership number.');
      return;
    }
    const found = usersRef.current.find((user) =>
      user.role === 'customer' &&
      (user.uid.toUpperCase() === code || user.membershipNumber.toUpperCase() === code)
    );

    if (!found) {
      try { wheelAudio.playScannerError(); } catch { /* sound optional */ }
      setErrorMessage('No matching customer is currently available in the staff records.');
      return;
    }
    handledRef.current = true;
    try { wheelAudio.playScannerBeep(); } catch { /* sound optional */ }
    callbackRef.current(found);
    onCloseRef.current();
  };

  useEffect(() => {
    if (!isOpen) return;
    handledRef.current = false;
    setScanQuery('');
    setErrorMessage(null);

    // Wait until React mounts the scanner element; clear the timer on close.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const scanner = new Html5QrcodeScanner(
          'stakeys-qr-reader',
          { fps: 10, qrbox: { width: 230, height: 230 } },
          false
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText: string) => processCode(decodedText),
          () => { /* Individual missed frames are normal. */ }
        );
      } catch {
        setErrorMessage('Camera scanning is unavailable on this device. Enter the member number below.');
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.clear().catch(() => {});
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label="Scan customer member card"
        className="bg-[#11181b] border border-emerald-500/25 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center gap-4 pb-3 border-b border-neutral-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Scan className="text-emerald-400 w-5 h-5" />Scan Member Card</h3>
          <button type="button" onClick={onClose} aria-label="Close scanner"
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-neutral-400 flex gap-2 items-center"><Camera className="h-4 w-4" />Allow camera access when prompted, or enter the membership number manually.</p>
        <div id="stakeys-qr-reader" className="w-full bg-white rounded-xl overflow-hidden" />
        <form onSubmit={(event) => { event.preventDefault(); processCode(scanQuery); }} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="stakeys-scan-code" className="sr-only">Member ID</label>
          <input id="stakeys-scan-code" value={scanQuery}
            onChange={(event) => setScanQuery(event.target.value)}
            className="min-w-0 flex-1 bg-neutral-950 p-3 rounded-xl border border-neutral-700 text-white text-sm"
            placeholder="Type member ID" />
          <button type="submit" className="flex justify-center items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 px-4 py-3 rounded-xl text-neutral-950 font-bold text-sm"><Keyboard className="w-4 h-4" />Look up</button>
        </form>
        {errorMessage && <p role="alert" className="text-amber-300 text-xs flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{errorMessage}</p>}
      </div>
    </div>
  );
};
