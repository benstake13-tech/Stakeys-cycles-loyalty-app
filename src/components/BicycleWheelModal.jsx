import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Trophy, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';

const SPIN_MS = 3500;
const VIEW_W = 1000;
const VIEW_H = 620;
const TYRE_R = 195;
const RIM_R = 172;
const SLICE_R = 166;
const HUBS = { rear: { x: 222, y: 400 }, front: { x: 778, y: 400 } };
const BB = { x: 490, y: 418 };
const SEAT_JOINT = { x: 452, y: 200 };
const SEAT = { x: 440, y: 150 };
const HEAD_TOP = { x: 722, y: 150 };
const HEAD_BOTTOM = { x: 740, y: 200 };
const GROUND_Y = 604;

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

const polar = (cx, cy, deg, radius) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
};

const slicePath = (cx, cy, start, end, radius) => {
  const [x1, y1] = polar(cx, cy, start, radius);
  const [x2, y2] = polar(cx, cy, end, radius);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
};

const wrapLabel = (label, max = 11) =>
  label.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);

const oddsPct = (slice, slices) => {
  const total = slices.reduce((sum, s) => sum + Math.max(0, Number(s.weight) || 0), 0);
  return total > 0 ? Math.round(((Number(slice.weight) || 0) / total) * 100) : 0;
};

const Tube = ({ d, width = 13 }) => (
  <g strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d={d} stroke="#020617" strokeWidth={width + 7} />
    <path d={d} stroke="url(#bw-frame)" strokeWidth={width} />
    <path d={d} stroke="#a7f3d0" strokeOpacity="0.55" strokeWidth={Math.max(2, width / 5)} transform="translate(-1.5 -2.5)" />
  </g>
);

const line = (a, b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

function SvgDefs() {
  return (
    <defs>
      <radialGradient id="bw-stage" cx="50%" cy="55%" r="60%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.14" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bw-tyre" cx="50%" cy="50%" r="50%">
        <stop offset="86%" stopColor="#1e293b" />
        <stop offset="93%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#020617" />
      </radialGradient>
      <linearGradient id="bw-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="35%" stopColor="#94a3b8" />
        <stop offset="55%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      <radialGradient id="bw-shade" cx="50%" cy="50%" r="50%">
        <stop offset="55%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
      </radialGradient>
      <linearGradient id="bw-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="bw-hub" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="60%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </radialGradient>
      <linearGradient id="bw-frame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="bw-pointer-on" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="bw-pointer-off" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <radialGradient id="bw-ground" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function PrizeWheel({ slices, rotation, spinning, active, locked, hub }) {
  const sliceDeg = 360 / slices.length;
  const { x, y } = hub;
  return (
    <g
      style={{
        filter: active ? 'drop-shadow(0 0 18px rgba(16,185,129,0.45))' : 'none',
      }}
    >
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${x}px ${y}px`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.21, 1)` : 'none',
        }}
      >
        <circle cx={x} cy={y} r={TYRE_R} fill="url(#bw-tyre)" stroke="#020617" strokeWidth="4" />
        {Array.from({ length: 60 }).map((_, i) => (
          <rect
            key={i}
            x={x - 5}
            y={y - TYRE_R - 3}
            width="10"
            height="9"
            rx="2.5"
            fill="#1e293b"
            stroke="#020617"
            strokeWidth="1.5"
            transform={`rotate(${i * 6} ${x} ${y})`}
          />
        ))}
        <circle cx={x} cy={y} r={TYRE_R - 13} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="10 7" />
        <circle cx={x} cy={y} r={RIM_R} fill="#020617" stroke="url(#bw-rim)" strokeWidth="10" />
        {slices.map((s, i) => {
          const start = i * sliceDeg;
          const mid = start + sliceDeg / 2;
          const lines = wrapLabel(s.label);
          const lh = 21;
          return (
            <g key={i}>
              <path d={slicePath(x, y, start, start + sliceDeg, SLICE_R)} fill={s.color} stroke="#f8fafc" strokeOpacity="0.85" strokeWidth="2.5" />
              <text
                transform={`rotate(${mid - 90} ${x} ${y})`}
                textAnchor="middle"
                fill="#ffffff"
                stroke="#020617"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
                fontSize="19"
                fontWeight="900"
                letterSpacing="0.3"
              >
                {lines.map((ln, li) => (
                  <tspan key={li} x={x + 100} y={y + (li - (lines.length - 1) / 2) * lh + 7}>
                    {ln}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 32 }).map((_, i) => {
          const off = i % 2 === 0 ? 14 : -14;
          const [x1, y1] = polar(x, y, i * 11.25 + off, 22);
          const [x2, y2] = polar(x, y, i * 11.25, SLICE_R);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeOpacity="0.28" strokeWidth="1.3" />;
        })}
        {Array.from({ length: 32 }).map((_, i) => {
          const [nx, ny] = polar(x, y, i * 11.25, RIM_R - 3);
          return <circle key={i} cx={nx} cy={ny} r="2" fill="#cbd5e1" />;
        })}
      </g>
      <circle cx={x} cy={y} r={SLICE_R} fill="url(#bw-shade)" pointerEvents="none" />
      <path
        d={`M ${x - SLICE_R + 22} ${y - 30} A ${SLICE_R - 20} ${SLICE_R - 20} 0 0 1 ${x + SLICE_R - 22} ${y - 30} Q ${x} ${y - 70} ${x - SLICE_R + 22} ${y - 30} Z`}
        fill="url(#bw-gloss)"
        pointerEvents="none"
      />
      {locked && (
        <g>
          <circle cx={x} cy={y} r={RIM_R - 5} fill="#020617" fillOpacity="0.62" />
          <rect x={x - 66} y={y + 62} width="132" height="36" rx="18" fill="#020617" stroke="#f59e0b" strokeOpacity="0.6" strokeWidth="2" />
          <path d={`M ${x - 50} ${y + 78} v -4 a 7 7 0 0 1 14 0 v 4`} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <rect x={x - 53} y={y + 77} width="20" height="14" rx="3" fill="#fbbf24" />
          <text x={x + 16} y={y + 86} textAnchor="middle" fill="#fbbf24" fontSize="16" fontWeight="800" letterSpacing="2">
            LOCKED
          </text>
        </g>
      )}
    </g>
  );
}

function Pointer({ hub, active }) {
  const { x, y } = hub;
  const top = y - TYRE_R - 26;
  return (
    <g style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.9))' }}>
      <path
        d={`M ${x} ${y - RIM_R + 20} L ${x - 17} ${top + 22} A 19 19 0 1 1 ${x + 17} ${top + 22} Z`}
        fill={active ? 'url(#bw-pointer-on)' : 'url(#bw-pointer-off)'}
        stroke="#020617"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx={x} cy={top + 12} r="6" fill="#020617" />
    </g>
  );
}

function FrameBehind() {
  const { rear, front } = HUBS;
  return (
    <g>
      <Tube d={line(rear, BB)} width={11} />
      <Tube d={line(rear, SEAT_JOINT)} width={9} />
      <Tube d={`M ${HEAD_BOTTOM.x} ${HEAD_BOTTOM.y} L ${HEAD_BOTTOM.x + 22} ${HEAD_BOTTOM.y + 110} Q ${front.x + 4} ${front.y - 40} ${front.x} ${front.y}`} width={11} />
    </g>
  );
}

function FrameFront() {
  const { rear, front } = HUBS;
  const crank = { x: BB.x + 34, y: BB.y + 58 };
  return (
    <g>
      <line x1={SEAT.x} y1={SEAT.y} x2={SEAT_JOINT.x + 3} y2={SEAT_JOINT.y + 18} stroke="#94a3b8" strokeWidth="9" strokeLinecap="round" />
      <path
        d={`M ${SEAT.x - 70} ${SEAT.y - 8} C ${SEAT.x - 60} ${SEAT.y - 28}, ${SEAT.x + 10} ${SEAT.y - 30}, ${SEAT.x + 48} ${SEAT.y - 14} C ${SEAT.x + 40} ${SEAT.y - 4}, ${SEAT.x - 10} ${SEAT.y}, ${SEAT.x - 70} ${SEAT.y - 8} Z`}
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="3"
      />
      <path d={`M ${SEAT.x - 60} ${SEAT.y - 16} C ${SEAT.x - 30} ${SEAT.y - 26}, ${SEAT.x + 10} ${SEAT.y - 26}, ${SEAT.x + 36} ${SEAT.y - 16}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.8" />

      <path d={`M ${BB.x} ${BB.y - 46} L ${rear.x} ${rear.y - 17}`} stroke="#94a3b8" strokeWidth="5" strokeDasharray="7 3" />
      <path d={`M ${BB.x} ${BB.y + 46} L ${rear.x} ${rear.y + 17}`} stroke="#94a3b8" strokeWidth="5" strokeDasharray="7 3" />
      <circle cx={rear.x} cy={rear.y} r="20" fill="#1e293b" stroke="#94a3b8" strokeWidth="4" strokeDasharray="4 2" />

      <Tube d={line(BB, SEAT_JOINT)} width={14} />
      <Tube d={line(SEAT_JOINT, { x: HEAD_TOP.x, y: HEAD_TOP.y + 10 })} width={13} />
      <Tube d={line(BB, { x: HEAD_BOTTOM.x - 2, y: HEAD_BOTTOM.y - 6 })} width={17} />
      <Tube d={line(HEAD_TOP, HEAD_BOTTOM)} width={20} />

      <path d={`M ${HEAD_TOP.x - 3} ${HEAD_TOP.y + 4} L ${HEAD_TOP.x + 2} ${HEAD_TOP.y - 16} L ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 26}`} fill="none" stroke="#1e293b" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={`M ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 26} Q ${HEAD_TOP.x + 86} ${HEAD_TOP.y - 30} ${HEAD_TOP.x + 84} ${HEAD_TOP.y + 4} Q ${HEAD_TOP.x + 82} ${HEAD_TOP.y + 34} ${HEAD_TOP.x + 54} ${HEAD_TOP.y + 30}`}
        fill="none"
        stroke="#020617"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d={`M ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 26} Q ${HEAD_TOP.x + 86} ${HEAD_TOP.y - 30} ${HEAD_TOP.x + 84} ${HEAD_TOP.y + 4} Q ${HEAD_TOP.x + 82} ${HEAD_TOP.y + 34} ${HEAD_TOP.x + 54} ${HEAD_TOP.y + 30}`}
        fill="none"
        stroke="#10b981"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="6 2"
      />
      <path d={`M ${HEAD_TOP.x + 70} ${HEAD_TOP.y - 26} q 14 4 10 30 l -6 2`} fill="#334155" stroke="#020617" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={HEAD_TOP.x + 2} cy={HEAD_TOP.y - 16} r="5" fill="#94a3b8" />

      <circle cx={BB.x} cy={BB.y} r="46" fill="none" stroke="#cbd5e1" strokeWidth="7" strokeDasharray="5 3" />
      <circle cx={BB.x} cy={BB.y} r="40" fill="#0f172a" stroke="#64748b" strokeWidth="3" />
      {Array.from({ length: 5 }).map((_, i) => {
        const [sx, sy] = polar(BB.x, BB.y, i * 72, 38);
        return <line key={i} x1={BB.x} y1={BB.y} x2={sx} y2={sy} stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />;
      })}
      <line x1={BB.x} y1={BB.y} x2={crank.x} y2={crank.y} stroke="#e2e8f0" strokeWidth="11" strokeLinecap="round" />
      <rect x={crank.x - 22} y={crank.y - 6} width="44" height="12" rx="4" fill="#334155" stroke="#020617" strokeWidth="2" />
      <circle cx={BB.x} cy={BB.y} r="11" fill="url(#bw-hub)" stroke="#020617" strokeWidth="2" />

      {[rear, front].map((hub, i) => (
        <g key={i}>
          <circle cx={hub.x} cy={hub.y} r="24" fill="url(#bw-hub)" stroke="#020617" strokeWidth="3" />
          <circle cx={hub.x} cy={hub.y} r="9" fill="#10b981" stroke="#020617" strokeWidth="2" />
        </g>
      ))}
    </g>
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
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.45 }, colors: ['#10b981', '#34d399', won.color, '#f8fafc'] });
      await saveReward(won, spinStage);
      setSpinning(false);
    }, SPIN_MS);
  };

  if (!isOpen) return null;

  const finished = result && !result.is_upgrade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-4xl rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-3 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] sm:p-6">
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

        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-auto w-full select-none" role="img" aria-label="Bicycle with front and rear prize wheels">
          <SvgDefs />
          <rect width={VIEW_W} height={VIEW_H} fill="url(#bw-stage)" />
          <line x1="20" y1={GROUND_Y} x2={VIEW_W - 20} y2={GROUND_Y} stroke="#1e293b" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
          {[HUBS.rear, HUBS.front].map((hub, i) => (
            <ellipse key={i} cx={hub.x} cy={GROUND_Y} rx={TYRE_R * 0.9} ry="14" fill="url(#bw-ground)" />
          ))}
          <FrameBehind />
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
          <FrameFront />
          <Pointer hub={HUBS.rear} active={stage === 'rear'} />
          <Pointer hub={HUBS.front} active={stage === 'front'} />
        </svg>

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
                        <span className="flex-1">{s.label}</span>
                        <span className="text-[10px] font-bold tabular-nums text-slate-400">{oddsPct(s, config[key])}%</span>
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
