import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Wrench,
  Search,
  BatteryCharging,
  Cpu,
  Gauge,
  CircleDollarSign,
  ShoppingCart,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { EVEHICLE_BRANDS, EVehicleCategory, EVehicleDisplay, EVehicleErrorDefinition, displaysForCategory } from '../data/eVehicleCodes';
import {
  customerCodesFor,
  customerCodesForFamily,
  matchBySymptom,
  partForKey,
  buildRetailerLinks,
} from '../data/eVehicleCustomerInfo';

const SYSTEM_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  bms: { label: 'Battery / BMS', icon: <BatteryCharging className="w-3.5 h-3.5" />, tone: 'text-emerald-300' },
  controller: { label: 'Controller', icon: <Cpu className="w-3.5 h-3.5" />, tone: 'text-sky-300' },
  display: { label: 'Display / Comms', icon: <Gauge className="w-3.5 h-3.5" />, tone: 'text-violet-300' },
  motor: { label: 'Motor', icon: <Gauge className="w-3.5 h-3.5" />, tone: 'text-amber-300' },
  throttle: { label: 'Throttle', icon: <Gauge className="w-3.5 h-3.5" />, tone: 'text-orange-300' },
  brake: { label: 'Brake', icon: <AlertTriangle className="w-3.5 h-3.5" />, tone: 'text-rose-300' },
  charging: { label: 'Charging / Lights', icon: <BatteryCharging className="w-3.5 h-3.5" />, tone: 'text-teal-300' },
};

const SEVERITY_STYLE: Record<string, string> = {
  Low: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  High: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const DIFFICULTY_STYLE: Record<string, string> = {
  DIY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Easy: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Intermediate: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Workshop only': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

/** GBP range formatter. */
function gbp(range?: [number, number]): string {
  if (!range) return '';
  const [a, b] = range;
  if (a === 0 && b === 0) return 'Free check';
  if (a === b) return `£${a}`;
  return `£${a}–£${b}`;
}

const POPULAR_BRANDS = ['Xiaomi', 'Segway / Ninebot', 'Vsett', 'Kaabo', 'Dualtron', 'Bosch', 'Shimano', 'Rad Power Bikes'];

function useBrandIndex() {
  return useMemo(() => {
    const map = new Map<string, { category: EVehicleCategory; models: string[] }>();
    for (const entry of EVEHICLE_BRANDS) {
      const existing = map.get(entry.brand);
      if (existing) {
        existing.models.push(...entry.models);
      } else {
        map.set(entry.brand, { category: entry.category, models: [...entry.models] });
      }
    }
    const brands = [...map.keys()].sort((a, b) => {
      const pa = POPULAR_BRANDS.indexOf(a);
      const pb = POPULAR_BRANDS.indexOf(b);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      return a.localeCompare(b);
    });
    return { map, brands };
  }, []);
}

function RetailerLinks({ partKey, model }: { partKey: string; model: string }) {
  const links = buildRetailerLinks(partKey, model);
  if (!links.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.retailer}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          title={l.note}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900/70 px-2 py-1 text-[10px] font-bold text-neutral-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
        >
          {l.retailer}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      ))}
    </div>
  );
}

function PartRow({ partKey, model }: { partKey: string; model: string }) {
  const part = partForKey(partKey);
  if (!part) return null;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-white">{part.label}</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-neutral-400">{part.note}</p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-300">
          {gbp(part.priceRange)}
        </span>
      </div>
      <RetailerLinks partKey={partKey} model={model} />
    </div>
  );
}

function CodeCard({
  def,
  model,
  onBookService,
  open,
  onToggle,
}: {
  def: EVehicleErrorDefinition;
  model: string;
  onBookService?: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = SYSTEM_META[def.system] ?? { label: def.system, icon: null, tone: 'text-neutral-400' };
  return (
    <li className="overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/5"
      >
        <span className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-sm font-black text-amber-300">
          {def.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight text-white">{def.title}</span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${meta.tone}`}>
            {meta.icon}
            {meta.label}
          </span>
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${SEVERITY_STYLE[def.severity]}`}>
          {def.severity}
        </span>
        <ChevronRight className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-800 px-4 pb-4 pt-4">
          <p className="text-xs leading-relaxed text-neutral-300">{def.description}</p>

          {def.why && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-300">
                <Info className="w-3.5 h-3.5" /> Why it happened
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">{def.why}</p>
            </div>
          )}

          {def.symptoms && def.symptoms.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">What you'll notice</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {def.symptoms.map((s) => (
                  <span key={s} className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">How to fix it</div>
              {def.difficulty && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${DIFFICULTY_STYLE[def.difficulty] || 'border-neutral-700 text-neutral-300'}`}>
                  {def.difficulty}
                </span>
              )}
            </div>
            <ol className="mt-2 space-y-1.5">
              {def.fix.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-black text-emerald-300">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {(def.costRange || def.diyCost) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {def.costRange && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    <Wrench className="w-3.5 h-3.5" /> Workshop price (fitted)
                  </div>
                  <p className="mt-1 text-lg font-black text-white">{gbp(def.costRange)}</p>
                  <p className="text-[10px] text-neutral-500">Typical Stakey's price, parts + labour.</p>
                </div>
              )}
              {def.diyCost && (
                <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    <CircleDollarSign className="w-3.5 h-3.5" /> Parts only (DIY)
                  </div>
                  <p className="mt-1 text-lg font-black text-white">{gbp(def.diyCost)}</p>
                  <p className="text-[10px] text-neutral-500">If you fit it yourself.</p>
                </div>
              )}
            </div>
          )}

          {def.partKeys && def.partKeys.length > 0 && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Compatible parts — cheapest first
              </div>
              <div className="mt-2 space-y-2">
                {def.partKeys.map((k) => (
                  <PartRow key={k} partKey={k} model={model} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onBookService && (
              <button
                type="button"
                onClick={onBookService}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02]"
              >
                <Wrench className="w-3.5 h-3.5" /> Book this repair
              </button>
            )}
            <a
              href={def.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-emerald-400 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Verify code meaning
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

export function CustomerErrorCodeHelper({ onBookService }: { onBookService?: () => void }) {
  const { map, brands } = useBrandIndex();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [displayId, setDisplayId] = useState('');
  const [query, setQuery] = useState('');
  const [openCode, setOpenCode] = useState<string | null>(null);

  const brandEntry = brand ? map.get(brand) : undefined;
  const models = brandEntry?.models ?? [];

  // Displays across both categories, for riders who don't know their brand.
  const displays = useMemo<{ display: EVehicleDisplay; category: EVehicleCategory }[]>(
    () => [
      ...displaysForCategory('electric_scooter').map((display) => ({ display, category: 'electric_scooter' as EVehicleCategory })),
      ...displaysForCategory('ebike').map((display) => ({ display, category: 'ebike' as EVehicleCategory })),
    ],
    []
  );
  const activeDisplay = displays.find((d) => d.display.id === displayId) ?? null;

  const handleBrand = (next: string) => {
    setBrand(next);
    setModel('');
    setDisplayId('');
    setOpenCode(null);
  };
  const handleModel = (next: string) => {
    setModel(next);
    setDisplayId('');
    setOpenCode(null);
  };
  const handleDisplay = (next: string) => {
    setDisplayId(next);
    setBrand('');
    setModel('');
    setOpenCode(null);
  };

  const allCodes = useMemo(() => {
    if (brand && model && brandEntry) return customerCodesFor(brandEntry.category, brand, model);
    if (activeDisplay) return customerCodesForFamily(activeDisplay.display.family);
    return [];
  }, [brand, model, brandEntry, activeDisplay]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return allCodes;
    return matchBySymptom(allCodes, q);
  }, [allCodes, query]);

  const hasTarget = Boolean(model) || Boolean(activeDisplay);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-neutral-950 to-black p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-neutral-950 shadow-lg">
            <Search className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black tracking-tight text-white sm:text-xl">
              Fault Code Explainer
            </h3>
            <p className="text-xs text-neutral-400">
              An error showing on your e-scooter or e-bike? Find out why it happened, what to do,
              and what it costs — with links to the cheapest compatible parts.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Free workshop tool
          </span>
        </div>
      </div>

      {/* Pickers */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-500">Your brand</span>
            <select
              data-testid="cev-brand"
              value={brand}
              onChange={(e) => handleBrand(e.target.value)}
              className="w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-emerald-500/60"
            >
              <option value="">Choose your brand…</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-500">Your model</span>
            <select
              data-testid="cev-model"
              value={model}
              onChange={(e) => handleModel(e.target.value)}
              disabled={!brand}
              className="w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-emerald-500/60 disabled:opacity-40"
            >
              <option value="">{brand ? 'Choose your model…' : 'Pick a brand first'}</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-500">Code or symptom</span>
            <input
              data-testid="cev-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!hasTarget}
              placeholder={hasTarget ? 'e.g. E14 or "won\'t accelerate"' : 'Pick a model or display first'}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white placeholder-neutral-600 outline-none transition-colors focus:border-emerald-500/60 disabled:opacity-40"
            />
          </label>
        </div>

        {/* Display / system picker — for riders who don't know the exact model */}
        <div className="mt-3 border-t border-neutral-800/70 pt-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-sky-400">
              Don't know the model? Identify your display
            </span>
            <select
              data-testid="cev-display"
              value={displayId}
              onChange={(e) => handleDisplay(e.target.value)}
              className="w-full appearance-none rounded-xl border border-sky-800/50 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-sky-500/60"
            >
              <option value="">Choose the display that matches your machine…</option>
              {displays.map(({ display, category }) => (
                <option key={display.id} value={display.id}>
                  {category === 'ebike' ? 'E-Bike · ' : 'E-Scooter · '}{display.codeStyle} — {display.appearance.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
            The same code number means different things on different displays, so matching the display is the most
            reliable way to get the right answer.
          </p>
        </div>

        {/* Popular brand chips */}
        {!brand && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Popular:</span>
            {POPULAR_BRANDS.map((b) => (
              brands.includes(b) ? (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleBrand(b)}
                  className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[10px] font-bold text-neutral-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                >
                  {b}
                </button>
              ) : null
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {!hasTarget && (
        <p className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 p-6 text-center text-xs text-neutral-500">
          Pick your brand and model — or just the display that matches your machine — to see every fault code it can
          show: what it means, why it happens, how to fix it and what it costs.
        </p>
      )}

      {hasTarget && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-500">
            <span>
              {shown.length} code{shown.length === 1 ? '' : 's'} for{' '}
              <span className="font-bold text-neutral-300">
                {model ? `${brand} ${model}` : activeDisplay ? `${activeDisplay.display.codeStyle} display` : ''}
              </span>
            </span>
            {query.trim() && <button type="button" onClick={() => setQuery('')} className="font-bold text-emerald-400 hover:text-emerald-300">Clear search</button>}
          </div>

          {activeDisplay && !model && (
            <div className="mb-2 rounded-xl border border-sky-800/40 bg-sky-950/20 px-3 py-2 text-[11px] text-neutral-400">
              Showing codes for the <span className="font-bold text-sky-300">{activeDisplay.display.codeStyle}</span> display —
              fitted to {activeDisplay.display.usedOn.join(', ')}.
            </div>
          )}

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-6 text-center text-xs text-neutral-400">
              No code matched “{query}”. Try the code number (e.g. <span className="font-mono">E14</span>) or a plain
              symptom like <span className="font-semibold">won't accelerate</span>.
            </p>
          ) : (
            <ul className="space-y-2.5" data-testid="cev-code-list">
              {shown.map((def) => (
                <CodeCard
                  key={def.code}
                  def={def}
                  model={model || activeDisplay?.display.codeStyle || ''}
                  onBookService={onBookService}
                  open={openCode === def.code}
                  onToggle={() => setOpenCode(openCode === def.code ? null : def.code)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-neutral-600">
        Fault-code meanings are cross-checked against the manufacturer/fault tables for each system
        and open the source link on every card. Prices are a guide only — book a free diagnostic and
        we'll confirm the exact cost before any work.
      </p>
    </section>
  );
}
