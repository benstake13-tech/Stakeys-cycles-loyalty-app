import React, { useEffect, useMemo, useState } from 'react';
import { BadgePoundSterling, Plus, RotateCcw, Save, Trash2, Pencil, X, Tag } from 'lucide-react';
import { useOfferPrices, upsertOfferPrice, deleteOfferPrice, resetOfferPrices, syncOfferPricesFromSupabase, OfferPriceEntry, CONDITION_ORDER, type CustomerCondition, type ConditionPricePoint } from '../context/OfferPriceBook';
import type { VehicleCategory } from '../types/bikeShop';
import { OfferCatalogue, CataloguePick } from './OfferCatalogue';
import { findEntry } from '../data/offerCatalogue';
import toast from 'react-hot-toast';

const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  cycle: 'Bicycle',
  ebike: 'E-Bike',
  electric_scooter: 'E-Scooter',
  cargo: 'Kids / Cargo',
};

type ConditionDraft = Record<CustomerCondition, { price: string; maxPrice: string }>;

const emptyConditions = (): ConditionDraft =>
  Object.fromEntries(CONDITION_ORDER.map((c) => [c, { price: '', maxPrice: '' }])) as ConditionDraft;

/** Build the editable condition table from a saved row (or blank for a new one). */
const conditionsFrom = (entry?: OfferPriceEntry): ConditionDraft => {
  const base = emptyConditions();
  for (const c of CONDITION_ORDER) {
    const point = entry?.conditionPrices?.[c];
    if (point) {
      base[c] = { price: String(point.price), maxPrice: point.maxPrice != null ? String(point.maxPrice) : '' };
    }
  }
  return base;
};

/** Turn the editable table back into the stored map (drops empty grades). */
const conditionsToPoints = (draft: ConditionDraft): Partial<Record<CustomerCondition, ConditionPricePoint>> | undefined => {
  const out: Partial<Record<CustomerCondition, ConditionPricePoint>> = {};
  for (const c of CONDITION_ORDER) {
    const price = Number(draft[c].price);
    if (!draft[c].price.trim() || !Number.isFinite(price) || price < 0) continue;
    const max = Number(draft[c].maxPrice);
    out[c] = { price, maxPrice: Number.isFinite(max) && max >= price ? max : undefined };
  }
  return Object.keys(out).length ? out : undefined;
};

/** A compact "£10–£40" summary of a row's explicit condition prices. */
const conditionRange = (entry: OfferPriceEntry): string | null => {
  const points = CONDITION_ORDER.map((c) => entry.conditionPrices?.[c]).filter(Boolean) as ConditionPricePoint[];
  if (!points.length) return null;
  const lows = points.map((p) => p.price);
  const highs = points.map((p) => p.maxPrice ?? p.price);
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  return lo === hi ? `£${lo}` : `£${lo}–£${hi}`;
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
  conditions: ConditionDraft;
}

const emptyDraft: Draft = { brand: '', model: '', category: 'cycle', basePrice: '', minPrice: '', maxPrice: '', notes: '', conditions: emptyConditions() };

/**
 * Staff "Offer Prices" manager for the Sell Your Bike flow. Staff record what
 * the workshop pays for a specific model; the AI valuation engine reads this
 * book to turn an identified bike into a cash offer. Prices are always per
 * model — a blank brand+model row is the category fallback.
 */
export const StaffOfferPricesTab: React.FC = () => {
  const entries = useOfferPrices();
  const [draft, setDraft] = useState<Draft | null>(null);

  // Pull the workshop's saved book on open so a price set on another terminal
  // shows here without a reload.
  useEffect(() => {
    void syncOfferPricesFromSupabase(true);
  }, []);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)),
    [entries]
  );

  const startAdd = () => setDraft({ ...emptyDraft, conditions: emptyConditions() });
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
      conditions: conditionsFrom(e),
    });

  /** Prefill the editor from a catalogue pick — edit the price if it exists. */
  const startFromPick = (pick: CataloguePick) => {
    const existing = findEntry(entries, pick.brand, pick.model);
    setDraft({
      id: existing?.id,
      brand: pick.brand,
      model: pick.model,
      category: existing?.category ?? pick.category ?? 'cycle',
      basePrice: existing ? String(existing.basePrice) : '',
      minPrice: existing?.minPrice != null ? String(existing.minPrice) : '',
      maxPrice: existing?.maxPrice != null ? String(existing.maxPrice) : '',
      notes: existing?.notes ?? '',
      conditions: conditionsFrom(existing),
    });
  };

  const save = () => {
    if (!draft) return;
    const points = conditionsToPoints(draft.conditions);
    const typedBase = Number(draft.basePrice);
    const hasTypedBase = draft.basePrice.trim() !== '' && Number.isFinite(typedBase) && typedBase >= 0;
    const goodPrice = Number(points?.good?.price);
    const hasGoodPrice = Number.isFinite(goodPrice) && goodPrice >= 0;
    // A base (good-condition) price is required — typed directly, or taken from
    // the good row of the condition table.
    const basePrice = hasTypedBase ? typedBase : hasGoodPrice ? goodPrice : NaN;
    if (!Number.isFinite(basePrice)) {
      toast.error('Enter a good-condition price (the base offer, or the good row).');
      return;
    }
    if (!draft.brand.trim() && !draft.category) {
      toast.error('Add a brand, or pick a category for a fallback price.');
      return;
    }
    if (draft.brand.trim() && !draft.model.trim()) {
      toast.error('Add a model — prices are set per model, not per brand.');
      return;
    }
    if (!draft.brand.trim() && draft.model.trim()) {
      toast.error('Add a brand for this model.');
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
      conditionPrices: points,
      notes: draft.notes.trim() || undefined,
    });
    toast.success(draft.id ? 'Price updated.' : 'Price added.');
    setDraft(null);
  };

  /** Update one cell of the condition table. */
  const setCondition = (c: CustomerCondition, key: 'price' | 'maxPrice', value: string) =>
    setDraft((d) => (d ? { ...d, conditions: { ...d.conditions, [c]: { ...d.conditions[c], [key]: value } } } : d));

  return (
    <div className="space-y-6" data-testid="staff-offer-prices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <BadgePoundSterling className="w-5 h-5 text-emerald-400" /> Sell Your Bike — Offer Prices
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            What we pay for each model. The AI offer engine reads this book. Prices are per model; a blank brand+model row is the category fallback.
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

      <OfferCatalogue book={entries} onPick={startFromPick} />

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
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Model</span>
              <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="e.g. Marlin 5"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Category</span>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as VehicleCategory | '' })}
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none">
                <option value="">Any category</option>
                {Object.entries(CATEGORY_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Base offer £ (good condition)</span>
              <input value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: e.target.value,
                conditions: { ...draft.conditions, good: { ...draft.conditions.good, price: e.target.value } } })} inputMode="numeric" placeholder="180"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Min £ (optional)</span>
              <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} inputMode="numeric" placeholder="auto"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Max £ (optional)</span>
              <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} inputMode="numeric" placeholder="auto"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
          </div>

          <div className="surface-panel p-3 space-y-2" data-testid="offer-price-conditions">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-neutral-300">Offer by condition</span>
              <button type="button"
                onClick={() => setDraft({ ...draft, conditions: { ...emptyConditions(), good: { price: draft.basePrice, maxPrice: '' } } })}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer">
                Set good = base
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">
              Exact £ we pay at each grade. Leave a grade blank and customers see no price for it — the workshop confirms by hand.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONDITION_ORDER.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs capitalize text-neutral-300">{c}</span>
                  <span className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">£</span>
                    <input
                      value={draft.conditions[c].price}
                      onChange={(e) => setCondition(c, 'price', e.target.value)}
                      inputMode="numeric"
                      aria-label={`${c} price`}
                      placeholder="auto"
                      className="w-full surface-panel text-neutral-200 text-sm py-2 pl-6 pr-2 focus:border-emerald-500/50 outline-none"
                    />
                  </span>
                  <span className="text-neutral-500 text-xs shrink-0">to</span>
                  <span className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">£</span>
                    <input
                      value={draft.conditions[c].maxPrice}
                      onChange={(e) => setCondition(c, 'maxPrice', e.target.value)}
                      inputMode="numeric"
                      aria-label={`${c} max price`}
                      placeholder="max"
                      className="w-full surface-panel text-neutral-200 text-sm py-2 pl-6 pr-2 focus:border-emerald-500/50 outline-none"
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-neutral-400">Notes (optional)</span>
            <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. excludes e-bikes over 5 years"
              className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
          </label>
          <button type="button" onClick={save}
            className="pressable w-full py-2.5 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
            <Save className="w-4 h-4" /> {draft.id ? 'Save changes' : 'Add to price book'}
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="surface-panel p-10 text-center space-y-3">
          <Tag className="w-8 h-8 text-neutral-500 mx-auto" />
          <div className="font-display text-base font-bold text-white">No prices yet</div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">Add a brand or category price so the AI can make offers.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li key={e.id} className="surface-panel p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-bold text-white">
                  {e.brand || 'Any brand'}{' '}
                  {e.model ? (
                    <span className="text-neutral-300">· {e.model}</span>
                  ) : e.brand ? (
                    <span className="text-amber-400/80 text-xs">· no model — set a model price</span>
                  ) : (
                    <span className="text-neutral-500 text-xs">· category fallback</span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {e.category ? CATEGORY_LABEL[e.category] : 'Any category'}
                  {e.notes ? ` · ${e.notes}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-400">£{e.basePrice}</div>
                  {conditionRange(e) ? (
                    <div className="text-[10px] text-neutral-500">{conditionRange(e)}</div>
                  ) : (e.minPrice != null || e.maxPrice != null) ? (
                    <div className="text-[10px] text-neutral-500">£{e.minPrice ?? '–'}–£{e.maxPrice ?? '–'}</div>
                  ) : null}
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
