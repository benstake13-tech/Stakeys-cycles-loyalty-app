import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Trophy, Sparkles, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SPIN_MS = 3500;
const VIEW_W = 1000;
const VIEW_H = 580;
const WHEEL_R = 190;
const HUBS = { rear: { x: 230, y: 370 }, front: { x: 770, y: 370 } };
const BB = { x: 470, y: 380 };
const SEAT = { x: 425, y: 160 };
const HEAD_TOP = { x: 700, y: 120 };
const HEAD_BOTTOM = { x: 716, y: 180 };
const SLICE_VIEW = 320;
const SR = SLICE_VIEW / 2;

const DEFAULT_SLICES = {
  front: [
    { label: 'Free Inner Tube', color: '#0891b2', weight: 30, reward_type: 'merch', stamps: 0, is_upgrade: false },
    { label: '+1 Loyalty Stamp', color: '#059669', weight: 35, reward_type: 'stamp', stamps: 1, is_upgrade: false },
    { label: '+50 Store Merits', color: '#db2777', weight: 25, reward_type: 'merit', stamps: 0, is_upgrade: false },
    { label: '➡️ REAR WHEEL UNLOCK!', color: '#d97706', weight: 10, reward_type: 'upgrade', stamps: 0, is_upgrade: true },
  ],
  rear: [
    { label: '+3 Stamps Jackpot!', color: '#7c3aed', weight: 40, reward_type: 'stamp', stamps: 3, is_upgrade: false },
    { label: '£10 Off In-Store Gear', color: '#0284c7', weight: 40, reward_type: 'discount', stamps: 0, is_upgrade: false },
    { label: 'Free Full Tune-Up', color: '#dc2626', weight: 20, reward_type: 'service', stamps: 0, is_upgrade: false },
  ],
};

const pickWeightedIndex = (slices) => {
  const total = slices.reduce((sum, s) => sum + Math.max(0, Number(s.weight) || 0), 0);
  if (total <= 0) return Math.floor(Math.random() * slices.length);
  let r = Math.random() * total;
  for (let i = 0; i < slices.length; i++) {
    r -= Math.max(0, Number(slices[i].weight) || 0);
    if (r < 0) return i;
  }
  return slices.length - 1;
};

// Angles measured clockwise from 12 o'clock.
const polar = (deg, radius) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [SR + radius * Math.cos(rad), SR + radius * Math.sin(rad)];
};

const slicePath = (start, end) => {
  const [x1, y1] = polar(start, SR);
  const [x2, y2] = polar(end, SR);
  const large = end - start > 180 ? 1 : 0;
  return `M ${SR} ${SR} L ${x1} ${y1} A ${SR} ${SR} 0 ${large} 1 ${x2} ${y2} Z`;
};

const wrapLabel = (label, max = 12) =>
  label.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);

const pct = (value, total) => `${(value / total) * 100}%`;

function PrizeWheel({ slices, rotation, spinning, active, locked, hub }) {
  const sliceDeg = 360 / slices.length;
  return (
    <div
      className={`absolute transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-60'}`}
      style={{
        left: pct(hub.x - WHEEL_R, VIEW_W),
        top: pct(hub.y - WHEEL_R, VIEW_H),
        width: pct(WHEEL_R * 2, VIEW_W),
        height: pct(WHEEL_R * 2, VIEW_H),
      }}
    >
      <div
        className={`relative h-full w-full rounded-full border-[8px] border-slate-900 sm:border-[14px] ${
          active ? 'shadow-[0_0_20px_rgba(16,185,129,0.25)]' : ''
        }`}
      >
        <div className="pointer-events-none absolute -inset-[6px] rounded-full border-2 border-dashed border-slate-600 sm:-inset-[9px]" />
        <svg
          viewBox={`0 0 ${SLICE_VIEW} ${SLICE_VIEW}`}
          className="block h-full w-full rounded-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.21, 1)` : 'none',
          }}
        >
          {slices.map((s, i) => {
            const start = i * sliceDeg;
            return (
              <g key={i}>
                <path d={slicePath(start, start + sliceDeg)} fill={s.color} stroke="#0f172a" strokeWidth="2" />
                <text
                  x={SR}
                  y={SR * 0.34}
                  transform={`rotate(${start + sliceDeg / 2} ${SR} ${SR})`}
                  textAnchor="middle"
                  fill="#ffffff"
                  stroke="#020617"
                  strokeWidth="3"
                  paintOrder="stroke"
                  fontSize={slices.length > 3 ? 15 : 16}
                  fontWeight="800"
                >
                  {wrapLabel(s.label).map((line, li) => (
                    <tspan key={li} x={SR} dy={li === 0 ? 0 : '1.15em'}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {Array.from({ length: 16 }).map((_, i) => {
            const [x, y] = polar(i * 22.5, SR - 4);
            return <line key={i} x1={SR} y1={SR} x2={x} y2={y} stroke="#e2e8f0" strokeOpacity="0.18" strokeWidth="1.2" />;
          })}
        </svg>
        {locked && (
          <div className="absolute inset-0 flex items-end justify-center rounded-full bg-slate-950/55 pb-[18%]">
            <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-slate-950/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 sm:text-xs">
              <Lock className="h-3 w-3" /> Locked
            </span>
          </div>
        )}
      </div>
      <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-2">
        <div
          className={`h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:border-x-[14px] sm:border-t-[24px] ${
            active ? 'border-t-emerald-400' : 'border-t-slate-500'
          }`}
        />
      </div>
    </div>
  );
}

function BicycleFrame() {
  const { rear, front } = HUBS;
  const tubes = [
    [rear, BB],
    [rear, SEAT],
    [BB, SEAT],
    [SEAT, HEAD_TOP],
    [BB, HEAD_BOTTOM],
    [HEAD_TOP, HEAD_BOTTOM],
    [HEAD_BOTTOM, front],
  ];
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
      <line x1={BB.x} y1={BB.y - 34} x2={rear.x} y2={rear.y - 14} stroke="#94a3b8" strokeWidth="4" strokeDasharray="6 4" />
      <line x1={BB.x} y1={BB.y + 34} x2={rear.x} y2={rear.y + 14} stroke="#94a3b8" strokeWidth="4" strokeDasharray="6 4" />
      {tubes.map(([a, b], i) => (
        <line key={`o-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#020617" strokeWidth="20" strokeLinecap="round" />
      ))}
      {tubes.map(([a, b], i) => (
        <line key={`t-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#10b981" strokeWidth="11" strokeLinecap="round" />
      ))}
      <line x1={SEAT.x} y1={SEAT.y} x2={SEAT.x - 8} y2={SEAT.y - 36} stroke="#020617" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${SEAT.x - 58} ${SEAT.y - 42} Q ${SEAT.x - 10} ${SEAT.y - 58} ${SEAT.x + 34} ${SEAT.y - 40} L ${SEAT.x - 50} ${SEAT.y - 30} Z`} fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <line x1={HEAD_TOP.x} y1={HEAD_TOP.y} x2={HEAD_TOP.x - 10} y2={HEAD_TOP.y - 30} stroke="#020617" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${HEAD_TOP.x - 40} ${HEAD_TOP.y - 34} L ${HEAD_TOP.x + 10} ${HEAD_TOP.y - 32} Q ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 30} ${HEAD_TOP.x + 40} ${HEAD_TOP.y}`} fill="none" stroke="#0f172a" strokeWidth="10" strokeLinecap="round" />
      <circle cx={BB.x} cy={BB.y} r="34" fill="#0f172a" stroke="#94a3b8" strokeWidth="5" />
      <line x1={BB.x} y1={BB.y} x2={BB.x + 30} y2={BB.y + 52} stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
      <rect x={BB.x + 14} y={BB.y + 50} width="34" height="10" rx="3" fill="#475569" />
    </svg>
  );
}

function WheelHubs() {
  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="pointer-events-none absolute inset-0 z-10 h-full w-full">
      {[HUBS.rear, HUBS.front].map((hub, i) => (
        <g key={i}>
          <circle cx={hub.x} cy={hub.y} r="24" fill="#0f172a" stroke="#10b981" strokeWidth="5" />
          <circle cx={hub.x} cy={hub.y} r="7" fill="#10b981" />
        </g>
      ))}
    </svg>
  );
}

export default function BicycleWheelModal({ isOpen, onClose, user, onRewardsUpdated }) {
  const [config, setConfig] = useState(DEFAULT_SLICES);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [stage, setStage] = useState('front');
  const [rotations, setRotations] = useState({ front: 0, rear: 0 });
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage('front');
    setRotations({ front: 0, rear: 0 });
    setResult(null);
    setError('');

    let cancelled = false;
    (async () => {
      setLoadingConfig(true);
      const { data, error: fetchError } = await supabase
        .from('wheel_config')
        .select('stage, label, color, weight, reward_type, stamps, is_upgrade, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (!fetchError && data?.length) {
        const front = data.filter((s) => s.stage === 'front');
        const rear = data.filter((s) => s.stage === 'rear');
        setConfig({
          front: front.length ? front : DEFAULT_SLICES.front,
          rear: rear.length ? rear : DEFAULT_SLICES.rear,
        });
      } else {
        setConfig(DEFAULT_SLICES);
      }
      setLoadingConfig(false);
    })();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  const saveReward = useCallback(
    async (slice, wonStage) => {
      if (!user?.id) {
        setError('Sign in to save your reward.');
        return;
      }
      const { error: insertError } = await supabase.from('wheel_rewards').insert({
        user_id: user.id,
        stage: wonStage,
        label: slice.label,
        reward_type: slice.reward_type,
        stamps_awarded: slice.stamps || 0,
      });
      if (insertError) {
        setError(`Could not save reward: ${insertError.message}`);
        return;
      }
      if ((slice.stamps || 0) > 0) {
        const { error: rpcError } = await supabase.rpc('award_wheel_stamps', {
          target_user_id: user.id,
          stamps_to_add: slice.stamps,
        });
        if (rpcError) {
          setError(`Could not add stamps: ${rpcError.message}`);
          return;
        }
      }
      await onRewardsUpdated?.();
    },
    [user, onRewardsUpdated],
  );

  const spin = () => {
    const slices = config[stage];
    if (spinning || loadingConfig || !slices.length) return;
    setSpinning(true);
    setResult(null);
    setError('');

    const sliceDeg = 360 / slices.length;
    const index = pickWeightedIndex(slices);
    const targetMod = (360 - (index * sliceDeg + sliceDeg / 2)) % 360;
    const current = rotations[stage];
    const delta = (targetMod - (((current % 360) + 360) % 360) + 360) % 360;
    const spinStage = stage;
    setRotations((prev) => ({ ...prev, [spinStage]: current + 360 * 5 + delta }));

    timerRef.current = setTimeout(async () => {
      const won = slices[index];
      setResult({ ...won, stage: spinStage });
      if (won.is_upgrade) {
        setStage('rear');
        setSpinning(false);
        return;
      }
      await saveReward(won, spinStage);
      setSpinning(false);
    }, SPIN_MS);
  };

  if (!isOpen) return null;

  const finished = result && !result.is_upgrade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 p-4 text-white shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          disabled={spinning}
          className="absolute right-4 top-4 z-30 rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:text-white disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-2 text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              stage === 'front'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-400'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {stage === 'front' ? 'Stage 1 · Front Wheel' : 'Stage 2 · Rear Wheel'}
          </span>
          <h3 className="mt-2 text-2xl font-black">Bicycle Prize Wheel</h3>
        </div>

        <div className="relative mx-auto w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
          <BicycleFrame />
          <PrizeWheel
            slices={config.rear}
            rotation={rotations.rear}
            spinning={spinning && stage === 'rear'}
            active={stage === 'rear'}
            locked={stage !== 'rear'}
            hub={HUBS.rear}
          />
          <PrizeWheel
            slices={config.front}
            rotation={rotations.front}
            spinning={spinning && stage === 'front'}
            active={stage === 'front'}
            locked={false}
            hub={HUBS.front}
          />
          <WheelHubs />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Prize Legend</h4>
            <div className="grid grid-cols-2 gap-3">
              {['front', 'rear'].map((key) => (
                <div key={key} className={stage === key ? '' : 'opacity-50'}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase text-slate-300">
                    {key === 'front' ? 'Front Wheel' : 'Rear Wheel (Premium)'}
                  </p>
                  <ul className="space-y-1">
                    {config[key].map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs font-semibold text-white sm:text-sm">
                        <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-slate-950" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-end gap-3">
            {result && (
              <div
                className={`rounded-2xl border p-4 text-center ${
                  result.is_upgrade ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/40 bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-400">
                  <Trophy className="h-4 w-4" />
                  {result.is_upgrade ? 'Rear wheel unlocked!' : 'You won'}
                </div>
                <p className="mt-1 text-lg font-black text-white">
                  {result.is_upgrade ? 'Spin the Rear Wheel for a premium prize' : result.label}
                </p>
              </div>
            )}

            {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <button
              type="button"
              onClick={finished ? onClose : spin}
              disabled={spinning || loadingConfig}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              {(spinning || loadingConfig) && <Loader2 className="h-5 w-5 animate-spin" />}
              {loadingConfig
                ? 'Loading wheel...'
                : spinning
                  ? 'Spinning...'
                  : finished
                    ? 'Collect & Close'
                    : stage === 'rear'
                      ? 'Spin Rear Wheel'
                      : 'Spin Front Wheel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
