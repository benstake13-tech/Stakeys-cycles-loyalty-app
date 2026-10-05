import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Search, BatteryCharging, ShieldAlert, Wrench, Scale } from 'lucide-react';
import {
  EV_VOLTAGE_CLASSES,
  ESCOOTER_BRANDS,
  EBIKE_DRIVE_SYSTEMS,
  CONVERSION_KIT_MAKERS,
  EV_RANGE_RULES,
  EV_LEGAL_NOTES,
  EV_BATTERY_SAFETY,
  EvBrandSpec,
} from '../shared/data/evReference';

const cardClass = 'rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden';
const thClass =
  'text-left text-[10px] uppercase tracking-wide text-neutral-500 font-semibold px-3 py-2 whitespace-nowrap';
const tdClass = 'px-3 py-2 align-top text-neutral-300';

interface Props {
  /** Start expanded. */
  defaultOpen?: boolean;
  idPrefix?: string;
}

const matches = (spec: EvBrandSpec, q: string) =>
  !q ||
  [spec.name, spec.country, spec.models, spec.note, spec.voltages.join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(q);

const BrandTable: React.FC<{ specs: EvBrandSpec[]; idPrefix: string }> = ({ specs, idPrefix }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs border-collapse" id={`${idPrefix}-ev-brand-table`}>
      <thead>
        <tr className="border-b border-neutral-800">
          <th className={thClass}>Brand</th>
          <th className={thClass}>Origin</th>
          <th className={thClass}>Voltage</th>
          <th className={thClass}>Battery</th>
          <th className={thClass}>Motor</th>
        </tr>
      </thead>
      <tbody>
        {specs.map((s) => (
          <tr key={s.name} className="border-b border-neutral-900 last:border-0">
            <td className={`${tdClass} text-white font-semibold`}>
              {s.name}
              <span className="block text-[10px] text-neutral-500 font-normal mt-0.5">{s.models}</span>
            </td>
            <td className={tdClass}>{s.country}</td>
            <td className={`${tdClass} text-emerald-400 font-mono`}>{s.voltages.join(' / ')}</td>
            <td className={tdClass}>{s.battery}</td>
            <td className={tdClass}>
              {s.motor}
              <span className="block text-[10px] text-amber-300/80 mt-0.5">{s.note}</span>
            </td>
          </tr>
        ))}
        {specs.length === 0 && (
          <tr>
            <td className={`${tdClass} text-neutral-500`} colSpan={5}>
              No matches.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

/**
 * Workshop reference for e-scooters, e-bikes and conversion kits — brands,
 * voltages, batteries, drive systems, reputable kit makers, and the UK legal /
 * battery-safety picture. Self-contained: mount it wherever it is useful.
 */
export const EvReferenceGuide: React.FC<Props> = ({ defaultOpen = false, idPrefix = 'ev' }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const scooters = useMemo(() => ESCOOTER_BRANDS.filter((s) => matches(s, q)), [q]);
  const ebikes = useMemo(() => EBIKE_DRIVE_SYSTEMS.filter((s) => matches(s, q)), [q]);
  const kits = useMemo(
    () =>
      CONVERSION_KIT_MAKERS.filter(
        (k) =>
          !q ||
          [k.name, k.country, k.system, k.bestFor, k.note, k.voltages.join(' ')]
            .join(' ')
            .toLowerCase()
            .includes(q)
      ),
    [q]
  );

  return (
    <div className={cardClass} id={`${idPrefix}-ev-reference`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-3 cursor-pointer hover:bg-neutral-900/50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">
            E-Scooter &amp; E-Bike Reference — brands, voltages, kits &amp; safety
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-4 space-y-4 border-t border-neutral-800">
          <div className="flex items-center gap-2 mt-3 rounded-lg border border-neutral-800 bg-[#090b0e] px-3">
            <Search className="w-4 h-4 text-neutral-500 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brands, voltages, motors, kit makers…"
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
          </div>

          {/* Voltage classes */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <BatteryCharging className="w-4 h-4" /> Voltage classes
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className={thClass}>Nominal</th>
                    <th className={thClass}>Cells</th>
                    <th className={thClass}>Full charge</th>
                    <th className={thClass}>Typically found on</th>
                  </tr>
                </thead>
                <tbody>
                  {EV_VOLTAGE_CLASSES.map((v) => (
                    <tr key={v.voltage} className="border-b border-neutral-900 last:border-0">
                      <td className={`${tdClass} text-emerald-400 font-mono font-semibold`}>{v.voltage}</td>
                      <td className={`${tdClass} font-mono`}>{v.series}</td>
                      <td className={`${tdClass} font-mono`}>{v.fullCharge}</td>
                      <td className={tdClass}>{v.whereSeen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* E-scooter brands */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <BatteryCharging className="w-4 h-4" /> E-scooter brands ({scooters.length})
            </h4>
            <BrandTable specs={scooters} idPrefix={`${idPrefix}-scooter`} />
          </section>

          {/* Factory e-bike systems */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <Wrench className="w-4 h-4" /> Factory e-bike drive systems ({ebikes.length})
            </h4>
            <BrandTable specs={ebikes} idPrefix={`${idPrefix}-ebike`} />
          </section>

          {/* Conversion kit makers */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <Wrench className="w-4 h-4" /> Reputable conversion-kit makers ({kits.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className={thClass}>Maker</th>
                    <th className={thClass}>System</th>
                    <th className={thClass}>Voltage</th>
                    <th className={thClass}>Best for</th>
                  </tr>
                </thead>
                <tbody>
                  {kits.map((k) => (
                    <tr key={k.name} className="border-b border-neutral-900 last:border-0">
                      <td className={`${tdClass} text-white font-semibold`}>
                        {k.name}
                        <span className="block text-[10px] text-neutral-500 font-normal mt-0.5">{k.country}</span>
                      </td>
                      <td className={tdClass}>{k.system}</td>
                      <td className={`${tdClass} text-emerald-400 font-mono`}>{k.voltages.join(' / ')}</td>
                      <td className={tdClass}>
                        {k.bestFor}
                        <span className="block text-[10px] text-amber-300/80 mt-0.5">{k.note}</span>
                      </td>
                    </tr>
                  ))}
                  {kits.length === 0 && (
                    <tr>
                      <td className={`${tdClass} text-neutral-500`} colSpan={4}>
                        No matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Range rules of thumb */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-400">
              <BatteryCharging className="w-4 h-4" /> Battery capacity &amp; range rules of thumb
            </h4>
            <ul className="space-y-1">
              {EV_RANGE_RULES.map((r) => (
                <li key={r} className="text-[11px] text-neutral-300 leading-relaxed flex gap-2">
                  <span className="text-emerald-400 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </section>

          {/* UK legal */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-sky-400">
              <Scale className="w-4 h-4" /> UK legal position
            </h4>
            <ul className="space-y-1">
              {EV_LEGAL_NOTES.map((r) => (
                <li key={r} className="text-[11px] text-neutral-300 leading-relaxed flex gap-2">
                  <span className="text-sky-400 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </section>

          {/* Battery safety */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-400">
              <ShieldAlert className="w-4 h-4" /> Battery safety
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EV_BATTERY_SAFETY.map((s) => (
                <div key={s.title} className="rounded-lg border border-neutral-800 bg-[#090b0e] p-2.5">
                  <span className="text-[11px] font-semibold text-white block">{s.title}</span>
                  <span className="text-[10px] text-neutral-400 block leading-snug mt-0.5">{s.detail}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default EvReferenceGuide;
