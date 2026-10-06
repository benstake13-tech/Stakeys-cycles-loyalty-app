import React, { useState } from 'react';
import { ShoppingCart, Info, X, Package, Tag, Layers, CheckCircle } from 'lucide-react';
import type { WebProduct } from '../types/websiteContent';
import { itemCodeForProduct } from '../utils/itemCode';

interface ItemScanModalProps {
  product: WebProduct;
  isDark: boolean;
  onSell: () => void;
  onClose: () => void;
}

/**
 * What staff see after scanning an item's QR code at the till: either sell it
 * straight away, or open its full details first.
 */
export const ItemScanModal: React.FC<ItemScanModalProps> = ({ product, isDark, onSell, onClose }) => {
  const [showDetails, setShowDetails] = useState(false);
  const panel = isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const soldOut = product.stock <= 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`rounded-3xl border max-w-md w-full p-6 shadow-2xl space-y-4 ${panel}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" /> Item Scanned
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item scan"
            className={`${muted} hover:text-emerald-500 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-4">
          {product.image && (
            <img
              src={product.image}
              alt={product.name}
              className="h-24 w-24 shrink-0 rounded-2xl object-cover border border-neutral-500/30"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-lg font-black leading-tight truncate">{product.name || 'Untitled item'}</p>
            <p className={`font-mono text-[11px] ${muted}`}>{itemCodeForProduct(product.id)}</p>
            <p className="text-2xl font-black text-emerald-500">
              £{Number(product.price || 0).toFixed(2)}
              {product.wasPrice != null && product.wasPrice > product.price && (
                <span className={`ml-2 text-sm font-semibold line-through ${muted}`}>
                  £{Number(product.wasPrice).toFixed(2)}
                </span>
              )}
            </p>
            <p className={`text-xs font-semibold ${soldOut ? 'text-rose-400' : muted}`}>
              {soldOut ? 'Out of stock' : `${product.stock} in stock`}
            </p>
          </div>
        </div>

        {showDetails && (
          <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl border border-neutral-500/20 p-4 text-xs ${muted}`}>
            <dt className="flex items-center gap-1.5 font-bold uppercase tracking-wider"><Layers className="w-3 h-3" /> Category</dt>
            <dd className={isDark ? 'text-neutral-200' : 'text-neutral-800'}>{product.category}</dd>
            <dt className="flex items-center gap-1.5 font-bold uppercase tracking-wider"><Tag className="w-3 h-3" /> Code</dt>
            <dd className={`font-mono ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>{itemCodeForProduct(product.id)}</dd>
            <dt className="font-bold uppercase tracking-wider">Description</dt>
            <dd className={`${isDark ? 'text-neutral-200' : 'text-neutral-800'} col-span-2 leading-relaxed`}>
              {product.description?.trim() || 'No description on file.'}
            </dd>
          </dl>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={soldOut}
            onClick={onSell}
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-neutral-950"
          >
            <ShoppingCart className="w-4 h-4" /> Sell this item
          </button>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-600 px-4 py-2.5 text-sm font-semibold hover:bg-neutral-800/40"
          >
            {showDetails ? <CheckCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {showDetails ? 'Hide details' : 'View item details'}
          </button>
        </div>
      </div>
    </div>
  );
};
