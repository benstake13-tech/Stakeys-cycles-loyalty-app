import React, { useEffect, useMemo, useState } from 'react';
import { Search, Check, X, Bike, Zap, ChevronDown } from 'lucide-react';
import {
  modelsForBrand,
  brandProfileFor,
  isCustomModel,
  brandSections,
  isScooterBrand,
  brandMatchesCategory,
  firstBrandForCategory,
  UNKNOWN_BRAND_NAMES,
  EBIKE_STATUS_OPTIONS,
  EBIKE_MOTOR_SYSTEMS,
  EBIKE_BATTERY_POSITIONS,
  EBIKE_DRIVE_TYPES,
  BIKE_YEAR_OPTIONS,
  EbikeStatus,
} from '../data/bikeCatalog';
import { VehicleCategory } from '../types/bikeShop';

/** The subset of bike identity this component owns. */
export interface BikeIdentityValue {
  category: VehicleCategory;
  brand: string;
  model: string;
  customModel: string;
  colour: string;
  year: string;
  frameSize: string;
  serialNumber: string;
  ebikeStatus: EbikeStatus | '';
  conversionSystem: string;
  batteryPosition: string;
  driveType: string;
  motorDetails: string;
}

export const EMPTY_BIKE_IDENTITY: BikeIdentityValue = {
  category: 'cycle',
  brand: 'Trek',
  model: '',
  customModel: '',
  colour: '',
  year: '',
  frameSize: '',
  serialNumber: '',
  ebikeStatus: '',
  conversionSystem: '',
  batteryPosition: '',
  driveType: '',
  motorDetails: '',
};

interface Props {
  value: BikeIdentityValue;
  onChange: (patch: Partial<BikeIdentityValue>) => void;
  /** Hide the category picker when the parent already chose the vehicle type. */
  showCategory?: boolean;
  /** Show the "already know the model" free-text box even without an Other choice. */
  idPrefix?: string;
}

const fieldClass =
  'w-full bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500';

const labelClass = 'block text-xs font-medium text-neutral-300 mb-1.5';

/**
 * Searchable brand picker. 90+ brands in one flat list is painful on a phone,
 * so the catalogue is split into two alphabetical sections — E-Scooters and
 * Bikes — with a search box that filters across both. The sections honour the
 * vehicle type chosen in the booking's Step 1: picking E-Scooter only offers
 * e-scooter makers (Xiaomi, Segway…), picking Bike only offers bike/e-bike
 * makers (Giant, Trek…), and the "Other / Not Listed" escape hatches always
 * remain so any bike can be booked.
 */
const BrandPicker: React.FC<{
  brand: string;
  category: VehicleCategory;
  onSelect: (brand: string) => void;
  idPrefix: string;
}> = ({ brand, category, onSelect, idPrefix }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const sections = useMemo(() => brandSections(), []);

  const matches = (b: { name: string; country: string; types: string[] }) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.country.toLowerCase().includes(q) ||
      b.types.some((t) => t.toLowerCase().includes(q))
    );
  };

  // Only brands that can actually be that vehicle type — the whole point of
  // choosing e.g. "E-Scooter" in Step 1 is being offered scooter makers only.
  const inCategory = (b: (typeof sections.bikes)[number]) =>
    brandMatchesCategory(b, category) && matches(b);

  const scooterResults = sections.scooters.filter(inCategory);
  const bikeResults = sections.bikes.filter(inCategory);
  const unknownResults = sections.unknown.filter(inCategory);
  const total = scooterResults.length + bikeResults.length + unknownResults.length;

  const selected = brandProfileFor(brand);
  const selectedSection = selected
    ? UNKNOWN_BRAND_NAMES.includes(selected.name)
      ? 'Not sure'
      : isScooterBrand(selected)
      ? 'E-Scooter'
      : 'Bike'
    : '';

  const choose = (name: string) => {
    onSelect(name);
    setOpen(false);
    setQuery('');
  };

  const BrandRow: React.FC<{ b: (typeof sections.bikes)[number] }> = ({ b }) => (
    <button
      type="button"
      onClick={() => choose(b.name)}
      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-neutral-900 cursor-pointer ${
        b.name === brand ? 'bg-emerald-500/10' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="text-sm text-white block truncate">{b.name}</span>
        <span className="text-[10px] text-neutral-500 block truncate">{b.types.join(' · ')}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {b.country !== '—' && <span className="text-[10px] text-neutral-500 font-mono">{b.country}</span>}
        {b.name === brand && <Check className="w-4 h-4 text-emerald-400" />}
      </span>
    </button>
  );

  return (
    <div>
      <label className={labelClass} htmlFor={`${idPrefix}-brand-search`}>
        Manufacturer / Brand
      </label>

      {!open ? (
        <button
          type="button"
          id={`${idPrefix}-brand-search`}
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-2 bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white hover:border-neutral-700 cursor-pointer"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Bike className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{brand || 'Choose a brand'}</span>
            {selectedSection && (
              <span className="text-[10px] text-neutral-500 font-mono shrink-0">{selectedSection}</span>
            )}
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold shrink-0">Change</span>
        </button>
      ) : (
        <div className="border border-neutral-800 rounded-xl bg-[#090b0e] overflow-hidden">
          <div className="flex items-center gap-2 px-3 border-b border-neutral-800">
            <Search className="w-4 h-4 text-neutral-500 shrink-0" />
            <input
              id={`${idPrefix}-brand-search`}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all brands, or type a type (mountain, e-scooter…)"
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery('');
              }}
              className="text-neutral-500 hover:text-white cursor-pointer shrink-0"
              aria-label="Close brand search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {total === 0 ? (
              <div className="px-3 py-4 text-xs text-neutral-400">
                No brand matches “{query}”. Choose <strong>Other / Not Listed</strong> and type the
                brand below.
              </div>
            ) : (
              <>
                {/* Show only the section that belongs to the Step 1 vehicle type. */}
                {category === 'electric_scooter' ? (
                  scooterResults.length > 0 && (
                    <div>
                      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[#0d1015] border-y border-neutral-800/80">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          E-Scooter Brands
                        </span>
                        <span className="text-[10px] text-neutral-500">{scooterResults.length}</span>
                      </div>
                      {scooterResults.map((b) => (
                        <BrandRow key={`scooter-${b.name}`} b={b} />
                      ))}
                    </div>
                  )
                ) : (
                  bikeResults.length > 0 && (
                    <div>
                      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[#0d1015] border-y border-neutral-800/80">
                        <Bike className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          {category === 'ebike' ? 'E-Bike Brands' : 'Bike Brands'}
                        </span>
                        <span className="text-[10px] text-neutral-500">{bikeResults.length}</span>
                      </div>
                      {bikeResults.map((b) => (
                        <BrandRow key={`bike-${b.name}`} b={b} />
                      ))}
                    </div>
                  )
                )}

                {unknownResults.length > 0 && (
                  <div className="border-t border-neutral-800/80">
                    {unknownResults.map((b) => (
                      <BrandRow key={`unknown-${b.name}`} b={b} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Shared bike identity + e-bike conversion capture, used by both the booking
 * form and the garage "Add Bike" form so the two never drift apart.
 */
export const BikeIdentityFields: React.FC<Props> = ({
  value,
  onChange,
  showCategory = true,
  idPrefix = 'bike',
}) => {
  const models = modelsForBrand(value.brand);
  const needsCustomModel = isCustomModel(value.model) || value.brand === 'Other / Not Listed';
  const isEbikeCategory = value.category === 'ebike';
  // E-scooters are never pedal cycles, so the e-bike conversion question does
  // not apply and is removed entirely for that category.
  const isEscooterCategory = value.category === 'electric_scooter';
  const showEbikeQuestions = isEbikeCategory || value.ebikeStatus === 'factory' || value.ebikeStatus === 'converted';

  const handleBrand = (brand: string) => {
    const nextModels = modelsForBrand(brand);
    onChange({ brand, model: nextModels[0] || '', customModel: '' });
  };

  // When the vehicle type changes and the selected brand doesn't build that
  // type (e.g. Xiaomi chosen, then Step 1 switched to "Bike"), drop to the
  // first brand that does rather than leaving a contradictory selection. Only
  // fires on a *category change* — never on first render, so opening "Edit
  // bike details" for an existing scooter keeps its (valid) stored brand.
  const lastCategoryRef = React.useRef(value.category);
  useEffect(() => {
    if (lastCategoryRef.current === value.category) return;
    lastCategoryRef.current = value.category;
    const profile = brandProfileFor(value.brand);
    if (profile && !brandMatchesCategory(profile, value.category)) {
      const next = firstBrandForCategory(value.category);
      const nextModels = modelsForBrand(next);
      onChange({ brand: next, model: nextModels[0] || '', customModel: '' });
    }
  }, [value.category]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {showCategory && (
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-category`}>
            Vehicle Category
          </label>
          <div className="relative">
            <select
              id={`${idPrefix}-category`}
              value={value.category}
              onChange={(e) => onChange({ category: e.target.value as VehicleCategory })}
              className={`${fieldClass} appearance-none cursor-pointer`}
            >
              <option value="cycle">Standard Bicycle (Road / Mountain / Hybrid)</option>
              <option value="ebike">Electric Bicycle (E-Bike)</option>
              <option value="electric_scooter">Electric Scooter</option>
              <option value="cargo">Kids / Cargo / Other</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BrandPicker brand={value.brand} category={value.category} onSelect={handleBrand} idPrefix={idPrefix} />

        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-model`}>
            Model (or Closest Match)
          </label>
          <div className="relative">
            <select
              id={`${idPrefix}-model`}
              value={value.model}
              onChange={(e) => onChange({ model: e.target.value })}
              className={`${fieldClass} appearance-none cursor-pointer`}
            >
              {models.map((m) => (
                <option key={m} value={m} className="bg-neutral-950 text-white">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">{models.length} models known for this brand</p>
        </div>
      </div>

      {needsCustomModel && (
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-custom-model`}>
            Type the model name
          </label>
          <input
            id={`${idPrefix}-custom-model`}
            type="text"
            value={value.customModel}
            onChange={(e) => onChange({ customModel: e.target.value })}
            placeholder="e.g. Vintage Sprint, Dual Hardtail"
            className={fieldClass}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-year`}>
            Year
          </label>
          <div className="relative">
            <select
              id={`${idPrefix}-year`}
              value={value.year}
              onChange={(e) => onChange({ year: e.target.value })}
              className={`${fieldClass} appearance-none cursor-pointer`}
            >
              <option value="">Not set</option>
              {BIKE_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y} className="bg-neutral-950 text-white">
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-colour`}>
            Colour
          </label>
          <input
            id={`${idPrefix}-colour`}
            type="text"
            value={value.colour}
            onChange={(e) => onChange({ colour: e.target.value })}
            placeholder="Matte Black"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-frame`}>
            Frame Size
          </label>
          <input
            id={`${idPrefix}-frame`}
            type="text"
            value={value.frameSize}
            onChange={(e) => onChange({ frameSize: e.target.value })}
            placeholder="M / 54cm"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-serial`}>
            Serial No.
          </label>
          <input
            id={`${idPrefix}-serial`}
            type="text"
            value={value.serialNumber}
            onChange={(e) => onChange({ serialNumber: e.target.value })}
            placeholder="Optional"
            className={fieldClass}
          />
        </div>
      </div>

      {/* ---- E-bike conversion question (asked for every bike except e-scooters) ---- */}
      {!isEscooterCategory && (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-white">
            Has this bike been converted to an e-bike, or is it a factory e-bike?
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EBIKE_STATUS_OPTIONS.map((opt) => {
            const active = value.ebikeStatus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ebikeStatus: active ? '' : opt.id })}
                title={opt.description}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/50'
                    : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <span className={`text-[11px] font-semibold block ${active ? 'text-white' : 'text-neutral-300'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-neutral-500 block leading-snug mt-0.5">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>

        {showEbikeQuestions && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className={labelClass} htmlFor={`${idPrefix}-motor`}>
                Motor / System
              </label>
              <div className="relative">
                <select
                  id={`${idPrefix}-motor`}
                  value={value.conversionSystem}
                  onChange={(e) => onChange({ conversionSystem: e.target.value })}
                  className={`${fieldClass} appearance-none cursor-pointer`}
                >
                  <option value="">Not sure / Other</option>
                  {EBIKE_MOTOR_SYSTEMS.map((m) => (
                    <option key={m} value={m} className="bg-neutral-950 text-white">
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${idPrefix}-battery`}>
                Battery Position
              </label>
              <div className="relative">
                <select
                  id={`${idPrefix}-battery`}
                  value={value.batteryPosition}
                  onChange={(e) => onChange({ batteryPosition: e.target.value })}
                  className={`${fieldClass} appearance-none cursor-pointer`}
                >
                  <option value="">Not sure</option>
                  {EBIKE_BATTERY_POSITIONS.map((b) => (
                    <option key={b} value={b} className="bg-neutral-950 text-white">
                      {b}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${idPrefix}-drive`}>
                Drive Type
              </label>
              <div className="relative">
                <select
                  id={`${idPrefix}-drive`}
                  value={value.driveType}
                  onChange={(e) => onChange({ driveType: e.target.value })}
                  className={`${fieldClass} appearance-none cursor-pointer`}
                >
                  <option value="">Not sure</option>
                  {EBIKE_DRIVE_TYPES.map((d) => (
                    <option key={d} value={d} className="bg-neutral-950 text-white">
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {value.ebikeStatus === 'converted' && (
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            Thanks — converted bikes get an extra safety check of the wiring, battery mount,
            controller and torque arms.
          </p>
        )}

        {showEbikeQuestions && (
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-motor-notes`}>
              Motor / Battery Notes (Optional)
            </label>
            <input
              id={`${idPrefix}-motor-notes`}
              type="text"
              value={value.motorDetails}
              onChange={(e) => onChange({ motorDetails: e.target.value })}
              placeholder="e.g. 750W kit fitted 2023, battery only holds 20 miles"
              className={fieldClass}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
};

/** Build the persisted BikeDetails payload from the form value (omitting blanks). */
export function toBikeDetails(value: BikeIdentityValue) {
  const details: Record<string, string> = {};
  if (value.ebikeStatus) details.ebikeStatus = value.ebikeStatus;
  if (value.conversionSystem) details.conversionSystem = value.conversionSystem;
  if (value.batteryPosition) details.batteryPosition = value.batteryPosition;
  if (value.driveType) details.driveType = value.driveType;
  if (value.motorDetails) details.motorDetails = value.motorDetails;
  if (value.serialNumber) details.serialNumber = value.serialNumber;
  if (value.frameSize) details.frameSize = value.frameSize;
  if (value.year) details.year = value.year;
  return Object.keys(details).length ? details : undefined;
}

/** Resolve the final model string, preferring a typed custom model. */
export function resolveModel(value: BikeIdentityValue): string {
  if (isCustomModel(value.model) && value.customModel.trim()) return value.customModel.trim();
  return value.model;
}

/**
 * Build an editable form value from an existing bike, so the same identity form
 * can pre-fill "Edit bike details". When a bike's stored model is not one of the
 * catalogue's options for its brand (a scanned or free-typed model) it goes into
 * `customModel` and the model dropdown falls back to a custom entry, so saving
 * without touching it does not discard the real model.
 */
export function identityFromBike(bike: {
  category: VehicleCategory;
  brand: string;
  model: string;
  colour?: string;
  year?: string | number;
  serialNumber?: string;
  frameSizeOrNotes?: string;
  bikeDetails?: {
    ebikeStatus?: string;
    conversionSystem?: string;
    batteryPosition?: string;
    driveType?: string;
    motorDetails?: string;
    frameSize?: string;
    year?: string;
    serialNumber?: string;
  };
}): BikeIdentityValue {
  const details = bike.bikeDetails || {};
  const known = modelsForBrand(bike.brand);
  const modelInCatalog = known.includes(bike.model);
  return {
    category: bike.category,
    brand: bike.brand || 'Other / Not Listed',
    model: modelInCatalog ? bike.model : 'Other Model',
    customModel: modelInCatalog ? '' : bike.model || '',
    colour: bike.colour || '',
    year: String(bike.year || details.year || ''),
    frameSize: bike.frameSizeOrNotes || details.frameSize || '',
    serialNumber: bike.serialNumber || details.serialNumber || '',
    ebikeStatus: (details.ebikeStatus as BikeIdentityValue['ebikeStatus']) || '',
    conversionSystem: details.conversionSystem || '',
    batteryPosition: details.batteryPosition || '',
    driveType: details.driveType || '',
    motorDetails: details.motorDetails || '',
  };
}

/** True when the rider said this is (or was converted into) an e-bike. */
export function isEbike(value: BikeIdentityValue): boolean {
  return (
    value.category === 'ebike' ||
    value.ebikeStatus === 'factory' ||
    value.ebikeStatus === 'converted'
  );
}
