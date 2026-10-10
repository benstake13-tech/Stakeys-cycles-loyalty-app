import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Wand2,
  CalendarDays,
  Clock,
  Tag,
  Bot,
  Loader2,
  Lightbulb,
  CloudRain,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { ShopPromotion, VehicleCategory } from '../types/bikeShop';
import {
  planPromotion,
  buildTimeline,
  suggestWindows,
  applyDurationPreset,
  DURATION_PRESETS,
  toDateOnly,
  addDays,
  PlannerInput,
} from '../utils/promotionPlanner';
import { buildPromotionBrief } from '../utils/promotionAdvisor';
import { advisePromotion, isPromotionAdvisorConfigured } from '../api/promotionAdvisorService';
import type { AdvisorResult } from '../utils/promotionAdvisor';
import {
  fetchWeatherReport,
  loadCachedWeather,
  DEFAULT_WEATHER_LOCATION,
  type WeatherReport,
} from '../utils/weatherService';
import { signalHeadline, type DemandSignal } from '../utils/repairWeatherModel';
import { seasonalDemand, type SeasonalPart } from '../utils/seasonalDemand';

const CATEGORIES: { id: VehicleCategory; label: string }[] = [
  { id: 'cycle', label: 'Cycle' },
  { id: 'ebike', label: 'E-Bike' },
  { id: 'electric_scooter', label: 'E-Scooter' },
  { id: 'cargo', label: 'Cargo' },
];

const TONE_CLASS: Record<string, string> = {
  active: 'bg-emerald-500/70 border-emerald-400',
  upcoming: 'bg-amber-500/60 border-amber-400',
  expired: 'bg-neutral-600/60 border-neutral-500',
  planned: 'bg-sky-500/70 border-sky-300',
  conflict: 'bg-rose-500/70 border-rose-300',
};

const emptyDraft = (): PlannerInput => ({
  title: '',
  discountPercentage: 15,
  discountAmount: 0,
  startDate: toDateOnly(new Date()),
  endDate: addDays(new Date(), 29),
  eligibleCategories: ['cycle', 'ebike'],
});

/**
 * Promotions planner — the "think before you publish" half of the Promotions
 * tab. It lays out every live campaign on a timeline, flags overlaps for the
 * campaign being drafted, suggests clear windows, and only then hands the plan
 * to the existing addPromotion flow.
 */
export const PromotionsPlanner: React.FC = () => {
  const { promotions, addPromotion, discountCodes, bookings, sales } = useShop();
  const [draft, setDraft] = useState<PlannerInput>(emptyDraft);
  const [showTimeline, setShowTimeline] = useState(true);
  const [created, setCreated] = useState<string | null>(null);
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);
  const [advising, setAdvising] = useState(false);
  const [weather, setWeather] = useState<WeatherReport | null>(() => loadCachedWeather());
  const mounted = useRef(true);

  const plan = useMemo(() => planPromotion(draft, promotions), [draft, promotions]);
  const timeline = useMemo(() => buildTimeline(promotions, draft, { spanDays: 120 }), [promotions, draft]);
  const windows = useMemo(() => suggestWindows(promotions, { count: 3 }), [promotions]);

  // Fetch the forecast once, non-blocking; keep the cached report on failure and
  // always fall back to the deterministic season model when there is no weather.
  useEffect(() => {
    mounted.current = true;
    if (!weather) {
      fetchWeatherReport(DEFAULT_WEATHER_LOCATION)
        .then((fresh) => {
          if (mounted.current) setWeather(fresh);
        })
        .catch(() => {
          /* offline — the deterministic forecast stands on its own */
        });
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forecast = useMemo(() => seasonalDemand(weather, new Date()), [weather]);
  const signals: DemandSignal[] = forecast.signals;
  const parts: SeasonalPart[] = forecast.parts;
  const headline = useMemo(() => signalHeadline(signals, new Date()), [signals]);

  const runAdvisor = async () => {
    setAdvising(true);
    try {
      const brief = buildPromotionBrief(promotions, discountCodes || [], new Date(), weather, bookings, sales);
      setAdvice(await advisePromotion(brief));
    } finally {
      setAdvising(false);
    }
  };

  /** Seed the draft from a forecast signal (title + category). */
  const seedFromSignal = (signal: DemandSignal) => {
    setDraft((d) => ({
      ...d,
      title: d.title.trim() ? d.title : `${signal.issue} — book ahead`,
      eligibleCategories: [signal.category],
    }));
  };

  /** Load a suggested action into the draft so it can be reviewed and created. */
  const applyAdvice = (a: AdvisorResult['actions'][number]) => {
    setDraft((d) => ({
      ...d,
      title: d.title.trim() ? d.title : a.title,
      discountPercentage: a.discountPercentage ?? 0,
      discountAmount: a.discountAmount ?? 0,
      eligibleCategories: a.categories.length ? a.categories : d.eligibleCategories,
      startDate: a.startDate || d.startDate,
      endDate: a.endDate || d.endDate,
    }));
  };

  const toggleCategory = (id: VehicleCategory) => {
    setDraft((d) => ({
      ...d,
      eligibleCategories: d.eligibleCategories.includes(id)
        ? d.eligibleCategories.filter((c) => c !== id)
        : [...d.eligibleCategories, id],
    }));
  };

  const applyPreset = (id: string) => {
    const next = applyDurationPreset(id, draft.startDate);
    setDraft((d) => ({ ...d, startDate: next.startDate, endDate: next.endDate }));
  };

  const handleCreate = async () => {
    if (!draft.title.trim()) return;
    const newPromo: Omit<ShopPromotion, 'id'> = {
      title: draft.title.trim(),
      subtitle: plan.summary,
      code: plan.code,
      discountPercentage: draft.discountPercentage,
      discountAmount: draft.discountAmount,
      badgeText: plan.badgeText,
      status: plan.status,
      startDate: draft.startDate,
      endDate: draft.endDate,
      termsAndConditions: [
        'Valid for in-store and online bookings.',
        'Labour only; replacement parts charged separately.',
        'Cannot combine with other offers.',
      ],
      eligibleCategories: draft.eligibleCategories,
      bgGradient: 'from-emerald-950/80 via-[#0e1713] to-neutral-900',
    };
    await addPromotion(newPromo);
    setCreated(`Planned and created "${newPromo.title}" (${plan.code}).`);
    setDraft(emptyDraft());
  };

  return (
    <div data-testid="promotions-planner" className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-sky-400" />
            <span>Promotions Planner</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Draft a campaign, see where it lands against live promotions, and schedule it in a clear window.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTimeline((v) => !v)}
          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
        >
          {showTimeline ? 'Hide timeline' : 'Show timeline'}
        </button>
      </div>

      {created && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{created}</span>
        </div>
      )}

      {/* AI advisor */}
      <div data-testid="promo-advisor" className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <Bot className="w-4 h-4" /> AI promotion advisor
            </h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Grounded in your live campaigns and coupon history. Uses the low-quota AI model and caches its answer.
            </p>
          </div>
          <button
            type="button"
            onClick={runAdvisor}
            disabled={advising}
            data-testid="promo-advisor-run"
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-neutral-950 text-xs font-bold flex items-center gap-1.5"
          >
            {advising ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
            <span>{advising ? 'Thinking…' : 'Suggest promotions'}</span>
          </button>
        </div>

        {advice && (
          <div className="space-y-3" data-testid="promo-advisor-result">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-200">{advice.headline}</span>
              <span
                data-testid="promo-advisor-source"
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                  advice.source === 'ai'
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-400'
                }`}
              >
                {advice.source === 'ai' ? 'AI' : 'Offline'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {advice.actions.map((a, i) => (
                <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-white">{a.title}</span>
                    <span className="shrink-0 text-[10px] text-neutral-500">{Math.round(a.confidence * 100)}%</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{a.rationale}</p>
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-400">
                    {a.discountPercentage ? <span className="rounded bg-neutral-900 px-1.5 py-0.5">{a.discountPercentage}% off</span> : null}
                    {a.discountAmount ? <span className="rounded bg-neutral-900 px-1.5 py-0.5">£{a.discountAmount}</span> : null}
                    {a.categories.map((c) => (
                      <span key={c} className="rounded bg-neutral-900 px-1.5 py-0.5">{c}</span>
                    ))}
                    {a.audience === 'member' ? <span className="rounded bg-neutral-900 px-1.5 py-0.5">members</span> : null}
                    <span className="rounded bg-neutral-900 px-1.5 py-0.5">{a.startDate} → {a.endDate}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyAdvice(a)}
                    data-testid={`promo-advisor-apply-${i}`}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-[11px] font-semibold"
                  >
                    Load into draft
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weather → demand forecast (deterministic, works offline) */}
      <div data-testid="promo-demand-forecast" className="rounded-2xl border border-sky-500/20 bg-[#0b1116] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4" /> What the weather means for demand
            </h4>
            <p className="text-[11px] text-neutral-400 mt-0.5" data-testid="promo-demand-headline">
              {headline}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            {weather ? 'Live forecast' : 'Season model'}
          </span>
        </div>

        {signals.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="promo-demand-signals">
            {signals.slice(0, 4).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => seedFromSignal(s)}
                data-testid={`promo-signal-${s.id}`}
                className="text-left rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-1 hover:border-sky-500/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">{s.issue}</span>
                  <span className="shrink-0 text-[10px] font-bold text-emerald-300">+{s.estimatedUpliftPct}%</span>
                </div>
                <p className="text-[11px] text-neutral-400">{s.reason}</p>
                <span className="inline-block rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-neutral-400">
                  {s.category}
                </span>
              </button>
            ))}
          </div>
        )}

        {parts.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="promo-demand-parts">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 self-center">Parts at risk:</span>
            {parts.slice(0, 6).map((p) => (
              <span key={p.componentId} className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] text-neutral-300">
                {p.name} · {p.offer}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Draft form */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-neutral-300 font-medium mb-1 text-xs">Campaign title</label>
          <input
            type="text"
            value={draft.title}
            data-testid="planner-title"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="e.g. Spring Drivetrain Overhaul"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-neutral-300 font-medium mb-1 text-xs">Start date</label>
          <input
            type="date"
            value={draft.startDate}
            data-testid="planner-start"
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-neutral-300 font-medium mb-1 text-xs">End date</label>
          <input
            type="date"
            value={draft.endDate}
            data-testid="planner-end"
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="block text-neutral-300 font-medium mb-1 text-xs">Discount %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={draft.discountPercentage ?? 0}
            onChange={(e) => setDraft({ ...draft, discountPercentage: Number(e.target.value) || 0 })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-neutral-300 font-medium mb-1 text-xs">Credit £ (optional)</label>
          <input
            type="number"
            min={0}
            value={draft.discountAmount ?? 0}
            onChange={(e) => setDraft({ ...draft, discountAmount: Number(e.target.value) || 0 })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="sm:col-span-2">
          <span className="block text-neutral-300 font-medium mb-1 text-xs">Eligible categories</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = draft.eligibleCategories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`planner-cat-${c.id}`}
                  aria-pressed={on}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    on
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Duration presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-neutral-500 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Duration
        </span>
        {DURATION_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`planner-preset-${p.id}`}
            onClick={() => applyPreset(p.id)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-semibold hover:border-sky-500/50 hover:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Plan summary + warnings */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
            plan.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : plan.status === 'upcoming'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-neutral-800 text-neutral-400'
          }`}>
            {plan.badgeText}
          </span>
          <span className="font-mono text-xs font-bold text-white bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 flex items-center gap-1">
            <Tag className="w-3 h-3 text-neutral-500" />
            {plan.code}
          </span>
          <span className="text-xs text-neutral-400 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> {plan.durationDays} day{plan.durationDays === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-xs text-neutral-300" data-testid="planner-summary">{plan.summary}</p>

        {plan.warnings.length > 0 && (
          <ul className="space-y-1.5" data-testid="planner-warnings">
            {plan.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!draft.title.trim()}
            data-testid="planner-create"
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create promotion</span>
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Suggested clear windows */}
      {windows.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 mb-2">
            <Wand2 className="w-3.5 h-3.5 text-sky-400" /> Clear windows to schedule
          </h4>
          <div className="flex flex-wrap gap-2">
            {windows.map((w, i) => (
              <button
                key={i}
                type="button"
                data-testid={`planner-window-${i}`}
                onClick={() => setDraft((d) => ({ ...d, startDate: w.startDate, endDate: w.endDate }))}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-semibold hover:border-sky-500/50 hover:text-white"
              >
                {w.label} · {w.days}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {showTimeline && (
        <div data-testid="planner-timeline" className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-bold text-neutral-200">Campaign timeline (next 120 days)</span>
          </div>
          <div className="relative">
            <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
              {timeline.ticks.map((t, i) => (
                <span key={i}>{t.label}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {timeline.rows.length === 0 && (
                <p className="text-[11px] text-neutral-500">No campaigns in this window yet.</p>
              )}
              {timeline.rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span
                    className={`w-28 shrink-0 truncate text-[10px] ${row.isPlanned ? 'text-sky-300 font-bold' : 'text-neutral-400'}`}
                    title={row.label}
                  >
                    {row.label}
                  </span>
                  <div className="relative h-3 flex-1 rounded bg-neutral-900/80">
                    <div
                      className={`absolute h-3 rounded border ${TONE_CLASS[row.tone] || TONE_CLASS.planned}`}
                      style={{ left: `${row.leftPct}%`, width: `${Math.max(row.widthPct, 1.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
