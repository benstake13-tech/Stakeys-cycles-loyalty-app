import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { UserProfile } from '../types/bikeShop';
import { encodeMembership, STAKEYS_URN_PREFIX } from '../utils/membershipCode';

interface MembershipPassCardProps {
  user: UserProfile;
}

/**
 * Scannable digital membership pass: a QR code plus a CODE128 barcode whose
 * payloads are understood by QRCodeScannerModal.
 */
export const MembershipPassCard: React.FC<MembershipPassCardProps> = ({ user }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const membership = user.membershipNumber || 'STK-000000';
  const payload = encodeMembership(membership);

  useEffect(() => {
    if (!barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, payload, {
        format: 'CODE128',
        displayValue: false,
        height: 56,
        width: 1.6,
        margin: 0,
        background: '#ffffff',
        lineColor: '#0b0d10',
      });
    } catch {
      // Malformed payload — the QR alone still resolves the member.
    }
  }, [payload]);

  return (
    <section
      aria-label="Digital Membership Pass"
      className="w-full rounded-2xl border border-neutral-800 bg-white text-neutral-950 p-5 sm:p-6 shadow-2xl"
    >
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        <div className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-neutral-200">
          <QRCodeSVG
            value={payload}
            size={132}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0b0d10"
            title={`Membership ${membership}`}
          />
        </div>

        <div className="flex-1 w-full text-center sm:text-left">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            Stakey's Cycles &amp; Scooter
          </div>
          <div className="font-display text-xl font-extrabold text-neutral-950 mt-0.5">
            {user.displayName}
          </div>
          <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5">{membership}</div>
          <div className="font-mono text-[10px] text-neutral-400 mt-1">
            {STAKEYS_URN_PREFIX}
            {membership}
          </div>

          <div className="mt-3 rounded-lg bg-white ring-1 ring-neutral-200 p-2 overflow-hidden">
            <svg ref={barcodeRef} className="w-full h-14" aria-label={`Barcode ${membership}`} />
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Present this pass at the till. Staff scan the barcode or QR code to load your account.
          </p>
        </div>
      </div>
    </section>
  );
};
