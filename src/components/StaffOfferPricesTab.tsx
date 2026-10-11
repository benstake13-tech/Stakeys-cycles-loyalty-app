import React, { useMemo, useState } from 'react';
import { BadgePoundSterling, Plus, RotateCcw, Save, Trash2, Pencil, X, Tag } from 'lucide-react';
import { useOfferPrices, upsertOfferPrice, deleteOfferPrice, resetOfferPrices, OfferPriceEntry } from '../context/OfferPriceBook';
import type { VehicleCategory } from '../types/bikeShop';
import toast from 'react-hot-toast';

const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  cycle: 'Bicycle',
  ebike: 'E-Bike',
  electric_scooter: 'E-Scooter',
  cargo: 'Kids / Cargo',
};

interface Draft {
  id?: string;
  brand: string;
  model: string;
  category: VehicleCategory | '';
  basePrice: string;
  minPrice: string;
  maxPrice: string;
  notes: string;
}

const emptyDraft: Draft = { brand: '', model: '', category: 'cycle', basePrice: '', minPrice: '', maxPrice: '', notes: '' };

/**
 * Staff "Offer Prices" manager for the Sell Your Bike flow. Staff record what
 * the workshop pays for a brand/model; the AI valuation engine reads this book
 * to turn an identified bike into a cash offer. A blank model prices the whole
 * brand; a blank brand+model row is the category fallback.
 */
export const StaffOfferPricesTab: React.FC = () => {
  const entries = useOfferPrices();
  const [draft, setDraft] = useState<Draft | null>(null);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)),
    [entries]
  );

  const startAdd = () => setDraft({ ...emptyDraft });
  const startEdit = (e: OfferPriceEntry) =>
    setDraft({
      id: e.id,
      brand: e.brand,
      model: e.model,
      category: e.category ?? '',
      basePrice: String(e.basePrice),
      minPrice: e.minPrice != null ? String(e.minPrice) : '',
      maxPrice: e.maxPrice != null ? String(e.maxPrice) : '',
      notes: e.notes ?? '',
    });

  const save = () => {
    if (!draft) return;
    const basePrice = Number(draft.basePrice);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      toast.error('Enter a valid offer price.');
      return;
    }
    if (!draft.brand.trim() && !draft.category) {
      toast.error('Add a brand, or pick a category for a fallback price.');
      return;
    }
    upsertOfferPrice({
      id: draft.id,
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      category: (draft.category || undefined) as VehicleCategory | undefined,
      basePrice,
      minPrice: draft.minPrice ? Number(draft.minPrice) : undefined,
      maxPrice: draft.maxPrice ? Number(draft.maxPrice) : undefined,
      notes: draft.notes.trim() || undefined,
    });
    toast.success(draft.id ? 'Price updated.' : 'Price added.');
    setDraft(null);
  };

  return (
    <div className="space-y-6" data-testid="staff-offer-prices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <BadgePoundSterling className="w-5 h-5 text-emerald-400" /> Sell Your Bike — Offer Prices
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            What we pay for each brand/model. The AI offer engine reads this book. Blank model = whole brand; blank brand+model = category fallback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={startAdd}
            className="pressable inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-bold text-neutral-950 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add price
          </button>
          <button type="button" onClick={() => { resetOfferPrices(); toast.success('Price book reset to defaults.'); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {draft && (
        <div className="rounded-2xl border border-emerald-500/40 bg-[#0d1015] p-5 space-y-4" data-testid="offer-price-editor">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{draft.id ? 'Edit price' : 'New price'}</span>
            <button type="button" onClick={() => setDraft(null)} aria-label="Cancel" className="rounded-lg p-1 text-neutral-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Brand (blank = any)</span>
              <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="e.g. Trek"
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Model (blank = whole brand)</span>
              <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="e.g. Marlin 5"
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Category</span>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as VehicleCategory | '' })}
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none">
                <option value="">Any category</option>
                {Object.entries(CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Offer price £ (good condition)</span>
              <input value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })} inputMode="numeric" placeholder="180"
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Min £ (optional)</span>
              <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} inputMode="numeric" placeholder="auto"
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Max £ (optional)</span>
              <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} inputMode="numeric" placeholder="auto"
                className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
          </div>
          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-neutral-400">Notes (optional)</span>
            <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. excludes e-bikes over 5 years"
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
          </label>
          <button type="button" onClick={save}
            className="pressable w-full py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
            <Save className="w-4 h-4" /> {draft.id ? 'Save changes' : 'Add to price book'}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-10 text-center space-y-3">
          <Tag className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">No prices yet</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">Add a brand or category price so the AI can make offers.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li key={e.id} className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-white">
                  {e.brand || 'Any brand'} {e.model ? <span className="text-neutral-300">· {e.model}</span> : <span className="text-neutral-500 text-xs">· whole brand</span>}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {e.category ? CATEGORY_LABEL[e.category] : 'Any category'}
                  {e.notes ? ` · ${e.notes}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-400">£{e.basePrice}</div>
                  {(e.minPrice != null || e.maxPrice != null) && (
                    <div className="text-[10px] text-neutral-500">£{e.minPrice ?? '–'}–£{e.maxPrice ?? '–'}</div>
                  )}
                </div>
                <button type="button" onClick={() => startEdit(e)} aria-label="Edit price"
                  className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => deleteOfferPrice(e.id)} aria-label="Delete price"
                  className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-rose-400 hover:border-rose-500/40 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StaffOfferPricesTab;
