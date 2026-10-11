import React, { useMemo, useState } from 'react';
import { Search, ChevronRight, Check, Plus, Pencil, BookOpen } from 'lucide-react';
import type { VehicleCategory } from '../types/bikeShop';
import type { OfferPriceEntry } from '../context/OfferPriceBook';
import { buildCatalogue, filterCatalogue, filterByCategory, type CatalogueModel } from '../data/offerCatalogue';

export interface CataloguePick {
  brand: string;
  /** Empty means "price the whole brand". */
  model: string;
  category?: VehicleCategory;
}

interface Props {
  book: OfferPriceEntry[];
  onPick: (pick: CataloguePick) => void;
}

const CATEGORY_FILTERS: { id: VehicleCategory | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'cycle', label: 'Bicycle' },
  { id: 'ebike', label: 'E-Bike' },
  { id: 'electric_scooter', label: 'E-Scooter' },
  { id: 'cargo', label: 'Kids / Cargo' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * Browsable brand & model catalogue for the Sell Your Bike price book. Staff
 * pick a bike from the same catalogue riders book with, and either tune the
 * existing price or add a new one — no need to recall exact model names. Brands
 * with prices show a green count; unpriced models show a one-tap "Add price".
 */
export const OfferCatalogue: React.FC<Props> = ({ book, onPick }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<VehicleCategory | ''>('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const all = useMemo(() => buildCatalogue(book), [book]);
  const brands = useMemo(
    () => filterByCategory(filterCatalogue(all, query), category),
    [all, query, category]
  );

  const totalModels = useMemo(() => all.reduce((n, b) => n + b.models.length, 0), [all]);
  const pricedModels = useMemo(() => all.reduce((n, b) => n + b.pricedModels, 0), [all]);

  const toggle = (name: string) => setExpanded((cur) => (cur === name ? null : name));

  const ModelRow: React.FC<{ brand: string; model: CatalogueModel }> = ({ brand, model }) => (
    <button
      type="button"
      onClick={() => onPick({ brand, model: model.name, category: model.category })}
      data-testid={`catalogue-model-${slug(brand)}-${slug(model.name)}`}
      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-neutral-900/70 cursor-pointer"
    >
      <span className="flex items-center gap-2 min-w-0">
        {model.entry ? (
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <Plus className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
        )}
        <span className="text-sm text-neutral-200 truncate">{model.name}</span>
      </span>
      {model.entry ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-xs font-bold text-emerald-400">
            {model.conditionRange ?? `£${model.entry.basePrice}`}
          </span>
          <Pencil className="w-3 h-3 text-neutral-500" />
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-neutral-500 shrink-0">Add price</span>
      )}
    </button>
  );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-5 space-y-4" data-testid="offer-catalogue">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" /> Brand &amp; model catalogue
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Pick a bike to set or tune its offer price. {brands.length} brand{brands.length === 1 ? '' : 's'} shown ·{' '}
            {totalModels} models · {pricedModels} priced.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand or model…"
            aria-label="Search brand or model"
            data-testid="offer-catalogue-search"
            className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm pl-9 pr-3 py-2.5 focus:border-emerald-500/50 outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              onClick={() => setCategory(f.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer border ${
                category === f.id
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {brands.length === 0 ? (
        <p className="text-xs text-neutral-500 py-6 text-center">No brands match “{query}”.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto pr-1 space-y-1" data-testid="offer-catalogue-list">
          {brands.map((b) => {
            const open = expanded === b.name;
            return (
              <div key={b.name} className="rounded-xl border border-neutral-800/70 overflow-hidden">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggle(b.name)}
                    aria-expanded={open}
                    data-testid={`catalogue-brand-${slug(b.name)}`}
                    className="flex-1 text-left flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-neutral-900/60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                      <span className="text-sm font-semibold text-white truncate">{b.name}</span>
                      <span className="text-[10px] text-neutral-500 shrink-0">{b.country}</span>
                    </span>
                    <span className="text-[11px] shrink-0">
                      {b.brandEntry ? (
                        <span className="font-mono font-bold text-emerald-400">£{b.brandEntry.basePrice} brand-wide</span>
                      ) : b.pricedModels > 0 ? (
                        <span className="text-emerald-400/80">{b.pricedModels}/{b.models.length} priced</span>
                      ) : (
                        <span className="text-neutral-500">{b.models.length} models</span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick({ brand: b.name, model: '', category: b.isScooter ? 'electric_scooter' : undefined })}
                    title={`Price the whole ${b.name} brand`}
                    aria-label={`Price whole ${b.name} brand`}
                    className="shrink-0 px-2.5 py-2.5 text-neutral-500 hover:text-emerald-400 cursor-pointer border-l border-neutral-800/70"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {open && (
                  <div className="border-t border-neutral-800/70 bg-[#090b0e] p-1.5">
                    {!b.hasCuratedModels && (
                      <p className="px-3 pt-1.5 pb-1 text-[11px] text-neutral-500">
                        No curated models — price the whole brand, or add a model below.
                      </p>
                    )}
                    {b.models.map((m) => (
                      <ModelRow key={m.raw} brand={b.name} model={m} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OfferCatalogue;
