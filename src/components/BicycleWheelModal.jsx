import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Trophy, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SPIN_MS = 3500;
const SIZE = 320;
const R = SIZE / 2;

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
  return [R + radius * Math.cos(rad), R + radius * Math.sin(rad)];
};

const wrapLabel = (label, max = 12) =>
  label.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);

const slicePath = (start, end, radius) => {
  const [x1, y1] = polar(start, radius);
  const [x2, y2] = polar(end, radius);
  const large = end - start > 180 ? 1 : 0;
  return `M ${R} ${R} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
};

export default function BicycleWheelModal({ isOpen, onClose, user, onRewardsUpdated }) {
  const [config, setConfig] = useState(DEFAULT_SLICES);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [stage, setStage] = useState('front');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  const slices = config[stage];
  const sliceDeg = 360 / slices.length;

  useEffect(() => {
    if (!isOpen) return;
    setStage('front');
    setRotation(0);
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
    if (spinning || loadingConfig || !slices.length) return;
    setSpinning(true);
    setResult(null);
    setError('');

    const index = pickWeightedIndex(slices);
    const sliceCenter = index * sliceDeg + sliceDeg / 2;
    const targetMod = (360 - sliceCenter) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const spinStage = stage;
    setRotation(rotation + 360 * 5 + delta);

    timerRef.current = setTimeout(async () => {
      const won = slices[index];
      if (won.is_upgrade) {
        setResult({ ...won, stage: spinStage });
        setStage('rear');
        setRotation(0);
        setSpinning(false);
        return;
      }
      setResult({ ...won, stage: spinStage });
      await saveReward(won, spinStage);
      setSpinning(false);
    }, SPIN_MS);
  };

  if (!isOpen) return null;

  const finished = result && !result.is_upgrade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={spinning}
          className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:text-white disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 text-center">
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

        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="relative shrink-0" style={{ width: SIZE + 32, height: SIZE + 32 }}>
            <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
              <div className="h-0 w-0 border-x-[14px] border-t-[24px] border-x-transparent border-t-emerald-400 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" />
            </div>

            <div className="absolute inset-0 rounded-full border-[16px] border-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <div className="pointer-events-none absolute -inset-[12px] rounded-full border-[3px] border-dashed border-slate-600" />
              <svg
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="block"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.21, 1)` : 'none',
                }}
              >
                {slices.map((s, i) => {
                  const start = i * sliceDeg;
                  const mid = start + sliceDeg / 2;
                  return (
                    <g key={`${stage}-${i}`}>
                      <path d={slicePath(start, start + sliceDeg, R)} fill={s.color} stroke="#0f172a" strokeWidth="2" />
                      <text
                        x={R}
                        y={R - R * 0.68}
                        transform={`rotate(${mid} ${R} ${R})`}
                        textAnchor="middle"
                        fill="#ffffff"
                        stroke="#020617"
                        strokeWidth="3"
                        paintOrder="stroke"
                        fontSize={slices.length > 3 ? 12 : 13}
                        fontWeight="800"
                      >
                        {wrapLabel(s.label).map((line, li) => (
                          <tspan key={li} x={R} dy={li === 0 ? 0 : '1.15em'}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
                <circle cx={R} cy={R} r="34" fill="#0f172a" stroke="#10b981" strokeWidth="4" />
                {Array.from({ length: 12 }).map((_, i) => {
                  const [x, y] = polar(i * 30, 30);
                  return <line key={i} x1={R} y1={R} x2={x} y2={y} stroke="#475569" strokeWidth="1.5" />;
                })}
                <circle cx={R} cy={R} r="8" fill="#10b981" />
              </svg>
            </div>
          </div>

          <div className="w-full flex-1 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Prize Legend</h4>
              {(['front', 'rear']).map((key) => (
                <div key={key} className={`mb-3 last:mb-0 ${stage === key ? '' : 'opacity-50'}`}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase text-slate-300">
                    {key === 'front' ? 'Front Wheel' : 'Rear Wheel (Premium)'}
                  </p>
                  <ul className="space-y-1">
                    {config[key].map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-white">
                        <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-slate-950" style={{ backgroundColor: s.color }} />
                        <span className="font-semibold">{s.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {result && (
              <div
                className={`rounded-2xl border p-4 text-center ${
                  result.is_upgrade ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/40 bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-400">
                  <Trophy className="h-4 w-4" />
                  {result.is_upgrade ? 'Upgrade unlocked!' : 'You won'}
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
