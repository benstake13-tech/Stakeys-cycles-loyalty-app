import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, QrCode, Tag } from 'lucide-react';
import type { WebProduct } from '../types/websiteContent';
import { encodeItemCode, itemCodeForProduct } from '../utils/itemCode';

interface ItemQrModalProps {
  product: WebProduct;
  isDark: boolean;
  onClose: () => void;
}

/**
 * The printable label for a single item for sale. Its QR encodes
 * `ITEM-<id>|urn:stakeys:item:ITEM-<id>`, which the till scanner resolves back
 * to this product so staff can sell it or open its details from the shop floor.
 */
export const ItemQrModal: React.FC<ItemQrModalProps> = ({ product, isDark, onClose }) => {
  const code = itemCodeForProduct(product.id);
  const payload = encodeItemCode(product.id);

  const panel = isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`rounded-3xl border max-w-sm w-full p-6 shadow-2xl space-y-4 ${panel}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-500" /> Item QR Code
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item QR code"
            className={`${muted} hover:text-emerald-500 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="item-qr-printable" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-500/40 p-5 bg-white text-neutral-900">
          <div className="text-center">
            <p className="text-sm font-black leading-tight">{product.name || 'Untitled item'}</p>
            <p className="font-mono text-[11px] text-neutral-500 mt-0.5">{code}</p>
          </div>
          <QRCodeSVG value={payload} size={180} level="M" marginSize={2} />
          <div className="flex items-center gap-1 text-xs font-bold text-neutral-700">
            <Tag className="w-3.5 h-3.5" /> £{Number(product.price || 0).toFixed(2)}
          </div>
        </div>

        <p className={`text-[11px] ${muted}`}>
          Scan this at the till to sell the item or open its details. Re-printing the
          same item always produces the same code.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="pressable flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-bold text-neutral-950"
          >
            <Printer className="w-4 h-4" /> Print label
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-600 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800/40"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
