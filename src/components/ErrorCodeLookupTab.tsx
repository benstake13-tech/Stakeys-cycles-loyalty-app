/**
 * Staff tool: E-Scooter / E-Bike error-code lookup with optional AI assist.
 *
 * Flow: pick a category (E-Scooter / E-Bike) → brand → model → the full error-code
 * list for that model family renders below, showing the code, what it means, its
 * severity and the usual workshop fix. A "Ask the AI" box lets staff paste the
 * rider's symptom (any language) and Gemini narrows the list to the most likely
 * codes — always from the shipped catalogue, never invented.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Bike,
  Zap,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BatteryCharging,
  Cpu,
  Gauge,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  EVehicleCategory,
  EVEHICLE_CATEGORIES,
  EVehicleErrorDefinition,
  brandsForEVehicleCategory,
  errorCodesFor,
  normalizeErrorCode,
} from '../data/eVehicleCodes';
import {
  assistECodeLookup,
  isECodeAssistConfigured,
  ECodeAssistItem,
  ECodeAssistResult,
} from '../api/eVehicleCodeAssist';

const SYSTEM_META: Record<string, { label: string; icon: React.ReactNode }> = {
  bms: { label: 'Battery / BMS', icon: <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" /> },
  controller: { label: 'Controller', icon: <Cpu className="w-3.5 h-3.5 text-sky-400" /> },
  display: { label: 'Display', icon: null },
  motor: { label: 'Motor', icon: null },
  throttle: { label: 'Throttle', icon: null },
  brake: { label: 'Brake', icon: null },
  charging: { label: 'Charging', icon: null },
};

const SEVERITY_STYLE: Record<string, string> = {
  Low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  High: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const CODE_BREAKPOINT = 5;

/** Renders one error row in the catalogue table. */
function ErrorRow({ def }: { def: EVehicleErrorDefinition }) {
  const meta = SYSTEM_META[def.system] ?? { label: def.system, icon: null };
  return (
    <li className="group rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 transition-colors hover:border-neutral-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-sm font-black text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1 shrink-0">
            {def.code}
          </span>
          <span className="text-sm font-bold text-white leading-tight">{def.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {meta.icon}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">{meta.label}</span>
          <span className={`text-[10px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 ${SEVERITY_STYLE[def.severity] || 'bg-neutral-800 text-neutral-300 border-neutral-700'}`}>
            {def.severity}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-400">{def.description}</p>
      <div className="mt-3 space-y-1.5">
        {def.fix.map((step, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500/70 shrink-0" />
            <span>{step}</span>
          </div>
        ))}
      </div>
      {def.parts && def.parts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Likely parts:</span>
          {def.parts.map((p) => (
            <span key={p} className="text-[10px] font-semibold text-neutral-300 bg-neutral-800/80 border border-neutral-700 rounded-full px-2 py-0.5">
              {p}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** Reusable pill / select used for category and brand. */
function PickerSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</span>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-emerald-500/60 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ErrorCodeLookupTab() {
  const [category, setCategory] = useState<EVehicleCategory>('electric_scooter');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [symptom, setSymptom] = useState('');
  const [search, setSearch] = useState('');
  const [assistState, setAssistState] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [assistResult, setAssistResult] = useState<{ matches: ECodeAssistItem[]; guidance: string; error?: ECodeAssistResult['error'] } | null>(null);

  const brands = useMemo(() => brandsForEVehicleCategory(category), [category]);
  const models = useMemo(() => {
    const entry = brands.find((b) => b.brand === brand);
    return entry ? entry.models : [];
  }, [brand, brands]);

  // Reset model when the brand changes.
  const handleBrandChange = (next: string) => {
    setBrand(next);
    setModel('');
    setSearch('');
    setAssistResult(null);
  };
  const handleCategoryChange = (next: string) => {
    setCategory(next as EVehicleCategory);
    setBrand('');
    setModel('');
    setSearch('');
    setAssistResult(null);
  };

  const codes: EVehicleErrorDefinition[] = useMemo(
    () => (category && brand && model ? errorCodesFor(category, brand, model) : []),
    [category, brand, model]
  );

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    const norm = normalizeErrorCode(q);
    return codes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        normalizeErrorCode(c.code) === norm
    );
  }, [codes, search]);

  const aiConfigured = isECodeAssistConfigured();

  const runAssist = async () => {
    if (!category || !brand || !model) return;
    setAssistState('thinking');
    // Keep the UI responsive while the model decides.
    const result = await assistECodeLookup({ category, brand, model, symptom });
    setAssistResult({
      matches: result.matches,
      guidance: result.guidance,
      error: result.error,
    });
    setAssistState('done');
  };

  const reset = () => {
    setCategory('electric_scooter');
    setBrand('');
    setModel('');
    setSymptom('');
    setSearch('');
    setAssistResult(null);
    setAssistState('idle');
  };

  return (
    <div className="space-y-6" data-testid="error-code-lookup-tab">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> E-Scooter / E-Bike Error Codes
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Pick a category, brand and model to see the error codes that machine reports, what they mean, and the
            usual workshop fix. Type the code the rider saw to narrow the list, or paste the symptom and let the AI
            pick the most likely codes.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          data-testid="ev-reset"
          className="pressable inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#0b0e13] px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>

      {/* Category / brand / model pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PickerSelect
          label="Vehicle type"
          testId="ev-category"
          value={category}
          onChange={handleCategoryChange}
          options={EVEHICLE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
        />
        <PickerSelect
          label="Brand"
          testId="ev-brand"
          value={brand}
          onChange={handleBrandChange}
          options={[
            { value: '', label: 'Choose a brand…' },
            ...brands.map((b) => ({ value: b.brand, label: b.brand })),
          ]}
        />
        <PickerSelect
          label="Model"
          testId="ev-model"
          value={model}
          onChange={(v) => { setModel(v); setAssistResult(null); }}
          options={[
            { value: '', label: 'Choose a model…' },
            ...models.map((m) => ({ value: m, label: m })),
          ]}
        />
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Filter codes <span className="normal-case font-medium text-neutral-600">(code or keyword)</span>
          </span>
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              data-testid="ev-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="E04, motor, throttle…"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 pl-9 pr-3 py-2.5 text-sm font-semibold text-white outline-none transition-colors focus:border-emerald-500/60"
            />
          </div>
        </label>
      </div>

      {/* Model-level status line */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <Gauge className="w-3.5 h-3.5 text-neutral-600" />
        <span>
          {brand && model
            ? <><span className="font-bold text-neutral-300">{model}</span> · {codes.length} codes in this family</>
            : 'Choose a brand and model to see its codes.'}
        </span>
      </div>

      {/* AI assist panel */}
      <div className="rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 to-neutral-950 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
          <Sparkles className="w-4 h-4" /> AI assist
          {!aiConfigured && (
            <span className="text-[10px] font-semibold text-amber-400/80 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide">
              No Gemini key on this build — offline matching only
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <textarea
            data-testid="ev-symptom"
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="Paste what the rider said, e.g. 'it beeps E04 going up the hill and the motor cuts out', or a fault description in any language…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-emerald-500/60"
          />
          <button
            type="button"
            onClick={runAssist}
            disabled={!brand || !model || assistState === 'thinking'}
            data-testid="ev-assist-run"
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-emerald-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-all cursor-pointer"
          >
            {assistState === 'thinking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {assistState === 'thinking' ? 'Asking…' : 'Ask the AI'}
          </button>
        </div>
        {assistState === 'done' && assistResult && (
          <div className="mt-4 space-y-3" data-testid="ev-assist-results">
            {assistResult.error && (
              <div
                data-testid="ev-assist-error"
                className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200"
              >
                <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                <span>{assistResult.error.message}</span>
              </div>
            )}
            {assistResult.matches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Most likely codes</span>
                {assistResult.matches.map((m) => (
                  <span
                    key={m.code}
                    data-testid="ev-assist-match"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300"
                  >
                    <Bike className="w-3 h-3" />
                    {m.code}
                    <span className="text-emerald-500/70 font-medium">{Math.round(m.confidence * 100)}%</span>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs leading-relaxed text-neutral-300 border-l-2 border-emerald-700/60 pl-3">
              {assistResult.guidance || (assistResult.matches.length ? 'See the highlighted codes below for the full workshop steps.' : 'No close match — review the full list below.')}
            </p>
            {assistResult.matches.length > 0 && (
              <p className="text-[11px] text-neutral-500">
                Save an AI-assisted guess to the booking? <span className="text-neutral-400">AI suggestions are a starting point — always verify codes on the display and with the manual pins listed under each entry.</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Catalogue */}
      {codes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-500">
            <Bike className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-neutral-300">No codes yet</p>
          <p className="mt-1 text-xs text-neutral-500">Select a brand and model to load its error-code family.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {searched.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-6 text-center text-xs text-neutral-500">
              No catalogue entry matches “{search}”.
            </div>
          ) : (
            <>
              {/* Break long lists into a compact summary, then the full table. */}
              {searched.length > CODE_BREAKPOINT && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-2">At a glance</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {searched.map((c) => (
                      <span
                        key={c.code}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold ${SEVERITY_STYLE[c.severity]}`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {c.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="ev-code-list">
                {searched.map((def) => <ErrorRow key={def.code} def={def} />)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}