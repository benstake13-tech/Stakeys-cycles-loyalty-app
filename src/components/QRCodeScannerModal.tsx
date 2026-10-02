import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scanner.render(onScanSuccess, onScanError);
        scannerRef.current = scanner;
      }, 300);
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [isOpen]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
  };

  const onScanSuccess = (decodedText: string) => {
    processCode(decodedText);
  };

  const onScanError = (error: any) => {};

  const processCode = (rawCode: string) => {
    setErrorMessage(null);
    const clean = rawCode.trim();

    const found = users.find((u) => u.uid === clean || u.membershipNumber === clean);

    if (found) {
      wheelAudio.playScannerBeep();
      stopScanner();
      onCustomerScanned(found);
      onClose();
    } else {
      wheelAudio.playScannerError();
      setErrorMessage(`No registered customer found matching "${rawCode}".`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Scan className="text-emerald-500"/> Scan QR Code</h3>
          <button onClick={onClose} className="text-neutral-400">✕</button>
        </div>
        <div id="qr-reader" className="w-full"></div>
        <form onSubmit={(e) => { e.preventDefault(); processCode(scanQuery); }} className="flex gap-2">
          <input 
            value={scanQuery} 
            onChange={e => setScanQuery(e.target.value)} 
            className="flex-1 bg-black p-3 rounded-xl border border-neutral-700 text-white" 
            placeholder="Or type Member ID..."
          />
          <button type="submit" className="bg-emerald-600 px-4 rounded-xl text-white font-bold">Scan</button>
        </form>
        {errorMessage && <p className="text-rose-400 text-sm">{errorMessage}</p>}
      </div>
    </div>
  );
};
