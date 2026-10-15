import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Edit3, Flag, Gauge, Target, TrendingUp } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_GOALS, GOAL_IDS, GOAL_META, goalProgress, growthSnapshot,
  isGoalId, isValidGoalValue, parseGoals, raiseTargets,
  type GoalId, type GoalTargets,
} from '../../utils/performanceGoals';

const STORAGE_KEY = 'stakeys_staff_growth_targets_v1';
const TABLE = 'performance_targets';

function readDeviceTargets(): GoalTargets {
  try { return parseGoals(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { return { ...DEFAULT_GOALS }; }
}

function saveDeviceTargets(targets: GoalTargets): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(targets)); return true; }
  catch { return false; }
}

type SyncState = 'checking' | 'shared' | 'device' | 'saving';

/**
 * Four live business metrics and editable team growth targets. Cloud settings
 * require the accompanying RLS migration; offline/unconfigured users can edit
 * device-only targets with a conspicuous sync status, never a false "saved to
 * team" claim. No customer data is written to the targets table.
 */
export const GrowthTargets: React.FC = () => {
  const { bookings = [], users = [], sales = [] } = useShop();
  const [targets, setTargets] = useState<GoalTargets>(readDeviceTargets);
  const [draft, setDraft] = useState<Record<GoalId, string>>(
    () => Object.fromEntries(GOAL_IDS.map(id => [id, String(readDeviceTargets()[id])])) as Record<GoalId, string>
  );
  const [editing, setEditing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAdvice, setAiAdvice] = useState<{ headline: string; suggestions: Array<{ title: string; reason: string; target_metric: string; discount_pct: number; expected_benefit: string }> } | null>(null);
  const generateAdvice = async () => {
    if (aiBusy) return;
    setAiBusy(true); setAiError('');
    try {
      const { data, error } = await supabase.functions.invoke('growth-advisor', { body: {} });
      if (error) {
        const detail = typeof error.context?.json === 'function' ? await error.context.json().catch(() => null) : null;
        throw Error(detail?.error || error.message);
      }
      if (data?.error) throw Error(data.error);
      if (!Array.isArray(data?.suggestions)) throw Error('Unexpected advisor response');
      setAiAdvice({ headline: String(data.headline || 'Growth opportunities'), suggestions: data.suggestions });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Gemini growth advisor unavailable');
    } finally { setAiBusy(false); }
  };
  const [sync, setSync] = useState<SyncState>('checking');
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  const actual = useMemo(() => growthSnapshot(bookings, users, sales), [bookings, users, sales]);
  const reached = GOAL_IDS.filter(id => actual[id] >= targets[id]).length;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!supabase?.from) {
        if (!cancelled) setSync('device');
        return;
      }
      try {
        const { data, error: cloudError } = await supabase.from(TABLE)
          .select('metric_key,target_value');
        if (cloudError) throw cloudError;
        const incoming: Record<string, number> = {};
        for (const row of data || []) {
          if (isGoalId(row.metric_key) && isValidGoalValue(row.metric_key, row.target_value)) {
            incoming[row.metric_key] = row.target_value;
          }
        }
        if (cancelled) return;
        const merged = parseGoals(incoming);
        setTargets(merged);
        setDraft(Object.fromEntries(GOAL_IDS.map(id => [id, String(merged[id])])) as Record<GoalId, string>);
        saveDeviceTargets(merged);
        setSync('shared');
      } catch {
        if (!cancelled) setSync('device');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const openEditor = () => {
    setDraft(Object.fromEntries(GOAL_IDS.map(id => [id, String(targets[id])])) as Record<GoalId, string>);
    setError(''); setSavedNotice(''); setEditing(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sync === 'saving') return;
    const parsed = {} as GoalTargets;
    for (const id of GOAL_IDS) {
      const text = draft[id].trim();
      const value = Number(text);
      if (!/^\d+$/.test(text) || !isValidGoalValue(id, value)) {
        setError(`${GOAL_META[id].label}: enter a whole-number target between 1 and ${id === 'callConversionPct' ? '100' : '100,000,000'}.`);
        return;
      }
      parsed[id] = value;
    }

    setError(''); setSavedNotice(''); setSync('saving');
    // Always persist the chosen targets locally, so the user's input survives
    // a reload even when the team database is not configured.
    const deviceSaved = saveDeviceTargets(parsed);
    setTargets(parsed);
    setEditing(false);
    try {
      if (!supabase?.from) throw Error('Supabase unavailable');
      const { error: cloudError } = await supabase.from(TABLE).upsert(
        GOAL_IDS.map(metric_key => ({
          metric_key,
          target_value: parsed[metric_key],
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'metric_key' }
      );
      if (cloudError) throw cloudError;
      setSync('shared');
      setSavedNotice('Growth targets saved for the whole staff team.');
    } catch {
      setSync('device');
      setSavedNotice(deviceSaved
        ? 'Targets saved on this device only. Apply the performance_targets SQL migration to share them with the team.'
        : 'Unable to persist targets. Check device storage and Supabase permissions.');
    }
  };

  return (
    <section className="staff-goals-panel space-y-4" data-testid="staff-growth-targets">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Target size={23} strokeWidth={1.6} className="mt-0.5 shrink-0 text-[#00FF66]" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-extrabold tracking-[.19em] text-[#00FF66] uppercase">Growth scorecard</p>
            <h2 className="mt-1 font-display text-lg font-bold text-white">Targets worth chasing</h2>
            <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-[#a4b8aa]">
              Live figures from bookings, customer sign-ups, loyalty and completed till sales. Choose goals across bookings, customers and sales.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="staff-goals-pill" aria-label={`${reached} of ${GOAL_IDS.length} growth goals reached`}>
            <Flag size={13} strokeWidth={1.7} aria-hidden="true" /> {reached} / {GOAL_IDS.length} reached
          </span>
          <button type="button" onClick={editing ? () => setEditing(false) : openEditor}
            className="staff-goals-edit">
            <Edit3 size={13} strokeWidth={1.8} aria-hidden="true" /> {editing ? 'Cancel' : 'Edit targets'}
          </button>
        </div>
      </div>

      {(['Bookings', 'Customers', 'Sales'] as const).map(group => <div key={group} className="space-y-2">
        <h3 className="px-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#00FF66]">{group} targets</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {GOAL_IDS.filter(id => GOAL_META[id].group === group).map(id => {
          const value = actual[id];
          const target = targets[id];
          const progress = goalProgress(value, target);
          const meta = GOAL_META[id];
          const displayValue = (amount: number) => meta.unit === '£' ? `£${amount.toLocaleString('en-GB')}` : `${amount}${meta.unit}`;
          return (
            <article key={id} className="staff-goal-card" data-testid={`staff-goal-${id}`}>
              <div className="flex flex-wrap justify-between items-start gap-1">
                <span className="text-[10px] uppercase tracking-[.1em] font-bold leading-tight text-[#d8e8dd]">{meta.label}</span>
                {progress.reached && <Check size={15} strokeWidth={2} className="shrink-0 text-[#00FF66]" aria-label="Target reached" />}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                <strong className="text-[25px] font-black leading-none tabular-nums tracking-tight text-white">{displayValue(value)}</strong>
                <span className="text-[11px] tabular-nums text-[#a4b8aa]">/ {displayValue(target)}</span>
              </div>
              <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-[#293a30]"
                role="progressbar" aria-label={`${meta.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.barPercent}>
                <div className="h-full rounded-full bg-[#00FF66] transition-[width] duration-300" style={{ width: `${progress.barPercent}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-[10px] font-semibold text-[#00FF66] tabular-nums">
                  {progress.reached ? `+ ${Math.max(0, value - target)} above target` : `${progress.remaining} to go`}
                </span>
                <span className="text-[9px] font-mono text-[#a4b8aa]">{progress.percent}%</span>
              </div>
              <p className="mt-2 text-[9px] text-[#9eafa2]">{meta.period} · {meta.description}</p>
            </article>
          );
        })}
        </div>
      </div>)}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-[#a4b8aa]" role="status">
          {sync === 'checking' ? 'Checking shared targets…'
            : sync === 'saving' ? 'Saving your targets…'
            : sync === 'shared' ? 'Shared targets · synced with Supabase'
            : 'Device-only targets · team sync unavailable'}
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] text-[#a4b8aa]">
          <TrendingUp size={12} strokeWidth={1.7} aria-hidden="true" /> Raise targets as you grow
        </span>
      </div>

      <div className="staff-goals-editor space-y-3" data-testid="staff-gemini-growth-advisor">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Gemini growth advisor</h3>
            <p className="text-[10px] text-[#a4b8aa]">Reviews real monthly sales, repairs, services and free community work. Promotions need staff approval.</p>
          </div>
          <button type="button" onClick={() => void generateAdvice()} disabled={aiBusy}
            className="staff-goals-edit disabled:opacity-50">
            <TrendingUp size={15} aria-hidden="true" /> {aiBusy ? 'Analysing…' : 'Suggest promotions'}
          </button>
        </div>
        {aiError && <p role="alert" className="text-[11px] text-white">{aiError}</p>}
        {aiAdvice && <div className="space-y-2" aria-live="polite">
          <p className="text-[12px] font-bold text-[#00FF66]">{aiAdvice.headline}</p>
          {aiAdvice.suggestions.map((s, i) => <article key={i} className="staff-goal-card space-y-1">
            <strong className="block text-xs text-white">{s.title}</strong>
            <p className="text-[11px] text-[#c1d3c5]">{s.reason}</p>
            <p className="text-[10px] text-[#00FF66]">Suggested discount: {s.discount_pct}% · Target: {s.target_metric}</p>
            <p className="text-[10px] text-[#a4b8aa]">{s.expected_benefit}</p>
          </article>)}
          <p className="text-[10px] text-[#a4b8aa]">AI-generated suggestions; check margins and approve before publishing.</p>
        </div>}
      </div>
      {savedNotice && <p role="status" className="text-[11px] text-[#00FF66]">{savedNotice}</p>}
      {editing && (
        <form onSubmit={event => void save(event)} className="staff-goals-editor space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Gauge size={17} strokeWidth={1.6} className="text-[#00FF66]" /> Team targets</h3>
            <button type="button" onClick={() => {
              const next = raiseTargets(parseGoals(Object.fromEntries(GOAL_IDS.map(id => [id, Number(draft[id])]))));
              setDraft(Object.fromEntries(GOAL_IDS.map(id => [id, String(next[id])])) as Record<GoalId, string>);
            }} className="staff-goals-edit">
              <ArrowUpRight size={14} aria-hidden="true" /> Stretch +10%
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GOAL_IDS.map(id => <label key={id} className="block min-w-0">
              <span className="block text-[10px] text-[#d8e8dd] mb-1.5">{GOAL_META[id].label} {GOAL_META[id].unit}</span>
              <input data-testid={`staff-target-input-${id}`} type="number" inputMode="numeric" step="1" min="1"
                max={id === 'callConversionPct' ? '100' : '100000000'}
                value={draft[id]} onChange={e => setDraft(current => ({ ...current, [id]: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#0d1310] px-3 py-2.5 text-sm text-white tabular-nums outline-none focus:border-[#00FF66]" />
            </label>)}
          </div>
          {error && <p className="text-[11px] text-white" role="alert">{error}</p>}
          <button type="submit" disabled={sync === 'saving'} className="inline-flex items-center gap-2 rounded-lg bg-[#00FF66] px-4 py-2.5 text-xs font-extrabold text-[#07100b] disabled:opacity-60">
            <Check size={15} aria-hidden="true" /> Save targets
          </button>
        </form>
      )}
    </section>
  );
};

export default GrowthTargets;
