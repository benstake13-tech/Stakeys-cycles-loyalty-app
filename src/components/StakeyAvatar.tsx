/**
 * Virtual Stakey — the animated helper character.
 *
 * A hand-built SVG figure whose features are driven entirely by a
 * `StakeyAvatarConfig`, so the same component renders any character the staff
 * create in the Avatar Creator. Motion is CSS-only (see the `.stakey-*` rules in
 * `src/index.css`): a gentle idle float, a blinking loop, and a talking mouth —
 * all of which stop under `prefers-reduced-motion`.
 */
import React from 'react';
import type { StakeyAvatarConfig } from '../shared/types/bikeShop';
import {
  DEFAULT_ACCENT,
  HAIR_COLOR_HEX,
  OUTFIT_COLOR_HEX,
  SKIN_HEX,
} from '../shared/data/stakeyAvatar';

export interface StakeyAvatarProps {
  config: StakeyAvatarConfig;
  size?: number;
  /** When true, run the talking mouth animation (e.g. while speaking). */
  talking?: boolean;
  className?: string;
}

export function StakeyAvatar({ config, size = 120, talking = false, className }: StakeyAvatarProps) {
  const accent = config.accentColor || DEFAULT_ACCENT;
  const outfit = OUTFIT_COLOR_HEX[config.outfitColor];
  const skin = SKIN_HEX[config.skin];
  const hair = HAIR_COLOR_HEX[config.hairColor];
  const isRobot = config.species === 'robot';

  // A slim/regular/stocky build nudges the torso width and head scale.
  const build = { slim: { w: 46, head: 0.96 }, regular: { w: 54, head: 1 }, stocky: { w: 64, head: 1.04 } }[
    config.body
  ];

  const headCx = 100;
  const headCy = 74;
  const headR = 40 * build.head;
  const mouthClass = talking ? 'stakey-mouth stakey-mouth--talking' : 'stakey-mouth';

  return (
    <svg
      viewBox="0 0 200 260"
      width={size}
      height={size * 1.3}
      className={className}
      role="img"
      aria-label={`${config.name}, your helper`}
    >
      <defs>
        <radialGradient id="stakey-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft contact shadow / accent glow */}
      <ellipse cx="100" cy="242" rx="58" ry="12" fill="url(#stakey-floor)" />

      <g className="stakey-float">
        {/* Body */}
        <path
          d={`M ${100 - build.w / 2} 150
              Q 100 138 ${100 + build.w / 2} 150
              L ${100 + build.w / 2 + 6} 224
              Q 100 236 ${100 - build.w / 2 - 6} 224 Z`}
          fill={outfit.base}
          stroke={outfit.dark}
          strokeWidth="2.5"
        />

        {/* Outfit detail: overall bib / zip depending on style */}
        {config.outfit === 'overalls' && (
          <path d={`M 88 150 L 88 206 M 112 150 L 112 206`} stroke={outfit.dark} strokeWidth="3" fill="none" />
        )}
        {config.outfit === 'hoodie' && (
          <>
            <path d="M 82 152 Q 100 168 118 152" stroke={outfit.dark} strokeWidth="3" fill="none" />
            <path d="M 100 168 L 100 196" stroke={outfit.dark} strokeWidth="2.5" fill="none" />
          </>
        )}
        {config.outfit === 'polo' && (
          <path d="M 100 150 L 100 176 M 92 150 L 100 162 L 108 150" stroke={outfit.dark} strokeWidth="2.5" fill="none" />
        )}
        {config.outfit === 'tee' && <path d="M 78 162 L 122 162" stroke={outfit.dark} strokeWidth="2.5" fill="none" />}

        {/* Chest badge in the accent colour */}
        <circle cx="100" cy="176" r="9" fill={accent} opacity="0.95" />
        <path d="M 96 176 l 3 3 l 5 -6" stroke="#04210f" strokeWidth="2.2" fill="none" strokeLinecap="round" />

        {/* Arms */}
        <rect x={100 - build.w / 2 - 16} y="156" width="14" height="58" rx="7" fill={outfit.base} stroke={outfit.dark} strokeWidth="2" />
        <rect x={100 + build.w / 2 + 2} y="156" width="14" height="58" rx="7" fill={outfit.base} stroke={outfit.dark} strokeWidth="2" />

        {/* Head */}
        <circle cx={headCx} cy={headCy} r={headR} fill={isRobot ? '#e8edf2' : skin} stroke={isRobot ? '#9aa1a9' : '#00000022'} strokeWidth="2" />

        {/* Ears / bolts */}
        <circle cx={headCx - headR} cy={headCy} r={isRobot ? 5 : 7} fill={isRobot ? '#9aa1a9' : skin} />
        <circle cx={headCx + headR} cy={headCy} r={isRobot ? 5 : 7} fill={isRobot ? '#9aa1a9' : skin} />

        {/* Hair / headwear */}
        <Hair style={config.hairStyle} color={hair} accent={accent} isRobot={isRobot} cx={headCx} cy={headCy} r={headR} />

        {/* Face */}
        <g className="stakey-blink">
          <circle cx={headCx - 14} cy={headCy + 2} r="4.2" fill="#1c1f24" />
          <circle cx={headCx + 14} cy={headCy + 2} r="4.2" fill="#1c1f24" />
        </g>
        {/* Brows */}
        <path d={`M ${headCx - 20} ${headCy - 8} q 6 -5 12 0`} stroke="#1c1f24" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d={`M ${headCx + 8} ${headCy - 8} q 6 -5 12 0`} stroke="#1c1f24" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* Cheeks */}
        {!isRobot && (
          <>
            <circle cx={headCx - 22} cy={headCy + 14} r="5" fill="#e2554b" opacity="0.28" />
            <circle cx={headCx + 22} cy={headCy + 14} r="5" fill="#e2554b" opacity="0.28" />
          </>
        )}
        {/* Mouth */}
        <ellipse className={mouthClass} cx={headCx} cy={headCy + 20} rx="10" ry="6" fill="#7a2a2a" />

        {/* Legs */}
        <rect x="86" y="222" width="11" height="18" rx="5" fill={outfit.dark} />
        <rect x="103" y="222" width="11" height="18" rx="5" fill={outfit.dark} />
      </g>
    </svg>
  );
}

function Hair({
  style,
  color,
  accent,
  isRobot,
  cx,
  cy,
  r,
}: {
  style: StakeyAvatarConfig['hairStyle'];
  color: string;
  accent: string;
  isRobot: boolean;
  cx: number;
  cy: number;
  r: number;
}) {
  const capTop = cy - r + 2;
  switch (style) {
    case 'bald':
      return null;
    case 'antenna':
      return (
        <g>
          <line x1={cx} y1={capTop} x2={cx} y2={capTop - 20} stroke="#9aa1a9" strokeWidth="3" />
          <circle cx={cx} cy={capTop - 24} r="5" fill={accent} className="stakey-blink" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d={`M ${cx - r} ${cy - 6} a ${r} ${r} 0 0 1 ${2 * r} 0 z`} fill={color} />
          <path d={`M ${cx - r - 8} ${cy - 6} h ${2 * r + 16}`} stroke={color} strokeWidth="7" strokeLinecap="round" />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d={`M ${cx - r} ${cy - 4} a ${r} ${r} 0 0 1 ${2 * r} 0 z`} fill={color} />
          <rect x={cx - r} y={cy - 12} width={2 * r} height="10" rx="4" fill={accent} opacity="0.9" />
          <circle cx={cx} cy={capTop - 6} r="5" fill={color} />
        </g>
      );
    case 'helmet':
      return (
        <g>
          <path d={`M ${cx - r - 2} ${cy - 2} a ${r + 2} ${r + 2} 0 0 1 ${2 * r + 4} 0 z`} fill={accent} />
          <path d={`M ${cx - r - 2} ${cy - 2} h ${2 * r + 4}`} stroke="#1c1f24" strokeWidth="3" />
          <path d={`M ${cx - r - 10} ${cy - 2} q 8 6 16 0`} stroke={accent} strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'bun':
      return (
        <g>
          <path d={`M ${cx - r} ${cy - 2} a ${r} ${r} 0 0 1 ${2 * r} 0 z`} fill={color} />
          <circle cx={cx} cy={capTop - 8} r="9" fill={color} />
        </g>
      );
    case 'spiky':
      return (
        <g>
          <path d={`M ${cx - r} ${cy - 4} a ${r} ${r} 0 0 1 ${2 * r} 0 z`} fill={color} />
          {[-24, -10, 4, 18].map((dx) => (
            <path key={dx} d={`M ${cx + dx} ${capTop + 6} l 6 -16 l 6 16 z`} fill={color} />
          ))}
        </g>
      );
    case 'short':
    default:
      return (
        <g>
          <path d={`M ${cx - r} ${cy - 2} a ${r} ${r} 0 0 1 ${2 * r} 0 q -${r} -8 -${2 * r} 0 z`} fill={color} />
          {!isRobot && <path d={`M ${cx - r + 4} ${cy - 12} q ${r} -14 ${2 * r - 8} 0`} fill={color} />}
        </g>
      );
  }
}
