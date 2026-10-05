import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Leaf, Snowflake, Zap } from 'lucide-react';
import { VehicleCategory } from '../types/bikeShop';
import {
  MAINTENANCE_PACKAGES,
  MaintenancePackage,
  MaintenanceSeason,
} from '../data/maintenancePackages';

interface Props {
  /** Only packages that apply to this vehicle type are offered. */
  vehicleCategory: VehicleCategory;
  selectedPackageId?: string;
  onSelect: (pkg: MaintenancePackage) => void;
}

const SEASON_STYLE: Record<MaintenanceSeason, { chip: string; icon: React.ReactNode }> = {
  winter: {
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    icon: <Snowflake className="w-3 h-3" />,
  },
  summer: {
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: <Leaf className="w-3 h-3" />,
  },
  all: {
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: <Zap className="w-3 h-3" />,
  },
};

/** Preventative-maintenance packages filtered to the vehicle being booked. */
export const MaintenancePackagesPanel: React.FC<Props> = ({
  vehicleCategory,
  selectedPackageId,
  onSelect,
}) => {
  const packages = useMemo(
    () => MAINTENANCE_PACKAGES.filter((p) => p.appliesTo.includes(vehicleCategory)),
    [vehicleCategory]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (packages.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
        <CalendarClock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Standardised seasonal tune-ups with a fixed checklist. Prices are indicative — confirmed on
          inspection.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packages.map((pkg) => {
          const style = SEASON_STYLE[pkg.season];
          const selected = selectedPackageId === pkg.id;
          const open = openId === pkg.id;
          return (
            <div
              key={pkg.id}
              className={`p-4 rounded-xl border transition-all flex flex-col ${
                selected
                  ? 'bg-neutral-900 border-emerald-500/60 shadow-sm'
                  : 'bg-neutral-950/70 border-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className={`text-xs font-semibold ${selected ? 'text-white' : 'text-neutral-200'}`}>
                  {pkg.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${style.chip}`}
                >
                  {style.icon}
                  {pkg.seasonLabel}
                </span>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">{pkg.tagline}</p>

              <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <span>From £{pkg.indicativePrice} · {pkg.duration}</span>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : pkg.id)}
                  aria-expanded={open}
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  {open ? 'Hide' : "What's included"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {open && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-neutral-400 leading-relaxed">{pkg.description}</p>
                  <ul className="space-y-1.5">
                    {pkg.checks
                      .filter((c) => c.appliesTo.includes(vehicleCategory))
                      .map((c) => (
                        <li key={c.id} className="flex gap-2 text-[11px] text-neutral-300 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            {c.label}
                            {c.note && <span className="block text-[10px] text-neutral-500">{c.note}</span>}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    Recommended: {pkg.recommendedInterval}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => onSelect(pkg)}
                className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  selected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#05C147] hover:bg-emerald-400 text-neutral-950'
                }`}
              >
                {selected ? 'Selected' : 'Book this package'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MaintenancePackagesPanel;
