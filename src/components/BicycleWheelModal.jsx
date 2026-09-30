import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, Trophy, Sparkles, LifeBuoy, Stamp, Star, ChevronsRight, Tag, Wrench, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';

const SPIN_MS = 3500;
const VIEW_W = 1000;
const VIEW_H = 610;
const TYRE_R = 188;
const RIM_R = 166;
const SLICE_R = 160;
const HUBS = { rear: { x: 212, y: 400 }, front: { x: 790, y: 400 } };
const BB = { x: 474, y: 420 };
const SEAT_JOINT = { x: 440, y: 205 };
const SEAT = { x: 428, y: 152 };
const HEAD_TOP = { x: 712, y: 130 };
const HEAD_BOTTOM = { x: 728, y: 180 };
const GROUND_Y = 592;

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

const REWARD_ICONS = {
  merch: LifeBuoy,
  stamp: Stamp,
  merit: Star,
  upgrade: ChevronsRight,
  discount: Tag,
  service: Wrench,
};

const Tube = ({ d, width = 13 }) => (
  <g strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d={d} stroke="#020617" strokeWidth={width + 7} />
    <path d={d} stroke="url(#bw-frame)" strokeWidth={width} />
    <path d={d} stroke="#064e3b" strokeOpacity="0.55" strokeWidth={Math.max(2, width / 3)} transform="translate(1.5 3)" />
    <path d={d} stroke="#d1fae5" strokeOpacity="0.6" strokeWidth={Math.max(1.5, width / 6)} transform="translate(-1.5 -3)" />
  </g>
);

const line = (a, b) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

const gearPath = (cx, cy, teeth, outer, inner) => {
  const pitch = 360 / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    [
      [a, inner],
      [a + pitch * 0.2, outer],
      [a + pitch * 0.55, outer],
      [a + pitch * 0.75, inner],
    ].forEach(([deg, r]) => pts.push(polar(cx, cy, deg, r).map((n) => n.toFixed(1)).join(' ')));
  }
  return `M ${pts.join(' L ')} Z`;
};

function SvgDefs() {
  return (
    <defs>
      <style>{`@keyframes bw-tick{0%{transform:rotate(0deg)}100%{transform:rotate(-18deg)}}.bw-tick{animation:bw-tick 90ms ease-in-out infinite alternate}`}</style>
      <radialGradient id="bw-stage" cx="50%" cy="55%" r="60%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bw-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1e293b" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bw-horizon" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
        <stop offset="50%" stopColor="#34d399" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="bw-tyre" cx="50%" cy="50%" r="50%">
        <stop offset="87%" stopColor="#111827" />
        <stop offset="93%" stopColor="#1f2937" />
        <stop offset="100%" stopColor="#030712" />
      </radialGradient>
      <linearGradient id="bw-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="35%" stopColor="#94a3b8" />
        <stop offset="55%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      <linearGradient id="bw-steel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <radialGradient id="bw-shade" cx="50%" cy="50%" r="50%">
        <stop offset="50%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
      </radialGradient>
      <linearGradient id="bw-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.24" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="bw-hub" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="55%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </radialGradient>
      <linearGradient id="bw-frame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="bw-bottle" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#94a3b8" />
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
        <stop offset="0%" stopColor="#000" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function PrizeWheel({ id, slices, rotation, spinning, active, locked, hub }) {
  const sliceDeg = 360 / slices.length;
  const { x, y } = hub;
  const wallR = TYRE_R - 13;
  return (
    <g style={{ filter: active ? 'drop-shadow(0 0 18px rgba(16,185,129,0.45))' : 'none' }}>
      <defs>
        <path id={`bw-wall-${id}`} d={`M ${x - wallR} ${y} a ${wallR} ${wallR} 0 1 1 ${2 * wallR} 0 a ${wallR} ${wallR} 0 1 1 ${-2 * wallR} 0`} />
      </defs>
      {active && !spinning && (
        <circle cx={x} cy={y} r={TYRE_R + 8} fill="none" stroke="#34d399" strokeOpacity="0.55" strokeWidth="2" className="animate-pulse" />
      )}
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${x}px ${y}px`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.21, 1)` : 'none',
        }}
      >
        <circle cx={x} cy={y} r={TYRE_R} fill="url(#bw-tyre)" stroke="#000" strokeWidth="3" />
        {Array.from({ length: 120 }).map((_, i) => (
          <rect
            key={i}
            x={x - 3.5}
            y={y - TYRE_R + (i % 2 ? 4 : 1)}
            width="7"
            height="5"
            rx="1.5"
            fill="#0b1120"
            stroke="#1f2937"
            strokeWidth="0.8"
            transform={`rotate(${i * 3} ${x} ${y})`}
          />
        ))}
        <circle cx={x} cy={y} r={TYRE_R - 8} fill="none" stroke="#334155" strokeOpacity="0.7" strokeWidth="1" />
        {['0%', '50%'].map((offset) => (
          <text key={offset} fill="#64748b" fontSize="10" fontWeight="800" letterSpacing="4">
            <textPath href={`#bw-wall-${id}`} startOffset={offset}>
              STAKEY&apos;S CYCLES • PRIZE WHEEL •
            </textPath>
          </text>
        ))}
        <circle cx={x} cy={y} r={RIM_R} fill="#020617" stroke="url(#bw-rim)" strokeWidth="10" />
        <circle cx={x} cy={y} r={RIM_R + 3} fill="none" stroke="#0f172a" strokeOpacity="0.6" strokeWidth="1" />
        <circle cx={x} cy={y} r={RIM_R - 4} fill="none" stroke="#f8fafc" strokeOpacity="0.4" strokeWidth="1" />
        {slices.map((s, i) => (
          <path
            key={i}
            d={slicePath(x, y, i * sliceDeg, (i + 1) * sliceDeg, SLICE_R)}
            fill={s.color}
            stroke="#f8fafc"
            strokeOpacity="0.85"
            strokeWidth="2.5"
          />
        ))}
        {Array.from({ length: 32 }).map((_, i) => {
          const off = i % 2 === 0 ? 14 : -14;
          const [x1, y1] = polar(x, y, i * 11.25 + off, 26);
          const [x2, y2] = polar(x, y, i * 11.25, SLICE_R);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeOpacity="0.22" strokeWidth="1.3" />;
        })}
        {Array.from({ length: 32 }).map((_, i) => {
          const [nx, ny] = polar(x, y, i * 11.25, RIM_R - 3);
          return <circle key={i} cx={nx} cy={ny} r="2" fill="#cbd5e1" />;
        })}
        <rect x={x - 3.5} y={y - RIM_R + 2} width="7" height="16" rx="2" fill="url(#bw-steel)" stroke="#020617" strokeWidth="1" transform={`rotate(6 ${x} ${y})`} />
        {slices.map((s, i) => {
          const mid = i * sliceDeg + sliceDeg / 2;
          const Icon = REWARD_ICONS[s.reward_type] || Gift;
          const lines = wrapLabel(s.label);
          return (
            <g key={i} transform={`rotate(${mid} ${x} ${y})`}>
              <circle cx={x} cy={y - 132} r="17" fill="#020617" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
              <Icon x={x - 10} y={y - 142} width={20} height={20} color="#ffffff" strokeWidth={2.5} />
              <text
                textAnchor="middle"
                fill="#ffffff"
                stroke="#020617"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
                fontSize="17"
                fontWeight="900"
              >
                {lines.map((ln, li) => (
                  <tspan key={li} x={x} y={y - 94 + li * 19}>
                    {ln}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <circle cx={x} cy={y} r="32" fill="url(#bw-hub)" stroke="#020617" strokeWidth="2" />
        {Array.from({ length: 16 }).map((_, i) => {
          const [hx, hy] = polar(x, y, i * 22.5, 27);
          return <circle key={i} cx={hx} cy={hy} r="1.8" fill="#1e293b" />;
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
          <rect x={x - 66} y={y - 98} width="132" height="36" rx="18" fill="#020617" stroke="#f59e0b" strokeOpacity="0.6" strokeWidth="2" />
          <path d={`M ${x - 50} ${y - 82} v -4 a 7 7 0 0 1 14 0 v 4`} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          <rect x={x - 53} y={y - 83} width="20" height="14" rx="3" fill="#fbbf24" />
          <text x={x + 16} y={y - 74} textAnchor="middle" fill="#fbbf24" fontSize="16" fontWeight="800" letterSpacing="2">
            LOCKED
          </text>
        </g>
      )}
    </g>
  );
}

function Pointer({ hub, active, ticking }) {
  const { x, y } = hub;
  const top = y - TYRE_R - 26;
  return (
    <g style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.9))' }}>
      <g className={ticking ? 'bw-tick' : ''} style={{ transformOrigin: `${x}px ${top + 12}px` }}>
        <path
          d={`M ${x} ${y - SLICE_R + 2} L ${x - 17} ${top + 22} A 19 19 0 1 1 ${x + 17} ${top + 22} Z`}
          fill={active ? 'url(#bw-pointer-on)' : 'url(#bw-pointer-off)'}
          stroke="#020617"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d={`M ${x - 9} ${top + 2} A 12 12 0 0 1 ${x + 6} ${top - 2}`} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={x} cy={top + 12} r="7" fill="url(#bw-hub)" stroke="#020617" strokeWidth="2" />
      </g>
    </g>
  );
}

function FrameBehind() {
  const { rear, front } = HUBS;
  return (
    <g>
      <Tube d={line(rear, BB)} width={11} />
      <Tube d={line(rear, SEAT_JOINT)} width={9} />
      <Tube d={`M ${HEAD_BOTTOM.x} ${HEAD_BOTTOM.y} L ${HEAD_BOTTOM.x + 24} ${HEAD_BOTTOM.y + 105} Q ${front.x + 2} ${front.y - 50} ${front.x} ${front.y}`} width={11} />
    </g>
  );
}

function Drivetrain() {
  const { rear } = HUBS;
  const j1 = { x: rear.x + 14, y: rear.y + 50 };
  const j2 = { x: rear.x + 26, y: rear.y + 80 };
  const pedal = { x: BB.x + 44, y: BB.y + 76 };
  const chain = `M ${rear.x} ${rear.y - 24} L ${BB.x} ${BB.y - 51} A 51 51 0 0 1 ${BB.x} ${BB.y + 51} L ${j2.x + 3} ${j2.y + 8} L ${j1.x + 8} ${j1.y} L ${rear.x + 5} ${rear.y + 24} A 24 24 0 0 1 ${rear.x} ${rear.y - 24}`;
  return (
    <g>
      {[26, 22, 18, 14].map((r) => (
        <circle key={r} cx={rear.x} cy={rear.y} r={r} fill="#1e293b" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="3 2" />
      ))}
      <path
        d={`M ${rear.x + 4} ${rear.y + 8} L ${rear.x + 24} ${rear.y + 20} L ${rear.x + 24} ${rear.y + 40} L ${rear.x + 8} ${rear.y + 30} Z`}
        fill="#334155"
        stroke="#020617"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1={j1.x} y1={j1.y} x2={j2.x} y2={j2.y} stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
      <line x1={j1.x} y1={j1.y} x2={j2.x} y2={j2.y} stroke="#475569" strokeWidth="2" strokeLinecap="round" />

      <path d={gearPath(BB.x, BB.y, 44, 53, 48)} fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={BB.x} cy={BB.y} r="44" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
      <path d={gearPath(BB.x, BB.y, 32, 38, 34)} fill="#475569" stroke="#1e293b" strokeWidth="1" />
      <circle cx={BB.x} cy={BB.y} r="31" fill="#0f172a" />
      {Array.from({ length: 5 }).map((_, i) => {
        const [sx, sy] = polar(BB.x, BB.y, i * 72 + 20, 40);
        return (
          <g key={i}>
            <line x1={BB.x} y1={BB.y} x2={sx} y2={sy} stroke="url(#bw-steel)" strokeWidth="8" strokeLinecap="round" />
            <circle cx={sx} cy={sy} r="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
          </g>
        );
      })}

      <path d={chain} fill="none" stroke="#020617" strokeWidth="9" strokeLinejoin="round" />
      <path d={chain} fill="none" stroke="#94a3b8" strokeWidth="5.5" strokeDasharray="6 3" strokeLinejoin="round" />
      <path d={chain} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="0 9" strokeLinecap="round" />

      {[j1, j2].map((j, i) => (
        <g key={i}>
          <circle cx={j.x} cy={j.y} r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" strokeDasharray="2.5 1.5" />
          <circle cx={j.x} cy={j.y} r="3" fill="#10b981" />
        </g>
      ))}
      <polygon
        points={[0, 1, 2, 3, 4, 5].map((k) => polar(rear.x, rear.y, k * 60, 8).join(',')).join(' ')}
        fill="url(#bw-hub)"
        stroke="#020617"
        strokeWidth="1.5"
      />

      <line x1={BB.x} y1={BB.y} x2={pedal.x} y2={pedal.y} stroke="#020617" strokeWidth="17" strokeLinecap="round" />
      <line x1={BB.x} y1={BB.y} x2={pedal.x} y2={pedal.y} stroke="url(#bw-steel)" strokeWidth="12" strokeLinecap="round" />
      <line x1={BB.x + 4} y1={BB.y + 5} x2={pedal.x - 2} y2={pedal.y - 6} stroke="#f8fafc" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" />
      <rect x={pedal.x - 27} y={pedal.y - 7} width="54" height="14" rx="4" fill="#1e293b" stroke="#020617" strokeWidth="2" />
      {[-15, -5, 5, 15].map((dx) => (
        <line key={dx} x1={pedal.x + dx} y1={pedal.y - 4} x2={pedal.x + dx} y2={pedal.y + 4} stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
      ))}
      <circle cx={pedal.x} cy={pedal.y} r="5" fill="url(#bw-hub)" stroke="#020617" strokeWidth="1.5" />
      <circle cx={BB.x} cy={BB.y} r="12" fill="url(#bw-hub)" stroke="#020617" strokeWidth="2" />
      <circle cx={BB.x} cy={BB.y} r="4" fill="#0f172a" />
    </g>
  );
}

function FrameFront() {
  const { front } = HUBS;
  const downAngle = (Math.atan2(HEAD_BOTTOM.y - BB.y, HEAD_BOTTOM.x - BB.x) * 180) / Math.PI;
  const topEnd = { x: HEAD_TOP.x, y: HEAD_TOP.y + 10 };
  const topAngle = (Math.atan2(topEnd.y - SEAT_JOINT.y, topEnd.x - SEAT_JOINT.x) * 180) / Math.PI;
  const at = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const decal = at(BB, HEAD_BOTTOM, 0.63);
  const topDecal = at(SEAT_JOINT, topEnd, 0.5);
  const downLen = Math.hypot(HEAD_BOTTOM.x - BB.x, HEAD_BOTTOM.y - BB.y);
  const downDir = { x: (HEAD_BOTTOM.x - BB.x) / downLen, y: (HEAD_BOTTOM.y - BB.y) / downLen };
  const bottleBase = at(BB, HEAD_BOTTOM, 0.4);
  const bottle = { x: bottleBase.x + downDir.y * 22, y: bottleBase.y - downDir.x * 22 };
  const headMid = at(HEAD_TOP, HEAD_BOTTOM, 0.5);
  const bar = `M ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 26} Q ${HEAD_TOP.x + 86} ${HEAD_TOP.y - 30} ${HEAD_TOP.x + 84} ${HEAD_TOP.y + 4} Q ${HEAD_TOP.x + 82} ${HEAD_TOP.y + 34} ${HEAD_TOP.x + 54} ${HEAD_TOP.y + 30}`;
  return (
    <g>
      <line x1={SEAT.x} y1={SEAT.y} x2={SEAT_JOINT.x + 3} y2={SEAT_JOINT.y + 18} stroke="#020617" strokeWidth="13" strokeLinecap="round" />
      <line x1={SEAT.x} y1={SEAT.y} x2={SEAT_JOINT.x + 3} y2={SEAT_JOINT.y + 18} stroke="url(#bw-steel)" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${SEAT.x - 40} ${SEAT.y - 8} L ${SEAT.x - 4} ${SEAT.y + 2} L ${SEAT.x + 36} ${SEAT.y - 10}`} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x={SEAT.x - 9} y={SEAT.y - 4} width="18" height="10" rx="3" fill="#1e293b" stroke="#020617" strokeWidth="1.5" />
      <path
        d={`M ${SEAT.x - 68} ${SEAT.y - 18} C ${SEAT.x - 68} ${SEAT.y - 34}, ${SEAT.x - 20} ${SEAT.y - 30}, ${SEAT.x + 10} ${SEAT.y - 24} L ${SEAT.x + 52} ${SEAT.y - 18} C ${SEAT.x + 60} ${SEAT.y - 16}, ${SEAT.x + 58} ${SEAT.y - 9}, ${SEAT.x + 48} ${SEAT.y - 9} L ${SEAT.x - 10} ${SEAT.y - 7} C ${SEAT.x - 40} ${SEAT.y - 5}, ${SEAT.x - 68} ${SEAT.y - 4}, ${SEAT.x - 68} ${SEAT.y - 18} Z`}
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d={`M ${SEAT.x - 60} ${SEAT.y - 24} C ${SEAT.x - 30} ${SEAT.y - 31}, ${SEAT.x + 10} ${SEAT.y - 27}, ${SEAT.x + 48} ${SEAT.y - 17}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
      <path d={`M ${SEAT.x - 62} ${SEAT.y - 12} C ${SEAT.x - 40} ${SEAT.y - 12}, ${SEAT.x - 10} ${SEAT.y - 12}, ${SEAT.x + 20} ${SEAT.y - 13}`} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 3" />

      <Tube d={line(BB, SEAT_JOINT)} width={14} />
      <Tube d={line(SEAT_JOINT, topEnd)} width={13} />
      <Tube d={line(BB, { x: HEAD_BOTTOM.x - 2, y: HEAD_BOTTOM.y - 6 })} width={17} />
      <Tube d={line(HEAD_TOP, HEAD_BOTTOM)} width={20} />
      {[SEAT_JOINT, topEnd, { x: HEAD_BOTTOM.x - 3, y: HEAD_BOTTOM.y - 6 }].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="9" fill="url(#bw-frame)" stroke="#020617" strokeWidth="2.5" />
          <circle cx={p.x - 2.5} cy={p.y - 2.5} r="2.5" fill="#d1fae5" fillOpacity="0.7" />
        </g>
      ))}
      <rect x={SEAT_JOINT.x - 10} y={SEAT_JOINT.y - 16} width="20" height="9" rx="3" fill="#1e293b" stroke="#020617" strokeWidth="1.5" transform={`rotate(-12 ${SEAT_JOINT.x} ${SEAT_JOINT.y})`} />

      <text
        x={decal.x}
        y={decal.y}
        transform={`rotate(${downAngle} ${decal.x} ${decal.y})`}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ecfdf5"
        fontSize="12"
        fontStyle="italic"
        fontWeight="900"
        letterSpacing="3"
      >
        STAKEY&apos;S
      </text>
      <text
        x={topDecal.x}
        y={topDecal.y}
        transform={`rotate(${topAngle} ${topDecal.x} ${topDecal.y})`}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#064e3b"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="2.5"
      >
        LOYALTY CLUB
      </text>
      <circle cx={headMid.x} cy={headMid.y} r="7" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
      <text x={headMid.x} y={headMid.y + 3.2} textAnchor="middle" fill="#78350f" fontSize="9" fontWeight="900">
        S
      </text>

      <line x1={HEAD_BOTTOM.x + 3} y1={HEAD_BOTTOM.y + 2} x2={BB.x + 13} y2={BB.y - 12} stroke="#0f172a" strokeWidth="2.5" strokeOpacity="0.9" />
      <path d={`M ${HEAD_TOP.x + 72} ${HEAD_TOP.y - 4} C ${HEAD_TOP.x + 62} ${HEAD_TOP.y + 50}, ${HEAD_TOP.x + 10} ${HEAD_TOP.y + 44}, ${HEAD_TOP.x - 6} ${HEAD_TOP.y + 26}`} fill="none" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />

      <g transform={`rotate(${downAngle} ${bottle.x} ${bottle.y})`}>
        <rect x={bottle.x - 36} y={bottle.y - 12} width="64" height="24" rx="10" fill="url(#bw-bottle)" stroke="#020617" strokeWidth="2.5" />
        <rect x={bottle.x - 14} y={bottle.y - 12} width="22" height="24" fill="#10b981" fillOpacity="0.9" />
        <text x={bottle.x - 3} y={bottle.y + 4} textAnchor="middle" fill="#ecfdf5" fontSize="11" fontWeight="900">
          S
        </text>
        <rect x={bottle.x + 27} y={bottle.y - 7} width="12" height="14" rx="3" fill="#10b981" stroke="#020617" strokeWidth="2" />
        <rect x={bottle.x + 39} y={bottle.y - 3} width="5" height="6" rx="1" fill="#f8fafc" stroke="#020617" strokeWidth="1" />
        <path d={`M ${bottle.x - 30} ${bottle.y + 14} L ${bottle.x + 18} ${bottle.y + 14} M ${bottle.x - 26} ${bottle.y + 14} L ${bottle.x - 30} ${bottle.y - 4} M ${bottle.x + 12} ${bottle.y + 14} L ${bottle.x + 16} ${bottle.y - 6}`} fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
      </g>

      <rect x={HEAD_BOTTOM.x - 14} y={HEAD_BOTTOM.y - 2} width="32" height="13" rx="5" fill="url(#bw-frame)" stroke="#020617" strokeWidth="2.5" />
      <path d={`M ${HEAD_BOTTOM.x - 8} ${HEAD_BOTTOM.y + 12} q 12 12 26 2`} fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />

      <path d={`M ${HEAD_TOP.x - 3} ${HEAD_TOP.y + 4} L ${HEAD_TOP.x + 2} ${HEAD_TOP.y - 16} L ${HEAD_TOP.x + 44} ${HEAD_TOP.y - 26}`} fill="none" stroke="#1e293b" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {[0.35, 0.7].map((t) => {
        const p = at({ x: HEAD_TOP.x + 2, y: HEAD_TOP.y - 16 }, { x: HEAD_TOP.x + 44, y: HEAD_TOP.y - 26 }, t);
        return <circle key={t} cx={p.x} cy={p.y} r="2.2" fill="#94a3b8" />;
      })}
      <path d={bar} fill="none" stroke="#020617" strokeWidth="14" strokeLinecap="round" />
      <path d={bar} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray="6 2" />
      <path d={`M ${HEAD_TOP.x + 70} ${HEAD_TOP.y - 26} q 14 4 10 30 l -6 2`} fill="#334155" stroke="#020617" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={HEAD_TOP.x + 2} cy={HEAD_TOP.y - 16} r="5" fill="#94a3b8" />

      <circle cx={front.x} cy={front.y} r="20" fill="url(#bw-hub)" stroke="#020617" strokeWidth="3" />
      <circle cx={front.x} cy={front.y} r="7" fill="#10b981" stroke="#020617" strokeWidth="2" />
      <path d={`M ${front.x} ${front.y} Q ${front.x - 18} ${front.y - 14} ${front.x - 40} ${front.y - 10}`} fill="none" stroke="#020617" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${front.x} ${front.y} Q ${front.x - 18} ${front.y - 14} ${front.x - 40} ${front.y - 10}`} fill="none" stroke="#cbd5e1" strokeWidth="4.5" strokeLinecap="round" />
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
          <text x={VIEW_W / 2} y="118" textAnchor="middle" fill="#ffffff" fillOpacity="0.035" fontSize="112" fontWeight="900" letterSpacing="6">
            STAKEY&apos;S
          </text>
          <rect x="0" y={GROUND_Y} width={VIEW_W} height={VIEW_H - GROUND_Y} fill="url(#bw-floor)" />
          <line x1="20" y1={GROUND_Y} x2={VIEW_W - 20} y2={GROUND_Y} stroke="url(#bw-horizon)" strokeWidth="2" />
          {[HUBS.rear, HUBS.front].map((hub, i) => (
            <ellipse key={i} cx={hub.x} cy={GROUND_Y} rx={TYRE_R * 0.9} ry="12" fill="url(#bw-ground)" />
          ))}
          <FrameBehind />
          <PrizeWheel
            id="rear"
            slices={config.rear}
            rotation={rotations.rear}
            spinning={spinning && stage === 'rear'}
            active={stage === 'rear'}
            locked={stage !== 'rear'}
            hub={HUBS.rear}
          />
          <PrizeWheel
            id="front"
            slices={config.front}
            rotation={rotations.front}
            spinning={spinning && stage === 'front'}
            active={stage === 'front'}
            locked={false}
            hub={HUBS.front}
          />
          <Drivetrain />
          <FrameFront />
          <Pointer hub={HUBS.rear} active={stage === 'rear'} ticking={spinning && stage === 'rear'} />
          <Pointer hub={HUBS.front} active={stage === 'front'} ticking={spinning && stage === 'front'} />
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
                  <ul className="space-y-2">
                    {config[key].map((s, i) => (
                      <li key={i} className="text-xs font-semibold text-white sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-slate-950" style={{ backgroundColor: s.color }} />
                          <span className="flex-1">{s.label}</span>
                          <span className="text-[10px] font-bold tabular-nums text-slate-400">{oddsPct(s, config[key])}%</span>
                        </div>
                        <div className="ml-5 mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full" style={{ width: `${oddsPct(s, config[key])}%`, backgroundColor: s.color }} />
                        </div>
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
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
