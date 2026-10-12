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
  ExternalLink,
  MonitorSmartphone,
} from 'lucide-react';
import {
  EVehicleCategory,
  EVEHICLE_CATEGORIES,
  EVehicleErrorDefinition,
  EVehicleDisplay,
  brandsForEVehicleCategory,
  errorCodesFor,
  errorCodesForFamily,
  displaysForCategory,
  displayForModel,
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
      {def.source && (
        <a
          href={def.source}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Verify source
        </a>
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

/**
 * Display / system identifier.
 *
 * Because the same fault number means different things on different displays,
 * the mechanic should identify the DISPLAY first. Choosing one here sets the
 * code table directly, without needing to know the brand or model.
 */
function DisplayPicker({
  displays,
  activeId,
  onSelect,
  onClear,
}: {
  displays: EVehicleDisplay[];
  activeId: string | null;
  onSelect: (d: EVehicleDisplay) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-sky-800/40 bg-gradient-to-br from-sky-950/30 to-neutral-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
          <MonitorSmartphone className="w-4 h-4" /> Step 1 — Identify the display / system
        </div>
        {activeId && (
          <button
            type="button"
            onClick={onClear}
            data-testid="ev-display-clear"
            className="text-[11px] font-semibold text-neutral-400 hover:text-white cursor-pointer"
          >
            Clear display
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
        The same code number can mean different things on different displays. Match what the rider sees on the unit
        below — this is the most reliable way to reach the correct table.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displays.map((d) => {
          const active = activeId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d)}
              data-testid={`ev-display-${d.id}`}
              className={`text-left rounded-xl border p-3 transition-colors cursor-pointer ${
                active
                  ? 'border-sky-400 bg-sky-500/10 ring-1 ring-sky-400/40'
                  : 'border-neutral-800 bg-neutral-950/50 hover:border-sky-700/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-black text-sky-300">{d.codeStyle}</span>
                {active && <CheckCircle2 className="w-3.5 h-3.5 text-sky-300" />}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-neutral-300">{d.appearance}</p>
              <p className="mt-1.5 text-[10px] text-neutral-500">{d.usedOn.join(' · ')}</p>
              {d.hint && <p className="mt-1.5 text-[10px] italic text-amber-400/80">{d.hint}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ErrorCodeLookupTab() {
  const [category, setCategory] = useState<EVehicleCategory>('electric_scooter');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [symptom, setSymptom] = useState('');
  const [search, setSearch] = useState('');
  const [assistState, setAssistState] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [assistResult, setAssistResult] = useState<{ matches: ECodeAssistItem[]; guidance: string; error?: ECodeAssistResult['error'] } | null>(null);

  const brands = useMemo(() => brandsForEVehicleCategory(category), [category]);
  const displays = useMemo(() => displaysForCategory(category), [category]);
  const models = useMemo(() => {
    const entry = brands.find((b) => b.brand === brand);
    return entry ? entry.models : [];
  }, [brand, brands]);

  const activeDisplay = useMemo(
    () => displays.find((d) => d.id === displayId) ?? null,
    [displays, displayId]
  );

  // Reset model when the brand changes.
  const handleBrandChange = (next: string) => {
    setBrand(next);
    setModel('');
    setDisplayId(null);
    setSearch('');
    setAssistResult(null);
  };
  const handleCategoryChange = (next: string) => {
    setCategory(next as EVehicleCategory);
    setBrand('');
    setModel('');
    setDisplayId(null);
    setSearch('');
    setAssistResult(null);
  };
  const handleModelChange = (next: string) => {
    setModel(next);
    // A chosen model implies its display; clear the manual display pick.
    setDisplayId(null);
    setAssistResult(null);
  };
  const handleDisplaySelect = (d: EVehicleDisplay) => {
    setDisplayId((cur) => (cur === d.id ? null : d.id));
    setSearch('');
    setAssistResult(null);
  };

  // Which table to show: a chosen model wins; otherwise a chosen display.
  const mode: 'model' | 'display' | 'none' = model && brand ? 'model' : activeDisplay ? 'display' : 'none';

  const codes: EVehicleErrorDefinition[] = useMemo(() => {
    if (mode === 'model') return errorCodesFor(category, brand, model);
    if (mode === 'display' && activeDisplay) return errorCodesForFamily(activeDisplay.family);
    return [];
  }, [mode, category, brand, model, activeDisplay]);

  // The display implied by the currently selected model (for the info strip).
  const impliedDisplay = useMemo(
    () => (mode === 'model' ? displayForModel(category, brand, model) : null),
    [mode, category, brand, model]
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
    if (mode === 'none') return;
    setAssistState('thinking');
    // Keep the UI responsive while the model decides.
    const result = await assistECodeLookup({
      category,
      brand,
      model,
      family: mode === 'display' ? activeDisplay?.family : undefined,
      symptom,
    });
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
    setDisplayId(null);
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
            Error codes are <strong className="text-neutral-300">not universal</strong> — the same number means
            different things on different displays. Identify the <strong className="text-neutral-300">display/system</strong> the
            rider has to reach the correct table, or narrow by brand and model. Then type the code the rider saw, or
            paste the symptom and let the AI pick the most likely codes.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          data-testid="ev-reset"
          className="pressable inline-flex items-center gap-2 surface-panel px-3 py-2 text-xs font-bold text-neutral-300 hover:border-emerald-500/40 hover:text-white cursor-pointer"
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
          label="Brand (optional)"
          testId="ev-brand"
          value={brand}
          onChange={handleBrandChange}
          options={[
            { value: '', label: 'Choose a brand…' },
            ...brands.map((b) => ({ value: b.brand, label: b.brand })),
          ]}
        />
        <PickerSelect
          label="Model (optional)"
          testId="ev-model"
          value={model}
          onChange={handleModelChange}
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

      {/* Display / system identification — the primary route to the right table */}
      <DisplayPicker
        displays={displays}
        activeId={displayId}
        onSelect={handleDisplaySelect}
        onClear={() => { setDisplayId(null); setSearch(''); setAssistResult(null); }}
      />

      {/* Model-level status line */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        <Gauge className="w-3.5 h-3.5 text-neutral-600" />
        <span data-testid="ev-status">
          {mode === 'model' && (
            <>
              <span className="font-bold text-neutral-300">{model}</span>
              {impliedDisplay ? ` · ${impliedDisplay.codeStyle}` : ''} · {codes.length} codes in this family
            </>
          )}
          {mode === 'display' && activeDisplay && (
            <>
              Display: <span className="font-bold text-sky-300">{activeDisplay.codeStyle}</span> · {codes.length} codes
            </>
          )}
          {mode === 'none' && 'Identify the display, or choose a brand and model, to see its codes.'}
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
            disabled={mode === 'none' || assistState === 'thinking'}
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
          <p className="mt-1 text-xs text-neutral-500">Identify the display, or select a brand and model, to load its error-code family.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Which display/system these codes belong to */}
          {(() => {
            const banner = mode === 'display' ? activeDisplay : impliedDisplay;
            if (!banner) return null;
            return (
              <div
                data-testid="ev-display-banner"
                className="rounded-xl border border-sky-800/40 bg-sky-950/20 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-sky-300">
                  <MonitorSmartphone className="w-3.5 h-3.5" />
                  These codes are for the {banner.codeStyle} display/system
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{banner.appearance}</p>
              </div>
            );
          })()}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {searched.map((c) => (
                      <span
                        key={c.code}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold ${SEVERITY_STYLE[c.severity]}`}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="font-mono">{c.code}</span>
                        <span className="font-medium text-neutral-300 truncate">{c.title}</span>
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