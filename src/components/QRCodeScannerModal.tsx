import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, X, AlertCircle, Keyboard, Camera, CheckCircle, Upload, SwitchCamera, Award, Ticket, Sparkles, UserCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, DiscountCode } from '../types/bikeShop';
import { wheelAudio } from '../utils/wheelAudio';
import { resolveCustomer, normalizeScannedCode, parseMembershipPayload, MembershipBalance } from '../utils/membershipCode';
import { findDiscountCode } from '../utils/discountService';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerScanned: (customer: UserProfile, scannedBalance?: MembershipBalance) => void;
  /** Optional: fires when the scanned code is not a member but matches a discount code. */
  onDiscountCodeScanned?: (code: DiscountCode) => void;
}

const READER_ID = 'stakeys-scanner-reader';

// Barcode + QR formats a workshop till realistically needs.
const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onCustomerScanned,
  onDiscountCodeScanned,
}) => {
  const { users, discountCodes, resolveScannedMember } = useShop();
  const [manualQuery, setManualQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  // A resolved scan is shown with its balances before it is loaded into the till.
  const [scanResult, setScanResult] = useState<
    { customer: UserProfile; balance?: MembershipBalance } | null
  >(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false); // guards against duplicate frames firing callbacks
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setIsScanning(false);
    if (!scanner) return;
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Already stopped / element detached — safe to ignore.
    }
  }, []);

  // Resolve a decoded string into a customer and act on it.
  const processCode = useCallback(
    async (rawCode: string) => {
      if (handlingRef.current) return;
      // Server-backed member resolution so a scan always binds to the correct
      // account, even on a till that has not cached the full roster.
      const customer = await resolveScannedMember(rawCode);

      if (customer) {
        handlingRef.current = true;
        wheelAudio.playScannerBeep();
        void stopScanner().finally(() => {
          // Show the pass (with its stamps / tickets / points) before loading it,
          // so staff can confirm the balances that came in on the code.
          setScanResult({ customer, balance: parseMembershipPayload(rawCode) });
          handlingRef.current = false;
        });
        return;
      }

      // Not a member — maybe it's a discount code on the till tablet.
      const discount = findDiscountCode(normalizeScannedCode(rawCode), discountCodes || []);
      if (discount && onDiscountCodeScanned) {
        handlingRef.current = true;
        wheelAudio.playScannerBeep();
        void stopScanner().finally(() => {
          onDiscountCodeScanned(discount);
          onClose();
          handlingRef.current = false;
        });
        return;
      }

      const local = resolveCustomer(rawCode, users);
      wheelAudio.playScannerError();
      if (local.status === 'multiple') {
        setErrorMessage(
          `"${normalizeScannedCode(rawCode)}" matches ${local.customers.length} customers — refine the code.`
        );
      } else {
        setErrorMessage(`No registered customer found matching "${normalizeScannedCode(rawCode)}".`);
      }
    },
    [users, discountCodes, onClose, onCustomerScanned, onDiscountCodeScanned, stopScanner, resolveScannedMember]
  );

  const startScanner = useCallback(
    async (cameraIdOrConfig?: string | MediaTrackConstraints) => {
      if (!isOpen) return;
      if (!document.getElementById(READER_ID)) return;

      setCameraError(null);
      setErrorMessage(null);

      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: SCAN_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;

      try {
        setIsScanning(true);
        setStatusMessage('Point the camera at the member barcode or QR code.');
        await scanner.start(
          cameraIdOrConfig || { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
          (decodedText) => processCode(decodedText),
          () => {
            /* per-frame decode misses are expected; ignore */
          }
        );
        setStatusMessage(null);

        // Enumerate cameras once so staff can flip between front/rear or USB tills.
        if (!cameraIdOrConfig) {
          try {
            const devices = await Html5Qrcode.getCameras();
            setCameras(devices.map((d) => ({ id: d.id, label: d.label || 'Camera' })));
            const rearIdx = devices.findIndex((d) => /back|rear|environment/i.test(d.label));
            setActiveCameraIndex(rearIdx >= 0 ? rearIdx : 0);
          } catch {
            /* camera enumeration is best-effort */
          }
        }
      } catch (err: any) {
        setIsScanning(false);
        const msg = String(err?.message || err || '');
        setCameraError(
          /permission|denied|notallowed/i.test(msg)
            ? 'Camera permission denied. Allow camera access or use manual entry below.'
            : 'No usable camera found. Use manual entry below.'
        );
      }
    },
    [isOpen, processCode]
  );

  const flipCamera = useCallback(async () => {
    if (cameras.length < 2) return;
    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);
    await stopScanner();
    await startScanner(cameras[nextIndex].id);
  }, [cameras, activeCameraIndex, stopScanner, startScanner]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      await stopScanner();
      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: SCAN_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = scanner;
      try {
        const decoded = await scanner.scanFileV2(file, false);
        scanner.clear();
        scannerRef.current = null;
        processCode(decoded.decodedText);
      } catch {
        scanner.clear();
        scannerRef.current = null;
        setErrorMessage('Could not read a barcode/QR from that image. Try a clearer photo.');
        wheelAudio.playScannerError();
      }
    },
    [processCode, stopScanner]
  );

  // Start the camera in lock-step with modal visibility.
  useEffect(() => {
    if (isOpen) {
      handlingRef.current = false;
      setManualQuery('');
      setErrorMessage(null);
      setScanResult(null);
      const timer = setTimeout(() => void startScanner(), 250);
      return () => clearTimeout(timer);
    }
    void stopScanner();
  }, [isOpen, startScanner, stopScanner]);

  // Full teardown on unmount.
  useEffect(() => () => void stopScanner(), [stopScanner]);

  if (!isOpen) return null;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    processCode(manualQuery.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Scan className="w-5 h-5 text-emerald-500" /> Scan Member Code
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-black min-h-[240px]">
          <div id={READER_ID} className="w-full [&_video]:w-full [&_video]:rounded-2xl" />

          {scanResult ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0c0e12] p-6 text-center">
              <div className="flex items-center gap-2 text-emerald-400">
                <UserCheck className="w-5 h-5" />
                <span className="text-sm font-bold text-white">{scanResult.customer.displayName}</span>
              </div>
              <div className="font-mono text-xs text-emerald-400">
                {scanResult.customer.membershipNumber}
              </div>

              {scanResult.balance ? (
                <div className="grid w-full max-w-sm grid-cols-3 gap-2 pt-1">
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-2 py-2">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <Award className="w-3 h-3" /> Stamps
                    </div>
                    <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                      {scanResult.balance.stamps}
                      <span className="text-[10px] font-normal text-emerald-400">/10</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-2 py-2">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      <Ticket className="w-3 h-3" /> Tickets
                    </div>
                    <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                      {scanResult.balance.tickets}
                    </div>
                  </div>
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 px-2 py-2">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      <Sparkles className="w-3 h-3" /> Points
                    </div>
                    <div className="font-mono text-xl font-extrabold text-white tabular-nums">
                      {scanResult.balance.points}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500">
                  This code carried no balances — the account will be loaded from the database.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  onCustomerScanned(scanResult.customer, scanResult.balance);
                  onClose();
                }}
                className="mt-1 pressable px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-bold flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Load into till
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanResult(null);
                  void startScanner();
                }}
                className="text-[11px] text-neutral-400 hover:text-white underline"
              >
                Scan another code
              </button>
            </div>
          ) : (
            <>
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 bg-[#0c0e12]">
                  <Camera className="w-8 h-8 text-neutral-600" />
                  <p className="text-xs text-neutral-400">
                    Camera is idle. Tap “Start camera” to scan a barcode or QR code.
                  </p>
                </div>
              )}

              {isScanning && (
                <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-emerald-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              )}
            </>
          )}
        </div>

        {statusMessage && (
          <p className="text-xs text-emerald-300 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> {statusMessage}
          </p>
        )}
        {cameraError && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {cameraError}
          </p>
        )}
        {errorMessage && (
          <p className="text-sm text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!isScanning ? (
            <button
              type="button"
              onClick={() => void startScanner()}
              className="pressable px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Start camera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopScanner()}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold"
            >
              Stop camera
            </button>
          )}

          {cameras.length > 1 && (
            <button
              type="button"
              onClick={() => void flipCamera()}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <SwitchCamera className="w-4 h-4" /> Switch camera
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" /> Scan image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        <form onSubmit={submitManual} className="flex gap-2 pt-1">
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              className="w-full bg-black py-2.5 pl-9 pr-3 rounded-xl border border-neutral-700 text-white text-sm focus:border-emerald-500 outline-none"
              placeholder="Member ID or discount code (e.g. STK-839201)"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded-xl text-white font-bold text-xs"
          >
            Look up
          </button>
        </form>
      </div>
    </div>
  );
};
