import React, { useMemo, useState } from 'react';
import { Search, Check, X, Bike, Zap, ChevronDown } from 'lucide-react';
import {
  BIKE_BRAND_PROFILES,
  BIKE_BRAND_TYPES,
  BikeBrandType,
  modelsForBrand,
  brandProfileFor,
  isCustomModel,
  EBIKE_STATUS_OPTIONS,
  EBIKE_MOTOR_SYSTEMS,
  EBIKE_BATTERY_POSITIONS,
  EBIKE_DRIVE_TYPES,
  BIKE_YEAR_OPTIONS,
  EbikeStatus,
} from '../data/bikeCatalog';
import { EV_SYSTEM_VOLTAGE_OPTIONS } from '../data/evReference';
import { EvReferenceGuide } from './EvReferenceGuide';
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
  systemVoltage: string;
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
  systemVoltage: '',
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
 * Searchable brand picker. A plain <select> with 90+ options is painful on a
 * phone, so this filters by name, type tag or country as the rider types.
 */
const BrandPicker: React.FC<{
  brand: string;
  onSelect: (brand: string) => void;
  idPrefix: string;
}> = ({ brand, onSelect, idPrefix }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<BikeBrandType | 'All'>('All');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BIKE_BRAND_PROFILES.filter((b) => {
      if (typeFilter !== 'All' && !b.types.includes(typeFilter)) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.country.toLowerCase().includes(q) ||
        b.types.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, typeFilter]);

  const selected = brandProfileFor(brand);

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
            {selected && selected.country !== '—' && (
              <span className="text-[10px] text-neutral-500 font-mono shrink-0">{selected.country}</span>
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
              placeholder="Search 90+ brands, or type a type (mountain, e-bike…)"
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

          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-neutral-800/80">
            {(['All', ...BIKE_BRAND_TYPES] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t as BikeBrandType | 'All')}
                className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap cursor-pointer border transition-colors ${
                  typeFilter === t
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="max-h-56 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-4 text-xs text-neutral-400">
                No brand matches “{query}”. Choose <strong>Other / Not Listed</strong> and type the
                brand below.
              </div>
            ) : (
              results.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => {
                    onSelect(b.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-neutral-900 cursor-pointer ${
                    b.name === brand ? 'bg-emerald-500/10' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="text-sm text-white block truncate">{b.name}</span>
                    <span className="text-[10px] text-neutral-500 block truncate">
                      {b.types.join(' · ')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {b.country !== '—' && (
                      <span className="text-[10px] text-neutral-500 font-mono">{b.country}</span>
                    )}
                    {b.name === brand && <Check className="w-4 h-4 text-emerald-400" />}
                  </span>
                </button>
              ))
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
  const showEbikeQuestions = isEbikeCategory || value.ebikeStatus === 'factory' || value.ebikeStatus === 'converted';

  const handleBrand = (brand: string) => {
    const nextModels = modelsForBrand(brand);
    onChange({ brand, model: nextModels[0] || '', customModel: '' });
  };

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
        <BrandPicker brand={value.brand} onSelect={handleBrand} idPrefix={idPrefix} />

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

      {/* ---- E-bike conversion question (asked for every bike) ---- */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
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
              <label className={labelClass} htmlFor={`${idPrefix}-voltage`}>
                System Voltage
              </label>
              <div className="relative">
                <select
                  id={`${idPrefix}-voltage`}
                  value={value.systemVoltage}
                  onChange={(e) => onChange({ systemVoltage: e.target.value })}
                  className={`${fieldClass} appearance-none cursor-pointer`}
                >
                  <option value="">Not sure</option>
                  {EV_SYSTEM_VOLTAGE_OPTIONS.map((v) => (
                    <option key={v} value={v} className="bg-neutral-950 text-white">
                      {v}
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

        {showEbikeQuestions && <EvReferenceGuide idPrefix={idPrefix} />}
      </div>
    </div>
  );
};

/** Build the persisted BikeDetails payload from the form value (omitting blanks). */
export function toBikeDetails(value: BikeIdentityValue) {
  const details: Record<string, string> = {};
  if (value.ebikeStatus) details.ebikeStatus = value.ebikeStatus;
  if (value.conversionSystem) details.conversionSystem = value.conversionSystem;
  if (value.batteryPosition) details.batteryPosition = value.batteryPosition;
  if (value.systemVoltage) details.systemVoltage = value.systemVoltage;
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

/** True when the rider said this is (or was converted into) an e-bike. */
export function isEbike(value: BikeIdentityValue): boolean {
  return (
    value.category === 'ebike' ||
    value.ebikeStatus === 'factory' ||
    value.ebikeStatus === 'converted'
  );
}
