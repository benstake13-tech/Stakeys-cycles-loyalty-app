import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scan, X, AlertCircle, Keyboard, Camera, CheckCircle, Upload, SwitchCamera, Award, Ticket, Sparkles, UserCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { UserProfile, DiscountCode } from '../types/bikeShop';
import { WebProduct } from '../types/websiteContent';
import { wheelAudio } from '../utils/wheelAudio';
import { resolveCustomer, normalizeScannedCode, parseMembershipPayload, MembershipBalance } from '../utils/membershipCode';
import { findDiscountCode } from '../utils/discountService';
import { resolveItemByCode } from '../utils/itemCode';
import { useWebsiteContent } from '../context/WebsiteContentStore';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerScanned: (customer: UserProfile, scannedBalance?: MembershipBalance) => void;
  /** Optional: fires when the scanned code is not a member but matches a discount code. */
  onDiscountCodeScanned?: (code: DiscountCode) => void;
  /** Optional: fires when the scanned code matches an item for sale (QR on a bike/part). */
  onItemScanned?: (product: WebProduct) => void;
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
  onItemScanned,
}) => {
  const { users, discountCodes, resolveScannedMemberDetailed } = useShop();
  const webContent = useWebsiteContent();
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
  // Set the instant a payload is detected so the scanner stops continuous frame
  // detection and never re-arms until staff explicitly ask for the next code.
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false); // guards against duplicate frames firing callbacks
  const processingRef = useRef(false); // synchronous twin of isProcessing
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Incremented every time the camera is (re)started. A decode callback captures
  // the session it belongs to and is ignored once a newer session has begun, so a
  // frame from a torn-down scanner can never resolve against the current UI.
  const scanSessionRef = useRef(0);
  // True between "start" and the camera settling. A second tap of "Start camera"
  // (or a flip during startup) is ignored so two Html5Qrcode instances can never
  // fight over the same <div> — the classic scanner flicker.
  const startingRef = useRef(false);

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

  // Set the instant a payload is detected so the scanner stops continuous frame
  // detection and never re-arms until staff explicitly ask for the next code.
  const pauseScanner = useCallback(() => {
    processingRef.current = true;
    setIsProcessing(true);
    // Stop immediately so no further frame can fire a second decode while we resolve.
    void stopScanner();
  }, [stopScanner]);

  const resumeScanner = useCallback(() => {
    processingRef.current = false;
    setIsProcessing(false);
  }, []);

  // Resolve a decoded string into a customer and act on it. `session` ties the
  // decode to the camera run that produced it; if the modal closed, the camera
  // was flipped, or "Scan Next" started a new run while the lookup was in flight,
  // the result is stale and must not touch the UI.
  const processCode = useCallback(
    async (rawCode: string, session: number = scanSessionRef.current) => {
      // Duplicate-frame guard. The scanner has already been paused the moment the
      // payload was detected, but a frame can still be in flight — never resolve twice.
      if (handlingRef.current) return;
      handlingRef.current = true;
      const isStale = () => session !== scanSessionRef.current;

      const clean = normalizeScannedCode(rawCode);
      // Server-backed member resolution so a scan always binds to the correct
      // account, even on a till that has not cached the full roster.
      const { customer, error: lookupError } = await resolveScannedMemberDetailed(rawCode);

      // The lookup is async — the camera may have been stopped, flipped, or the
      // modal closed while it ran. Drop the result rather than mutating the UI.
      // The guard is released when the next run starts, not here, so a stale
      // return can never clear the guard of a run that is still in flight.
      if (isStale()) return;

      if (customer) {
        wheelAudio.playScannerBeep();
        // Show the pass (with its stamps / tickets / points) before loading it,
        // so staff can confirm the balances that came in on the code.
        setScanResult({ customer, balance: parseMembershipPayload(rawCode) });
        return;
      }

      // Not a member — maybe it's a discount code on the till tablet.
      const discount = findDiscountCode(clean, discountCodes || []);
      if (discount && onDiscountCodeScanned) {
        wheelAudio.playScannerBeep();
        onDiscountCodeScanned(discount);
        onClose();
        return;
      }

      // Not a member or discount — maybe it's an item for sale (QR on a bike/part).
      const item = resolveItemByCode(rawCode, webContent.products || []);
      if (item && onItemScanned) {
        wheelAudio.playScannerBeep();
        onItemScanned(item);
        onClose();
        return;
      }

      // Nothing resolved. Never reset quietly: log the underlying Supabase/RLS
      // failure and surface an explicit alert so staff know the scan failed.
      wheelAudio.playScannerError();
      if (lookupError) {
        console.error('[SCANNER] Supabase lookup failed for', clean, '—', lookupError);
      } else {
        console.warn('[SCANNER] No profile matched scanned code', clean);
      }

      const local = resolveCustomer(rawCode, users);
      const reason =
        local.status === 'multiple'
          ? `"${clean}" matches ${local.customers.length} customers — refine the code.`
          : lookupError
          ? `User not found or access denied. (${lookupError})`
          : 'User not found or access denied.';
      setErrorMessage(reason);
      window.alert(reason);
      // Keep the scanner paused so it cannot loop on the same unreadable code;
      // staff must press "Scan Next QR Code" to try again.
    },
    [users, discountCodes, onClose, onDiscountCodeScanned, onItemScanned, webContent, resolveScannedMemberDetailed]
  );

  const startScanner = useCallback(
    async (cameraIdOrConfig?: string | MediaTrackConstraints) => {
      if (!isOpen) return;
      // Never re-arm while a payload is being processed — that is the loop we are fixing.
      if (processingRef.current) return;
      // Ignore a second start while the previous one is still settling.
      if (startingRef.current) return;
      if (!document.getElementById(READER_ID)) return;

      // A new camera run supersedes any decode still in flight, so release the
      // duplicate-frame guard here (the session bump below invalidates the old one).
      handlingRef.current = false;

      setCameraError(null);
      setErrorMessage(null);

      // Every start begins a new camera session. Frames carrying an older session
      // id are ignored, so a slow-to-tear-down scanner cannot feed a stale decode.
      scanSessionRef.current += 1;
      const session = scanSessionRef.current;
      startingRef.current = true;

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
          (decodedText) => {
            // A code was detected: pause continuous detection FIRST, then resolve it.
            if (processingRef.current) return;
            if (session !== scanSessionRef.current) return;
            pauseScanner();
            void processCode(decodedText, session);
          },
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
      } finally {
        startingRef.current = false;
      }
    },
    [isOpen, processCode, pauseScanner]
  );

  // Latest startScanner, so the visibility effect can restart the camera without
  // depending on its (frequently re-created) identity.
  const startScannerRef = useRef(startScanner);
  startScannerRef.current = startScanner;

  const flipCamera = useCallback(async () => {
    if (cameras.length < 2) return;
    if (processingRef.current) return;
    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);
    await stopScanner();
    await startScanner(cameras[nextIndex].id);
  }, [cameras, activeCameraIndex, stopScanner, startScanner]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      // A photo payload counts as a detection: pause immediately so the camera
      // cannot re-arm or double-handle while the image is decoded.
      pauseScanner();
      await stopScanner();
      // A photo decode is its own session so the (now stopped) camera's frames
      // can never be confused with this result.
      scanSessionRef.current += 1;
      const session = scanSessionRef.current;
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
        processCode(decoded.decodedText, session);
      } catch {
        scanner.clear();
        scannerRef.current = null;
        if (session !== scanSessionRef.current) return;
        setErrorMessage('Could not read a barcode/QR from that image. Try a clearer photo.');
        wheelAudio.playScannerError();
        // Stay paused; staff choose "Scan Next QR Code" to retry.
      }
    },
    [processCode, stopScanner, pauseScanner]
  );

  // Start the camera in lock-step with modal visibility. Depends ONLY on `isOpen`
  // (plus the stable stopScanner): startScanner is read through a ref so a
  // re-render can never tear down a resolved scan and silently restart scanning.
  useEffect(() => {
    if (isOpen) {
      handlingRef.current = false;
      processingRef.current = false;
      setIsProcessing(false);
      setManualQuery('');
      setErrorMessage(null);
      setScanResult(null);
      const timer = setTimeout(() => void startScannerRef.current(), 250);
      return () => clearTimeout(timer);
    }
    // Closing invalidates any in-flight decode before the camera tears down.
    scanSessionRef.current += 1;
    startingRef.current = false;
    void stopScanner();
  }, [isOpen, stopScanner]);

  // Full teardown on unmount.
  useEffect(() => () => void stopScanner(), [stopScanner]);

  if (!isOpen) return null;

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    // Manual entry behaves like a detection: pause so the camera cannot also fire.
    pauseScanner();
    // Own session so any frame still in flight from the camera is ignored.
    scanSessionRef.current += 1;
    void processCode(manualQuery.trim(), scanSessionRef.current);
  };

  // Explicitly clear the pause and re-arm. The ONLY place scanning resumes after
  // a detection, so the modal can never loop back on its own.
  const scanNextCode = () => {
    // Release the duplicate-frame guard for the new run. A decode that was still
    // in flight for the previous run is invalidated by the session bump below.
    handlingRef.current = false;
    resumeScanner();
    setScanResult(null);
    setErrorMessage(null);
    void startScanner();
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
                  // Explicit navigation/action trigger: hand the resolved customer
                  // to the portal, which opens their profile/action screen.
                  onCustomerScanned(scanResult.customer, scanResult.balance);
                  onClose();
                }}
                className="mt-1 pressable px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-bold flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Load into till
              </button>
            </div>
          ) : isProcessing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0c0e12] p-6 text-center">
              {errorMessage ? (
                <>
                  <AlertCircle className="w-8 h-8 text-rose-400" />
                  <p className="text-sm font-semibold text-rose-300">{errorMessage}</p>
                </>
              ) : (
                <>
                  <span className="h-6 w-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  <p className="text-xs text-emerald-300">Code detected — looking up member…</p>
                </>
              )}
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
        {errorMessage && !isProcessing && (
          <p className="text-sm text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isProcessing ? (
            <button
              type="button"
              onClick={scanNextCode}
              className="pressable px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Scan className="w-4 h-4" /> Scan Next QR Code
            </button>
          ) : !isScanning ? (
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
